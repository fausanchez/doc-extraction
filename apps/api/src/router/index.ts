import { Hono } from 'hono'
import authRouter from './auth'
import documentsRouter from './documents'
import templatesRouter from './templates'
import extractionsRouter from './extractions'
import productsRouter from './products'
import meRouter from './me'
import apiTokensRouter from './api-tokens'
import feedbackRouter from './feedback'
import paddleRouter from './paddle'
import v1Router from './v1'
import { selectProvider } from '@/lib/extraction'

const router = new Hono<{ Bindings: CloudflareBindings }>()

router.get('/health', async (c) => {
    const checks: Record<string, 'ok' | 'fail'> = {
        db: 'fail',
        r2: 'fail',
        provider: 'fail'
    }

    // Each check gets 3 s — enough to detect a real outage without making the
    // health endpoint itself slow under normal conditions.
    const timeout = (ms: number) =>
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), ms)
        )

    await Promise.allSettled([
        Promise.race([c.env.DB.prepare('SELECT 1').run(), timeout(3000)])
            .then(() => { checks.db = 'ok' })
            .catch(() => {}),

        // R2: list with limit=0 just exercises the binding without reading data.
        Promise.race([c.env.BUCKET.list({ limit: 1 }), timeout(3000)])
            .then(() => { checks.r2 = 'ok' })
            .catch(() => {}),

        // Provider: only checks that credentials are present — does not call the AI.
        Promise.resolve()
            .then(() => {
                selectProvider(c.env)
                checks.provider = 'ok'
            })
            .catch(() => {})
    ])

    const allOk = Object.values(checks).every((v) => v === 'ok')
    const status = allOk ? 'ok' : 'degraded'

    return c.json(
        { data: { status, checks }, error: !allOk },
        allOk ? 200 : 503
    )
})

// Machine-readable API reference. Describes every public endpoint, its
// authentication requirement, and the request/response shape so LLM tools
// and developer clients can self-discover the surface without a separate doc
// site. The structure intentionally mirrors OpenAPI but is hand-authored to
// stay tight and accurate.
router.get('/docs', (c) => {
    return c.json({
        version: '1.0',
        baseUrl: c.env.APP_URL ? c.env.APP_URL.replace(/app\./, 'api.') : 'https://api.dvop.io',
        authentication: {
            session: 'Authorization: Bearer <accessToken> — short-lived JWT (1 h), obtained from /auth/google or /auth/github',
            apiToken: 'Authorization: Bearer dvop_live_<hex> — long-lived API token, managed via /api-tokens'
        },
        endpoints: [
            { method: 'GET',    path: '/health',              auth: 'none',     description: 'Health check. Returns status of DB, R2 and extraction provider.' },
            { method: 'GET',    path: '/docs',                auth: 'none',     description: 'This document.' },
            { method: 'POST',   path: '/auth/google',         auth: 'none',     description: 'Exchange a Google OAuth code for session tokens.' },
            { method: 'POST',   path: '/auth/github',         auth: 'none',     description: 'Exchange a GitHub OAuth code for session tokens.' },
            { method: 'POST',   path: '/auth/refresh',        auth: 'cookie',   description: 'Rotate refresh token and return a new access token.' },
            { method: 'POST',   path: '/auth/logout',         auth: 'session',  description: 'Revoke the current session.' },
            { method: 'GET',    path: '/me/usage',            auth: 'session',  description: 'Current plan and rolling-30-day extraction usage.' },
            { method: 'GET',    path: '/me/export',           auth: 'session',  description: 'GDPR data export — returns all data held about the user.' },
            { method: 'GET',    path: '/products',            auth: 'none',     description: 'List active products with nested prices.' },
            { method: 'GET',    path: '/products/:slug',      auth: 'none',     description: 'Single product detail.' },
            { method: 'GET',    path: '/documents',           auth: 'session',  description: 'Paginated list of the user\'s documents (?page, ?limit).' },
            { method: 'GET',    path: '/documents/:id',       auth: 'session',  description: 'Single document with its extractions.' },
            { method: 'GET',    path: '/documents/:id/download', auth: 'session', description: 'Stream the raw file from R2 storage.' },
            { method: 'POST',   path: '/documents/upload',    auth: 'session',  description: 'Upload a file (multipart/form-data). Max 10 MB. Accepts PDF, JPEG, PNG, WebP.' },
            { method: 'DELETE', path: '/documents/:id',       auth: 'session',  description: 'Soft-delete a document and all its extractions.' },
            { method: 'GET',    path: '/templates',           auth: 'session',  description: 'Paginated list of extraction templates.' },
            { method: 'GET',    path: '/templates/:id',       auth: 'session',  description: 'Single template.' },
            { method: 'POST',   path: '/templates',           auth: 'session',  description: 'Create a template.' },
            { method: 'PUT',    path: '/templates/:id',       auth: 'session',  description: 'Update a template.' },
            { method: 'DELETE', path: '/templates/:id',       auth: 'session',  description: 'Delete a template.' },
            { method: 'GET',    path: '/extractions',         auth: 'session',  description: 'Paginated list of extractions (?page, ?limit, ?status).' },
            { method: 'GET',    path: '/extractions/:id',     auth: 'session',  description: 'Single extraction result.' },
            { method: 'POST',   path: '/extractions',         auth: 'session',  description: 'Start an extraction. Returns 402 when credit limit is reached.' },
            { method: 'GET',    path: '/api-tokens',          auth: 'session',  description: 'List API tokens for the current user.' },
            { method: 'POST',   path: '/api-tokens',          auth: 'session',  description: 'Create a new API token. Returns plaintext exactly once.' },
            { method: 'DELETE', path: '/api-tokens/:id',      auth: 'session',  description: 'Revoke an API token.' },
            { method: 'GET',    path: '/api-tokens/:id/usage',auth: 'session',  description: 'Token stats and 30-day daily usage chart data.' },
            { method: 'POST',   path: '/feedback',            auth: 'session',  description: 'Submit user feedback (bug | feature | general).' },
            { method: 'POST',   path: '/paddle/webhook',      auth: 'signature', description: 'Paddle billing webhook — verified via HMAC-SHA256.' },
            { method: 'GET',    path: '/v1/extract',          auth: 'apiToken', description: 'Programmatic extraction endpoint. Accepts multipart/form-data with file + templateId.' }
        ]
    })
})

router.route('/auth', authRouter)
router.route('/me', meRouter)
router.route('/products', productsRouter)
router.route('/documents', documentsRouter)
router.route('/templates', templatesRouter)
router.route('/extractions', extractionsRouter)
router.route('/api-tokens', apiTokensRouter)
router.route('/feedback', feedbackRouter)
router.route('/paddle', paddleRouter)

// Public programmatic API. Authenticates with `Authorization: Bearer
// dvop_live_…` (an API token managed under /api-tokens). Versioned prefix
// so future incompatible changes can co-exist.
router.route('/v1', v1Router)

export default router
