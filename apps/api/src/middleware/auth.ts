import type { MiddlewareHandler } from 'hono'
import { verifyToken } from '@/lib/utils'

export const authMiddleware: MiddlewareHandler<{ Bindings: CloudflareBindings; Variables: { userId: number; role: string } }> = async (c, next) => {
    const token = c.req.header('Authorization')?.split(' ')[1]
    if (!token) {
        return c.json({ data: null, error: true, message: 'Unauthorized' }, 401)
    }

    try {
        const decoded = await verifyToken(token, c.env.JWT_SECRET)
        c.set('userId', decoded.sub)
        c.set('role', decoded.role)
        await next()
    } catch {
        return c.json({ data: null, error: true, message: 'Invalid token' }, 401)
    }
}
