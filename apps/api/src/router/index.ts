import { Hono } from 'hono'
import authRouter from './auth'
import documentsRouter from './documents'
import templatesRouter from './templates'
import extractionsRouter from './extractions'

const router = new Hono()

router.get('/health', (c) => c.json({ data: 'OK', error: false }))

router.route('/auth', authRouter)
router.route('/documents', documentsRouter)
router.route('/templates', templatesRouter)
router.route('/extractions', extractionsRouter)

export default router
