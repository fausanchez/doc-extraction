import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { authMiddleware } from '@/middleware/auth'
import { getUsage, getUserProduct } from '@/lib/products'

// Account-level reads that aren't part of the auth handshake itself live
// here. `/auth/me` continues to return the bare user record on session
// validation; `/me/*` carries everything else the dashboard needs to render
// the workspace state of the current user.
const router = new Hono<{
    Bindings: CloudflareBindings
    Variables: { userId: number; sessionId: string; role: string }
}>()

router.use('*', authMiddleware)

// Plan + rolling-30-day extraction usage. The client refetches this whenever
// the dashboard mounts and after a successful extraction so the credit
// counter stays in sync.
router.get('/usage', async (c) => {
    const userId = c.get('userId')
    const db = drizzle(c.env.DB)

    const product = await getUserProduct(db, userId)
    if (!product) {
        return c.json(
            { data: null, error: true, message: 'No product configured for this account' },
            500
        )
    }

    const usage = await getUsage(db, userId, product.monthlyExtractionCredits)

    return c.json({
        data: {
            product: {
                id: product.id,
                slug: product.slug,
                name: product.name,
                description: product.description,
                monthlyExtractionCredits: product.monthlyExtractionCredits
            },
            usage
        },
        error: false
    })
})

export default router
