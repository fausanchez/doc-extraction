import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware } from './auth'
import { generateAccessToken } from '@/lib/utils'

const SECRET = 'a'.repeat(32)

function buildApp() {
    const app = new Hono<{
        Bindings: CloudflareBindings
        Variables: { userId: number; sessionId: string; role: string }
    }>()
    app.use('*', authMiddleware)
    app.get('/me', (c) =>
        c.json({
            userId: c.get('userId'),
            sessionId: c.get('sessionId'),
            role: c.get('role')
        })
    )
    return app
}

const env = { JWT_SECRET: SECRET } as unknown as CloudflareBindings

describe('authMiddleware', () => {
    it('returns 401 when no Authorization header is present', async () => {
        const app = buildApp()
        const res = await app.request('/me', {}, env)
        expect(res.status).toBe(401)
        await expect(res.json()).resolves.toMatchObject({ error: true, message: 'Unauthorized' })
    })

    it('returns 401 when the token is malformed', async () => {
        const app = buildApp()
        const res = await app.request('/me', { headers: { Authorization: 'Bearer not-a-jwt' } }, env)
        expect(res.status).toBe(401)
        await expect(res.json()).resolves.toMatchObject({ error: true, message: 'Invalid token' })
    })

    it('returns 401 when the token was signed with a different secret', async () => {
        const token = await generateAccessToken(1, 'sess', 'user', 'b'.repeat(32))
        const app = buildApp()
        const res = await app.request('/me', { headers: { Authorization: `Bearer ${token}` } }, env)
        expect(res.status).toBe(401)
    })

    it('passes through a valid token and sets userId/sessionId/role on the context', async () => {
        const token = await generateAccessToken(99, 'sess-xyz', 'admin', SECRET)
        const app = buildApp()
        const res = await app.request('/me', { headers: { Authorization: `Bearer ${token}` } }, env)
        expect(res.status).toBe(200)
        await expect(res.json()).resolves.toEqual({
            userId: 99,
            sessionId: 'sess-xyz',
            role: 'admin'
        })
    })
})
