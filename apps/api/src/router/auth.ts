import { Hono } from 'hono'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users } from '@/db/schema'
import { generateToken, verifyToken, zValidator } from '@/lib/utils'
import { exchangeGoogleCode, verifyGoogleIdToken, upsertGoogleUser } from '@/lib/auth/google'
import { exchangeGitHubCode, getGitHubUser, upsertGitHubUser } from '@/lib/auth/github'

const router = new Hono<{ Bindings: CloudflareBindings }>()

// Google OAuth callback
const googleCallbackSchema = z.object({ code: z.string() })

router.post('/google', zValidator('json', googleCallbackSchema), async (c) => {
    const { code } = c.req.valid('json')
    const db = drizzle(c.env.DB)

    const idToken = await exchangeGoogleCode(code, c.env)
    const payload = await verifyGoogleIdToken(idToken, c.env)
    const user = await upsertGoogleUser(db, payload)
    const token = await generateToken(user.id, user.role, c.env.JWT_SECRET)

    return c.json({ data: { token, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } }, error: false })
})

// GitHub OAuth callback
const githubCallbackSchema = z.object({ code: z.string() })

router.post('/github', zValidator('json', githubCallbackSchema), async (c) => {
    const { code } = c.req.valid('json')
    const db = drizzle(c.env.DB)

    const accessToken = await exchangeGitHubCode(code, c.env)
    const { user: ghUser, email } = await getGitHubUser(accessToken)
    const user = await upsertGitHubUser(db, ghUser, email)
    const token = await generateToken(user.id, user.role, c.env.JWT_SECRET)

    return c.json({ data: { token, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } }, error: false })
})

// Get current user
router.get('/me', async (c) => {
    const token = c.req.header('Authorization')?.split(' ')[1]
    if (!token) {
        return c.json({ data: null, error: true, message: 'Unauthorized' }, 401)
    }

    try {
        const decoded = await verifyToken(token, c.env.JWT_SECRET)
        const db = drizzle(c.env.DB)
        const userList = await db
            .select({ id: users.id, email: users.email, name: users.name, avatar: users.avatar, role: users.role })
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
