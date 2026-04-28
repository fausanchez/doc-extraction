import type { MiddlewareHandler } from 'hono'
import { verifyAccessToken } from '@/lib/utils'

export const authMiddleware: MiddlewareHandler<{
    Bindings: CloudflareBindings
    Variables: { userId: number; sessionId: string; role: string }
}> = async (c, next) => {
    const token = c.req.header('Authorization')?.split(' ')[1]
    if (!token) {
        return c.json({ data: null, error: true, message: 'Unauthorized' }, 401)
    }

    try {
        const decoded = await verifyAccessToken(token, c.env.JWT_SECRET)
        c.set('userId', decoded.sub)
        c.set('sessionId', decoded.sid)
        c.set('role', decoded.role)
        await next()
    } catch {
        return c.json({ data: null, error: true, message: 'Invalid token' }, 401)
    }
}
