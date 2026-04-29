import type { Context, MiddlewareHandler } from 'hono'

// Cloudflare Workers Rate Limiting binding shape.
// See https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
export type RateLimit = {
    limit: (options: { key: string }) => Promise<{ success: boolean }>
}

type Env = { Bindings: CloudflareBindings; Variables?: Record<string, unknown> }

// Wraps a Cloudflare RateLimit binding into a Hono middleware. Returns 429 with
// a `Retry-After` hint when the key has exceeded its quota.
export const rateLimit = (
    getBinding: (env: CloudflareBindings) => RateLimit,
    getKey: (c: Context<Env>) => string,
    retryAfterSeconds = 60
): MiddlewareHandler<Env> => {
    return async (c, next) => {
        const binding = getBinding(c.env)
        // In local dev the binding is undefined unless wrangler is run with the
        // unsafe rate-limit shim — fail open so dev workflows aren't blocked.
        if (!binding || typeof binding.limit !== 'function') {
            await next()
            return
        }

        const key = getKey(c)
        const { success } = await binding.limit({ key })
        if (!success) {
            return c.json(
                { data: null, error: true, message: 'Too many requests' },
                429,
                { 'Retry-After': String(retryAfterSeconds) }
            )
        }
        await next()
    }
}

// Common key extractors.
// Trust order: CF-Connecting-IP (set by Cloudflare for the originating client),
// X-Forwarded-For first hop, then a constant fallback for local dev.
export const keyByIp = (c: Context<Env>): string => {
    return (
        c.req.header('cf-connecting-ip') ||
        c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
        'local'
    )
}

export const keyByUser = (c: Context<Env>): string => {
    const userId = c.get('userId') as number | undefined
    return userId !== undefined ? `u:${userId}` : `ip:${keyByIp(c)}`
}
