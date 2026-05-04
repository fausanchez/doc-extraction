import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { securityHeaders } from './middleware/security-headers'
import router from './router'
import * as Sentry from '@sentry/cloudflare'

const app = new Hono<{ Bindings: CloudflareBindings }>()

// Build the allowlist of origins from the configured APP_URL plus, in dev, a
// localhost fallback. Explicit allowlist replaces the previous wildcard subdomain
// check, which would have accepted requests from any hypothetical sibling
// subdomain (e.g. attacker.dvop.io).
function isAllowedOrigin(origin: string, env: CloudflareBindings): boolean {
    if (!origin) return false
    if (origin === env.APP_URL) return true
    // Local dev: APP_URL is configured per-env (localhost / develop / prod),
    // so allow common dev origins only when the configured APP_URL itself
    // looks like a local URL.
    if (env.APP_URL.startsWith('http://localhost')) {
        return /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
    }
    return false
}

// CORS runs FIRST so every response — including the misconfiguration 500s
// below — carries the right `Access-Control-Allow-Origin` header. If we ran
// the JWT_SECRET check first and it returned 500, the browser would surface
// the failure as a generic CORS error instead of the actual misconfiguration.
app.use('*', (c, next) =>
    cors({
        origin: (origin) => (isAllowedOrigin(origin, c.env) ? origin : ''),
        credentials: true,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: 600
    })(c, next)
)

app.use('*', securityHeaders)

// Fail fast on missing/weak secrets at the request boundary so a misconfigured
// deploy is loud rather than silently issuing unsigned tokens. We don't crash
// at module-eval time because Cloudflare instantiates Workers lazily and the
// bindings aren't visible there.
app.use('*', async (c, next) => {
    if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) {
        return c.json(
            {
                data: null,
                error: true,
                message:
                    'Server misconfigured: JWT_SECRET must be set and at least 32 characters'
            },
            500
        )
    }
    await next()
})

app.route('/', router)

// Sentry is a no-op when SENTRY_DSN is not set — safe for local dev.
export default Sentry.withSentry(
    (env: CloudflareBindings) => ({
        dsn: env.SENTRY_DSN ?? '',
        environment: env.ENVIRONMENT ?? 'development',
        tracesSampleRate: 0.1
    }),
    { fetch: app.fetch }
)
