import { Hono } from 'hono'
import authRouter from './auth'
import documentsRouter from './documents'
import templatesRouter from './templates'
import extractionsRouter from './extractions'
import productsRouter from './products'
import meRouter from './me'

const router = new Hono()

router.get('/health', (c) => c.json({ data: 'OK', error: false }))

router.route('/auth', authRouter)
router.route('/me', meRouter)
router.route('/products', productsRouter)
router.route('/documents', documentsRouter)
router.route('/templates', templatesRouter)
router.route('/extractions', extractionsRouter)

export default router
