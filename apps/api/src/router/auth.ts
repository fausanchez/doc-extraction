import { Hono } from 'hono'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { users } from '@/db/schema'
import { verifyAccessToken, zValidator } from '@/lib/utils'
import { exchangeGoogleCode, verifyGoogleIdToken, upsertGoogleUser } from '@/lib/auth/google'
import { exchangeGitHubCode, getGitHubUser, upsertGitHubUser } from '@/lib/auth/github'
import {
    REFRESH_TOKEN_TTL_SECONDS,
    createSession,
    revokeSession,
    revokeSessionById,
    rotateSession,
    type IssuedTokens
} from '@/lib/auth/sessions'
import { rateLimit, keyByIp } from '@/middleware/rate-limit'

const router = new Hono<{ Bindings: CloudflareBindings }>()

// Per-IP rate limit on every public auth endpoint — blunts brute-force code
// guessing, refresh-token enumeration and OAuth provider abuse.
const authRateLimit = rateLimit((env) => env.AUTH_RATE_LIMITER, keyByIp)

// Refresh token now lives in an httpOnly cookie instead of localStorage. This
// removes the XSS exfiltration path entirely (JS can't read it) while
// SameSite=Lax + Path scoping defangs CSRF on the refresh endpoint.
const REFRESH_COOKIE_NAME = 'dvop_refresh'

type CookieEnv = { APP_URL: string }

const refreshCookieOptions = (env: CookieEnv) => {
    const isLocal = env.APP_URL.startsWith('http://localhost')
    return {
        httpOnly: true,
        // `secure` is ignored on insecure origins, but setting it
        // unconditionally on production hosts hardens against downgrade.
        secure: !isLocal,
        // `Lax` is the right default for our flow: refresh requests are
        // explicit fetch() calls from the dashboard origin, never side-effects
        // of cross-site navigation.
        sameSite: 'Lax' as const,
        // Scope the cookie to /auth/* — never sent on document/template/etc.
        path: '/auth',
        maxAge: REFRESH_TOKEN_TTL_SECONDS
    }
}

function setRefreshCookie(c: Parameters<typeof setCookie>[0], env: CookieEnv, value: string) {
    setCookie(c, REFRESH_COOKIE_NAME, value, refreshCookieOptions(env))
}

function clearRefreshCookie(c: Parameters<typeof deleteCookie>[0], env: CookieEnv) {
    // `deleteCookie` doesn't accept Path/SameSite, so emit a bounded Set-Cookie
    // manually with Max-Age=0 to retire the value across all browsers.
    setCookie(c, REFRESH_COOKIE_NAME, '', {
        ...refreshCookieOptions(env),
        maxAge: 0
    })
}

const buildLoginPayload = (
    user: { id: number; email: string; name: string; avatar: string },
    tokens: IssuedTokens
) => ({
    accessToken: tokens.accessToken,
    accessTokenExpiresIn: tokens.accessTokenExpiresIn,
    user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar }
})

// Google OAuth callback
const googleCallbackSchema = z.object({ code: z.string().min(1).max(2048) })

router.post('/google', authRateLimit, zValidator('json', googleCallbackSchema), async (c) => {
    const { code } = c.req.valid('json')
    const db = drizzle(c.env.DB)

    const idToken = await exchangeGoogleCode(code, c.env)
    const payload = await verifyGoogleIdToken(idToken, c.env)
    const user = await upsertGoogleUser(db, payload)
    const tokens = await createSession(db, user.id, user.role, c.env.JWT_SECRET)

    setRefreshCookie(c, c.env, tokens.refreshToken)
    return c.json({ data: buildLoginPayload(user, tokens), error: false })
})

// GitHub OAuth callback
const githubCallbackSchema = z.object({ code: z.string().min(1).max(2048) })

router.post('/github', authRateLimit, zValidator('json', githubCallbackSchema), async (c) => {
    const { code } = c.req.valid('json')
    const db = drizzle(c.env.DB)

    const accessToken = await exchangeGitHubCode(code, c.env)
    const { user: ghUser, email } = await getGitHubUser(accessToken)
    const user = await upsertGitHubUser(db, ghUser, email)
    const tokens = await createSession(db, user.id, user.role, c.env.JWT_SECRET)

    setRefreshCookie(c, c.env, tokens.refreshToken)
    return c.json({ data: buildLoginPayload(user, tokens), error: false })
})

// Refresh — rotate the refresh token (cookie) and issue a new access token.
router.post('/refresh', authRateLimit, async (c) => {
    const refreshToken = getCookie(c, REFRESH_COOKIE_NAME)
    if (!refreshToken) {
        return c.json({ data: null, error: true, message: 'Missing refresh token' }, 401)
    }

    const db = drizzle(c.env.DB)
    const tokens = await rotateSession(db, refreshToken, c.env.JWT_SECRET)
    if (!tokens) {
        clearRefreshCookie(c, c.env)
        return c.json({ data: null, error: true, message: 'Invalid refresh token' }, 401)
    }

    setRefreshCookie(c, c.env, tokens.refreshToken)
    return c.json(
        {
            data: {
                accessToken: tokens.accessToken,
                accessTokenExpiresIn: tokens.accessTokenExpiresIn
            },
            error: false
        }
    )
})

// Logout — revoke the refresh-token row server-side. Idempotent.
router.post('/logout', authRateLimit, async (c) => {
    const db = drizzle(c.env.DB)
    const refreshToken = getCookie(c, REFRESH_COOKIE_NAME)

    if (refreshToken) {
        await revokeSession(db, refreshToken)
    }

    // Best-effort: if the access token is still presented, also revoke its
    // session id so an attacker who scraped the JWT can't keep using it
    // until expiry.
    const access = c.req.header('Authorization')?.split(' ')[1]
    if (access) {
        try {
            const decoded = await verifyAccessToken(access, c.env.JWT_SECRET)
            await revokeSessionById(db, decoded.sid)
        } catch {
            // ignore — token already invalid
        }
    }

    clearRefreshCookie(c, c.env)
    return c.json({ data: null, error: false })
})

// Get current user
router.get('/me', async (c) => {
    const token = c.req.header('Authorization')?.split(' ')[1]
    if (!token) {
        return c.json({ data: null, error: true, message: 'Unauthorized' }, 401)
    }

    try {
        const decoded = await verifyAccessToken(token, c.env.JWT_SECRET)
        const db = drizzle(c.env.DB)
        const userList = await db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                avatar: users.avatar,
                role: users.role
            })
            .from(users)
            .where(eq(users.id, decoded.sub))
            .limit(1)

        if (userList.length === 0) {
            return c.json({ data: null, error: true, message: 'User not found' }, 404)
        }

        return c.json({ data: userList[0], error: false })
    } catch {
        return c.json({ data: null, error: true, message: 'Invalid token' }, 401)
    }
})

export default router
