import type { MiddlewareHandler } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { recordTokenUsage, verifyApiToken } from '@/lib/api-tokens'

export const apiTokenAuthMiddleware: MiddlewareHandler<{
    Bindings: CloudflareBindings
    Variables: { userId: number; apiTokenId: number }
}> = async (c, next) => {
    const auth = c.req.header('Authorization')
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
        return c.json(
            { data: null, error: true, message: 'Missing API token' },
            401,
            { 'WWW-Authenticate': 'Bearer realm="dvop.io API"' }
        )
    }

    const db = drizzle(c.env.DB)
    const result = await verifyApiToken(db, token)

    if (!result.valid) {
        const message =
            result.reason === 'expired'
                ? 'API token expired'
                : result.reason === 'revoked'
                  ? 'API token revoked'
                  : 'Invalid API token'
        return c.json({ data: null, error: true, message }, 401, {
            'WWW-Authenticate': 'Bearer realm="dvop.io API"'
        })
    }

    c.set('userId', result.userId)
    c.set('apiTokenId', result.tokenId)

    // Fire-and-forget usage accounting so the request itself never waits on
    // the bookkeeping write.
    c.executionCtx.waitUntil(recordTokenUsage(db, result.tokenId))

    await next()
}
