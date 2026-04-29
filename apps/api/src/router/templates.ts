import { Hono } from 'hono'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, desc } from 'drizzle-orm'
import { templates } from '@/db/schema'
import { authMiddleware } from '@/middleware/auth'
import { zValidator } from '@/lib/utils'
import { idParamSchema } from '@/lib/validators'

const router = new Hono<{ Bindings: CloudflareBindings; Variables: { userId: number; role: string } }>()

router.use('*', authMiddleware)

const fieldSchema = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(['string', 'number', 'date', 'boolean', 'array']),
    required: z.boolean().optional().default(false),
    description: z.string().optional().default('')
})

const templateSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional().default(''),
    schema: z.array(fieldSchema)
})

// List templates
router.get('/', async (c) => {
    const userId = c.get('userId')
    const db = drizzle(c.env.DB)
    const tmps = await db
        .select()
        .from(templates)
        .where(and(eq(templates.userId, userId), eq(templates.status, 'active')))
        .orderBy(desc(templates.createdAt))

    return c.json({ data: tmps, error: false })
})

// Get single template
router.get('/:id', zValidator('param', idParamSchema), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const db = drizzle(c.env.DB)

    const tmp = await db
        .select()
        .from(templates)
        .where(and(eq(templates.id, id), eq(templates.userId, userId)))
        .limit(1)

    if (tmp.length === 0) {
        return c.json({ data: null, error: true, message: 'Template not found' }, 404)
    }

    return c.json({ data: tmp[0], error: false })
})

// Create template
router.post('/', zValidator('json', templateSchema), async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')
    const db = drizzle(c.env.DB)

    const [tmp] = await db
        .insert(templates)
        .values({
            userId,
            name: body.name,
            description: body.description,
            schema: JSON.stringify(body.schema)
        })
        .returning()

    return c.json({ data: tmp, error: false })
})

// Update template — owner-scoped UPDATE prevents IDOR (previously the WHERE
// clause filtered by id only, allowing cross-user modification).
router.put(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', templateSchema),
    async (c) => {
        const userId = c.get('userId')
        const { id } = c.req.valid('param')
        const body = c.req.valid('json')
        const db = drizzle(c.env.DB)

        const [tmp] = await db
            .update(templates)
            .set({
                name: body.name,
                description: body.description,
                schema: JSON.stringify(body.schema)
            })
            .where(and(eq(templates.id, id), eq(templates.userId, userId)))
            .returning()

        if (!tmp) {
            return c.json({ data: null, error: true, message: 'Template not found' }, 404)
        }

        return c.json({ data: tmp, error: false })
    }
)

// Delete template (soft) — owner-scoped UPDATE
router.delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const db = drizzle(c.env.DB)

    const result = await db
        .update(templates)
        .set({ status: 'deleted' })
        .where(and(eq(templates.id, id), eq(templates.userId, userId)))
        .returning({ id: templates.id })

    if (result.length === 0) {
        return c.json({ data: null, error: true, message: 'Template not found' }, 404)
    }

    return c.json({ data: null, error: false })
})

export default router
