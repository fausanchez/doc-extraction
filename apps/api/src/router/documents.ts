import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, desc } from 'drizzle-orm'
import { documents, extractions } from '@/db/schema'
import { authMiddleware } from '@/middleware/auth'
import { zValidator } from '@/lib/utils'
import { idParamSchema } from '@/lib/validators'
import { rateLimit, keyByUser } from '@/middleware/rate-limit'
import { buildObjectKey, sanitizeFilename } from '@/lib/filenames'
import { sniffFile } from '@/lib/mime-sniff'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

const router = new Hono<{
    Bindings: CloudflareBindings
    Variables: { userId: number; sessionId: string; role: string }
}>()

router.use('*', authMiddleware)

// List documents
router.get('/', async (c) => {
    const userId = c.get('userId')
    const db = drizzle(c.env.DB)
    const docs = await db
        .select()
        .from(documents)
        .where(eq(documents.userId, userId))
        .orderBy(desc(documents.createdAt))

    return c.json({ data: docs, error: false })
})

// Get single document
router.get('/:id', zValidator('param', idParamSchema), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const db = drizzle(c.env.DB)

    const doc = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.userId, userId)))
        .limit(1)

    if (doc.length === 0) {
        return c.json({ data: null, error: true, message: 'Document not found' }, 404)
    }

    const docExtractions = await db
        .select()
        .from(extractions)
        .where(eq(extractions.documentId, id))
        .orderBy(desc(extractions.createdAt))

    return c.json({ data: { ...doc[0], extractions: docExtractions }, error: false })
})

// Download single document — proxied through the Worker so the R2 bucket can
// stay private (no presigned URL leaks) and ownership is checked on every
// fetch. Rate-limited to prevent mass-download enumeration attacks.
router.get(
    '/:id/download',
    rateLimit((env) => env.UPLOAD_RATE_LIMITER, keyByUser),
    zValidator('param', idParamSchema),
    async (c) => {
        const userId = c.get('userId')
        const { id } = c.req.valid('param')
        const db = drizzle(c.env.DB)

        const [doc] = await db
            .select()
            .from(documents)
            .where(and(eq(documents.id, id), eq(documents.userId, userId)))
            .limit(1)

        if (!doc) {
            return c.json({ data: null, error: true, message: 'Document not found' }, 404)
        }

        const obj = await c.env.BUCKET.get(doc.filePath)
        if (!obj) {
            return c.json({ data: null, error: true, message: 'File not found in storage' }, 404)
        }

        return new Response(obj.body, {
            headers: {
                'Content-Type': doc.mimeType,
                'Content-Length': String(doc.size),
                // `inline` keeps PDFs and images viewable in-browser; the filename
                // travels through `sanitizeFilename` already so it's safe here.
                'Content-Disposition': `inline; filename="${doc.name}"`,
                'Cache-Control': 'private, max-age=300, must-revalidate'
            }
        })
    }
)

// Upload document — per-user rate limit prevents storage flooding.
router.post(
    '/upload',
    rateLimit((env) => env.UPLOAD_RATE_LIMITER, keyByUser),
    async (c) => {
        // Fast-path rejection before buffering the body. Content-Length can be
        // absent or spoofed, so we enforce the limit again after parsing.
        const declared = parseInt(c.req.header('content-length') ?? '0', 10)
        if (declared > MAX_UPLOAD_BYTES) {
            return c.json(
                { data: null, error: true, message: 'File exceeds the maximum size of 10MB' },
                413
            )
        }

        const userId = c.get('userId')
        const formData = await c.req.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return c.json({ data: null, error: true, message: 'File not found' }, 400)
        }

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
        if (!allowedTypes.includes(file.type)) {
            return c.json({ data: null, error: true, message: 'Unsupported file type' }, 400)
        }

        if (file.size > MAX_UPLOAD_BYTES) {
            return c.json(
                { data: null, error: true, message: 'File exceeds the maximum size of 10MB' },
                413
            )
        }

        // Magic-byte check — a malicious client can claim any Content-Type, so
        // verify the actual file bytes before accepting the upload.
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

        const db = drizzle(c.env.DB)
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

        return c.json({ data: doc, error: false })
    }
)

// Delete document
router.delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const db = drizzle(c.env.DB)

    const doc = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.userId, userId)))
        .limit(1)

    if (doc.length === 0) {
        return c.json({ data: null, error: true, message: 'Document not found' }, 404)
    }

    await c.env.BUCKET.delete(doc[0]!.filePath)
    await db.delete(documents).where(eq(documents.id, id))

    return c.json({ data: null, error: false })
})

export default router
