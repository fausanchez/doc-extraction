import type { MiddlewareHandler } from 'hono'

// Conservative security headers for the JSON API surface.
// The API never returns HTML, so the CSP can be the strictest possible.
export const securityHeaders: MiddlewareHandler = async (c, next) => {
    await next()

    const h = c.res.headers

    h.set('X-Content-Type-Options', 'nosniff')
    h.set('X-Frame-Options', 'DENY')
    h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    h.set(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()'
    )
    // 2 years, includeSubDomains, opt into preload list
    h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    h.set('Cross-Origin-Resource-Policy', 'same-site')
    h.set('Cross-Origin-Opener-Policy', 'same-origin')

    if (!h.has('Content-Security-Policy')) {
        h.set(
            'Content-Security-Policy',
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        )
    }
}
