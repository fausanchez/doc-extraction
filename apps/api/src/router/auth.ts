import { Hono } from 'hono'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users } from '@/db/schema'
import { verifyAccessToken, zValidator } from '@/lib/utils'
import { exchangeGoogleCode, verifyGoogleIdToken, upsertGoogleUser } from '@/lib/auth/google'
import { exchangeGitHubCode, getGitHubUser, upsertGitHubUser } from '@/lib/auth/github'
import {
    createSession,
    revokeSession,
    revokeSessionById,
    rotateSession
} from '@/lib/auth/sessions'
import { rateLimit, keyByIp } from '@/middleware/rate-limit'

const router = new Hono<{ Bindings: CloudflareBindings }>()

// Per-IP rate limit on every public auth endpoint — blunts brute-force code
// guessing, refresh-token enumeration and OAuth provider abuse.
const authRateLimit = rateLimit((env) => env.AUTH_RATE_LIMITER, keyByIp)

const buildLoginPayload = (
    user: { id: number; email: string; name: string; avatar: string },
    tokens: {
        accessToken: string
        accessTokenExpiresIn: number
        refreshToken: string
        refreshTokenExpiresIn: number
    }
) => ({
    accessToken: tokens.accessToken,
    accessTokenExpiresIn: tokens.accessTokenExpiresIn,
    refreshToken: tokens.refreshToken,
    refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
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

    return c.json({ data: buildLoginPayload(user, tokens), error: false })
})

// Refresh — rotate the refresh token and issue a new access token.
const refreshSchema = z.object({ refreshToken: z.string().min(8).max(256) })

router.post('/refresh', authRateLimit, zValidator('json', refreshSchema), async (c) => {
    const { refreshToken } = c.req.valid('json')
    const db = drizzle(c.env.DB)

    const tokens = await rotateSession(db, refreshToken, c.env.JWT_SECRET)
    if (!tokens) {
        return c.json({ data: null, error: true, message: 'Invalid refresh token' }, 401)
    }

    return c.json({ data: tokens, error: false })
})

// Logout — revoke the refresh-token row server-side. Idempotent.
const logoutSchema = z.object({ refreshToken: z.string().min(8).max(256).optional() })

router.post('/logout', authRateLimit, zValidator('json', logoutSchema), async (c) => {
    const { refreshToken } = c.req.valid('json')
    const db = drizzle(c.env.DB)

    if (refreshToken) {
        await revokeSession(db, refreshToken)
    }

    // If a valid access token was sent, also revoke its session id — handles
    // the case where the client lost the refresh token but still has an
    // unexpired access token.
    const access = c.req.header('Authorization')?.split(' ')[1]
    if (access) {
        try {
            const decoded = await verifyAccessToken(access, c.env.JWT_SECRET)
            await revokeSessionById(db, decoded.sid)
        } catch {
            // ignore — token already invalid
        }
    }

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
