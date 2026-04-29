import { Hono } from 'hono'
import authRouter from './auth'
import documentsRouter from './documents'
import templatesRouter from './templates'
import extractionsRouter from './extractions'
import productsRouter from './products'
import meRouter from './me'
import apiTokensRouter from './api-tokens'
import v1Router from './v1'

const router = new Hono()

router.get('/health', (c) => c.json({ data: 'OK', error: false }))

router.route('/auth', authRouter)
router.route('/me', meRouter)
router.route('/products', productsRouter)
router.route('/documents', documentsRouter)
router.route('/templates', templatesRouter)
router.route('/extractions', extractionsRouter)
router.route('/api-tokens', apiTokensRouter)

// Public programmatic API. Authenticates with `Authorization: Bearer
// dx_live_…` (an API token managed under /api-tokens). Versioned prefix
// so future incompatible changes can co-exist.
router.route('/v1', v1Router)

export default router
