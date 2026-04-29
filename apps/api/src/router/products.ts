import { Hono } from 'hono'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { and, eq } from 'drizzle-orm'
import { prices, products } from '@/db/schema'
import { zValidator } from '@/lib/utils'
import { listCatalogue } from '@/lib/products'

// The catalogue endpoints are intentionally public — the marketing site and
// the in-app billing page both render them. No mutation surface is exposed
// here (admin CRUD will get its own admin-only routes when needed).
const router = new Hono<{ Bindings: CloudflareBindings }>()

// List active products with their active prices nested under each.
router.get('/', async (c) => {
    const db = drizzle(c.env.DB)
    const data = await listCatalogue(db)
    return c.json({ data, error: false })
})

const slugParamSchema = z.object({
    // Slugs are stable, lowercase identifiers we control — keep the schema
    // tight so an arbitrary string can't probe SQL behavior.
    slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/)
})

// Detail view for a single product (used for upgrade pages).
router.get('/:slug', zValidator('param', slugParamSchema), async (c) => {
    const { slug } = c.req.valid('param')
    const db = drizzle(c.env.DB)

    const [product] = await db
        .select()
        .from(products)
        .where(and(eq(products.slug, slug), eq(products.status, 'active')))
        .limit(1)

    if (!product) {
        return c.json({ data: null, error: true, message: 'Product not found' }, 404)
    }

    const productPrices = await db
        .select()
        .from(prices)
        .where(and(eq(prices.productId, product.id), eq(prices.status, 'active')))

    return c.json({ data: { ...product, prices: productPrices }, error: false })
})

export default router
