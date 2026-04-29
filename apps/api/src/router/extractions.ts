import { Hono } from 'hono'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, desc } from 'drizzle-orm'
import { documents, extractions, templates } from '@/db/schema'
import { authMiddleware } from '@/middleware/auth'
import { zValidator } from '@/lib/utils'
import { idParamSchema } from '@/lib/validators'
import { rateLimit, keyByUser } from '@/middleware/rate-limit'
import { processExtraction } from '@/lib/extraction'

const router = new Hono<{ Bindings: CloudflareBindings; Variables: { userId: number; role: string } }>()

router.use('*', authMiddleware)

// List extractions
router.get('/', async (c) => {
    const userId = c.get('userId')
    const db = drizzle(c.env.DB)
    const exts = await db
        .select()
        .from(extractions)
        .where(eq(extractions.userId, userId))
        .orderBy(desc(extractions.createdAt))

    return c.json({ data: exts, error: false })
})

// Get single extraction
router.get('/:id', zValidator('param', idParamSchema), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const db = drizzle(c.env.DB)

    const ext = await db
        .select()
        .from(extractions)
        .where(and(eq(extractions.id, id), eq(extractions.userId, userId)))
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

        const [doc] = await db
            .select()
            .from(documents)
            .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
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

        const [extraction] = await db
            .insert(extractions)
            .values({ documentId, templateId, userId, status: 'pending' })
            .returning()

        await db.update(documents).set({ status: 'processing' }).where(eq(documents.id, documentId))

        c.executionCtx.waitUntil(processExtraction(c.env, extraction!.id, doc, template))

        return c.json({ data: extraction, error: false })
    }
)

export default router
