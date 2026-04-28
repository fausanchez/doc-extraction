import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, desc } from 'drizzle-orm'
import { documents, extractions } from '@/db/schema'
import { authMiddleware } from '@/middleware/auth'

const router = new Hono<{ Bindings: CloudflareBindings; Variables: { userId: number; role: string } }>()

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
router.get('/:id', async (c) => {
    const userId = c.get('userId')
    const id = Number(c.req.param('id'))
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

// Upload document
router.post('/upload', async (c) => {
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

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
        return c.json({ data: null, error: true, message: 'File exceeds the maximum size of 10MB' }, 400)
    }

    const key = `${userId}/${Date.now()}-${file.name}`
    await c.env.BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type }
    })

    const db = drizzle(c.env.DB)
    const [doc] = await db
        .insert(documents)
        .values({
            userId,
            name: file.name,
            filePath: key,
            mimeType: file.type,
            size: file.size
        })
        .returning()

    return c.json({ data: doc, error: false })
})

// Delete document
router.delete('/:id', async (c) => {
    const userId = c.get('userId')
    const id = Number(c.req.param('id'))
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
