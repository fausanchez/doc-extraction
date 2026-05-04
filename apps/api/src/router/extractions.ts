import { Hono } from 'hono'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, desc, count, isNull } from 'drizzle-orm'
import { documents, extractions, templates } from '@/db/schema'
import { authMiddleware } from '@/middleware/auth'
import { zValidator } from '@/lib/utils'
import { idParamSchema, pageQuerySchema } from '@/lib/validators'
import { rateLimit, keyByUser } from '@/middleware/rate-limit'
import { processExtraction } from '@/lib/extraction'
import { assertExtractionAllowed } from '@/lib/products'

const router = new Hono<{ Bindings: CloudflareBindings; Variables: { userId: number; role: string } }>()

router.use('*', authMiddleware)

const listQuerySchema = pageQuerySchema.extend({
    status: z.enum(['pending', 'processing', 'done', 'error']).optional()
})

// List extractions — supports ?page, ?limit and optional ?status filter.
router.get('/', zValidator('query', listQuerySchema), async (c) => {
    const userId = c.get('userId')
    const { page, limit, status } = c.req.valid('query')
    const offset = (page - 1) * limit
    const db = drizzle(c.env.DB)

    const where = status
        ? and(eq(extractions.userId, userId), eq(extractions.status, status), isNull(extractions.deletedAt))
        : and(eq(extractions.userId, userId), isNull(extractions.deletedAt))

    const [{ total }] = await db
        .select({ total: count() })
        .from(extractions)
        .where(where)

    const exts = await db
        .select()
        .from(extractions)
        .where(where)
        .orderBy(desc(extractions.createdAt))
        .limit(limit)
        .offset(offset)

    return c.json({
        data: exts,
        error: false,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
})

// Get single extraction
router.get('/:id', zValidator('param', idParamSchema), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const db = drizzle(c.env.DB)

    const ext = await db
        .select()
        .from(extractions)
        .where(and(eq(extractions.id, id), eq(extractions.userId, userId), isNull(extractions.deletedAt)))
        .limit(1)

    if (ext.length === 0) {
        return c.json({ data: null, error: true, message: 'Extraction not found' }, 404)
    }

    return c.json({ data: ext[0], error: false })
})

// Start extraction — per-user rate limit caps AI cost exposure.
const startExtractionSchema = z.object({
    documentId: z.number().int().positive(),
    templateId: z.number().int().positive()
})

router.post(
    '/',
    rateLimit((env) => env.EXTRACTION_RATE_LIMITER, keyByUser),
    zValidator('json', startExtractionSchema),
    async (c) => {
        const userId = c.get('userId')
        const { documentId, templateId } = c.req.valid('json')
        const db = drizzle(c.env.DB)

        // Credit gate first — fail fast and don't waste a DB lookup on the
        // document/template if the user is already over their plan limit.
        const gate = await assertExtractionAllowed(db, userId)
        if (!gate.allowed) {
            // 402 Payment Required surfaces the quota cause distinctly from
            // a 429 (rate limit) or a 400 (validation).
            return c.json(
                {
                    data: null,
                    error: true,
                    message: gate.message,
                    usage: gate.usage,
                    product: { slug: gate.product.slug, name: gate.product.name }
                },
                402
            )
        }

        const [doc] = await db
            .select()
            .from(documents)
            .where(and(eq(documents.id, documentId), eq(documents.userId, userId), isNull(documents.deletedAt)))
            .limit(1)

        if (!doc) {
            return c.json({ data: null, error: true, message: 'Document not found' }, 404)
        }

        const [template] = await db
            .select()
            .from(templates)
            .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
            .limit(1)

        if (!template) {
            return c.json({ data: null, error: true, message: 'Template not found' }, 404)
        }

        // Persist `createdAt` as ms-epoch explicitly so the rolling-window
        // usage query can do a clean integer comparison; the column's SQLite
        // default would otherwise store the value as a CURRENT_TIMESTAMP
        // string, which doesn't compare against integers cleanly.
        const [extraction] = await db
            .insert(extractions)
            .values({
                documentId,
                templateId,
                userId,
                status: 'pending',
                createdAt: Date.now()
            })
            .returning()

        await db.update(documents).set({ status: 'processing' }).where(eq(documents.id, documentId))

        c.executionCtx.waitUntil(processExtraction(c.env, extraction!.id, doc, template))

        return c.json({ data: extraction, error: false })
    }
)

export default router
