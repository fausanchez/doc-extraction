import { Hono } from 'hono'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { and, eq } from 'drizzle-orm'
import { documents, extractions, templates } from '@/db/schema'
import { apiTokenAuthMiddleware } from '@/middleware/api-token-auth'
import { rateLimit, keyByUser } from '@/middleware/rate-limit'
import { zValidator } from '@/lib/utils'
import { idParamSchema } from '@/lib/validators'
import { buildObjectKey, sanitizeFilename } from '@/lib/filenames'
import { sniffFile } from '@/lib/mime-sniff'
import { processExtraction } from '@/lib/extraction'
import { assertExtractionAllowed } from '@/lib/products'

// Public programmatic surface. Authenticates with `Authorization: Bearer
// dvop_live_…` (an API token issued from the dashboard). Same per-user
// extraction rate limit and credit gate as the dashboard, so an API user
// can't sidestep their plan limit.
const router = new Hono<{
    Bindings: CloudflareBindings
    Variables: { userId: number; apiTokenId: number }
}>()

router.use('*', apiTokenAuthMiddleware)

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

const extractFormSchema = z.object({
    template_id: z.coerce.number().int().positive()
})

// POST /v1/extract — multipart form: `file` (PDF/JPG/PNG/WebP) + `template_id`.
// One-shot: uploads the document, runs the credit gate, queues the
// extraction, returns the extraction id for polling. Mirrors the dashboard
// flow but skips the separate upload step.
router.post(
    '/extract',
    rateLimit((env) => env.EXTRACTION_RATE_LIMITER, keyByUser),
    async (c) => {
        const userId = c.get('userId')

        const formData = await c.req.formData()
        const file = formData.get('file') as File | null
        const templateIdRaw = formData.get('template_id')

        if (!file) {
            return c.json({ data: null, error: true, message: 'Missing file' }, 400)
        }

        const parsed = extractFormSchema.safeParse({ template_id: templateIdRaw })
        if (!parsed.success) {
            return c.json(
                { data: null, error: true, message: 'Missing or invalid template_id' },
                400
            )
        }
        const templateId = parsed.data.template_id

        const db = drizzle(c.env.DB)

        // Owner-scoped template lookup — the API token only grants access to
        // the issuing user's resources.
        const [template] = await db
            .select()
            .from(templates)
            .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
            .limit(1)

        if (!template) {
            return c.json({ data: null, error: true, message: 'Template not found' }, 404)
        }

        // Credit gate before we waste R2 bytes / D1 inserts on a request the
        // user's plan won't let through.
        const gate = await assertExtractionAllowed(db, userId)
        if (!gate.allowed) {
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

        if (!ALLOWED_TYPES.includes(file.type)) {
            return c.json(
                { data: null, error: true, message: 'Unsupported file type' },
                400
            )
        }
        if (file.size > MAX_BYTES) {
            return c.json(
                { data: null, error: true, message: 'File exceeds the maximum size of 10MB' },
                400
            )
        }

        const sniffed = await sniffFile(file)
        if (!sniffed || sniffed !== file.type) {
            return c.json(
                {
                    data: null,
                    error: true,
                    message: 'File contents do not match the declared type'
                },
                400
            )
        }

        const safeName = sanitizeFilename(file.name)
        const key = buildObjectKey(userId, file.name)
        await c.env.BUCKET.put(key, file.stream(), {
            httpMetadata: { contentType: sniffed }
        })

        const [doc] = await db
            .insert(documents)
            .values({
                userId,
                name: safeName,
                filePath: key,
                mimeType: sniffed,
                size: file.size
            })
            .returning()

        const [extraction] = await db
            .insert(extractions)
            .values({
                documentId: doc!.id,
                templateId: template.id,
                userId,
                status: 'pending',
                createdAt: Date.now()
            })
            .returning()

        await db.update(documents).set({ status: 'processing' }).where(eq(documents.id, doc!.id))

        c.executionCtx.waitUntil(processExtraction(c.env, extraction!.id, doc!, template))

        return c.json(
            {
                data: {
                    extractionId: extraction!.id,
                    documentId: doc!.id,
                    templateId: template.id,
                    status: extraction!.status,
                    createdAt: extraction!.createdAt
                },
                error: false
            },
            202
        )
    }
)

// GET /v1/extractions/:id — poll the extraction status / result. Returns
// the parsed JSON when status === 'done' so the caller doesn't have to
// double-decode.
router.get('/extractions/:id', zValidator('param', idParamSchema), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const db = drizzle(c.env.DB)

    const [ext] = await db
        .select()
        .from(extractions)
        .where(and(eq(extractions.id, id), eq(extractions.userId, userId)))
        .limit(1)

    if (!ext) {
        return c.json({ data: null, error: true, message: 'Extraction not found' }, 404)
    }

    let result: unknown = null
    if (ext.status === 'done' && ext.result) {
        try {
            result = JSON.parse(ext.result)
        } catch {
            // Surface raw text rather than failing the request — the result
            // column is server-controlled but defensive parsing is cheap.
            result = ext.result
        }
    }

    return c.json({
        data: {
            id: ext.id,
            documentId: ext.documentId,
            templateId: ext.templateId,
            status: ext.status,
            errorMessage: ext.errorMessage || null,
            result,
            createdAt: ext.createdAt
        },
        error: false
    })
})

export default router
