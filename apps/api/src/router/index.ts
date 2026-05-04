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
