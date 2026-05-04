import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, isNull } from 'drizzle-orm'
import { apiTokens, documents, extractions, templates, users } from '@/db/schema'
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

// GDPR data export — returns everything we hold about the authenticated user
// so they can inspect or archive it. Kept in a single JSON payload; for
// large accounts the Worker 30 s limit is unlikely to be hit (extractions
// are filtered to non-deleted rows only).
router.get('/export', async (c) => {
    const userId = c.get('userId')
    const db = drizzle(c.env.DB)

    const [
        [user],
        userDocuments,
        userTemplates,
        userExtractions,
        userTokens
    ] = await Promise.all([
        db.select().from(users).where(eq(users.id, userId)).limit(1),
        db.select().from(documents).where(eq(documents.userId, userId)),
        db.select().from(templates).where(eq(templates.userId, userId)),
        db
            .select()
            .from(extractions)
            .where(eq(extractions.userId, userId)),
        // Omit the tokenHash column — it's an internal credential, not user data.
        db
            .select({
                id: apiTokens.id,
                name: apiTokens.name,
                prefix: apiTokens.prefix,
                expiresAt: apiTokens.expiresAt,
                revokedAt: apiTokens.revokedAt,
                lastUsedAt: apiTokens.lastUsedAt,
                callCount: apiTokens.callCount,
                createdAt: apiTokens.createdAt
            })
            .from(apiTokens)
            .where(eq(apiTokens.userId, userId))
    ])

    if (!user) {
        return c.json({ data: null, error: true, message: 'User not found' }, 404)
    }

    // Strip server-internal fields before shipping to the client.
    const { paddleCustomerId, paddleSubscriptionId, ...publicUser } = user

    return c.json({
        data: {
            exportedAt: new Date().toISOString(),
            user: publicUser,
            documents: userDocuments,
            templates: userTemplates,
            extractions: userExtractions,
            apiTokens: userTokens
        },
        error: false
    })
})

export default router
