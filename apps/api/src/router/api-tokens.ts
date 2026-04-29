import { Hono } from 'hono'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { apiTokens } from '@/db/schema'
import { authMiddleware } from '@/middleware/auth'
import { zValidator } from '@/lib/utils'
import { idParamSchema } from '@/lib/validators'
import { generateApiToken, getTokenDailyUsage } from '@/lib/api-tokens'

const router = new Hono<{
    Bindings: CloudflareBindings
    Variables: { userId: number; sessionId: string; role: string }
}>()

// Dashboard-only routes — managed via the user's session JWT, never via an
// API token (you shouldn't be able to mint new tokens with a token).
router.use('*', authMiddleware)

// Project the public-safe shape: never leak `tokenHash`, and `revokedAt` is
// kept on the row for audit but folded into a derived `status` for the UI.
function toPublic(row: typeof apiTokens.$inferSelect) {
    return {
        id: row.id,
        name: row.name,
        prefix: row.prefix,
        status: row.revokedAt !== null ? ('revoked' as const) : ('active' as const),
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        lastUsedAt: row.lastUsedAt,
        callCount: row.callCount
    }
}

// List the caller's tokens. Active first, revoked tokens still listed so
// the user has audit context, but visually demoted by the client.
router.get('/', async (c) => {
    const userId = c.get('userId')
    const db = drizzle(c.env.DB)

    const rows = await db
        .select()
        .from(apiTokens)
        .where(eq(apiTokens.userId, userId))
        .orderBy(desc(apiTokens.createdAt))

    return c.json({ data: rows.map(toPublic), error: false })
})

// Create a new token. The PLAINTEXT is returned exactly once in this
// response and never persisted; subsequent reads only ever see the prefix.
const createSchema = z.object({
    name: z.string().min(1).max(80),
    // Optional: how many days from now until the token expires. `null` /
    // omitted means no expiration. Capped at 5 years to avoid effectively-
    // immortal tokens.
    expiresInDays: z.number().int().positive().max(365 * 5).optional()
})

router.post('/', zValidator('json', createSchema), async (c) => {
    const userId = c.get('userId')
    const { name, expiresInDays } = c.req.valid('json')
    const db = drizzle(c.env.DB)

    const generated = await generateApiToken()
    const expiresAt =
        expiresInDays === undefined ? null : Date.now() + expiresInDays * 86_400_000

    const [row] = await db
        .insert(apiTokens)
        .values({
            userId,
            name: name.trim(),
            prefix: generated.prefix,
            tokenHash: generated.tokenHash,
            expiresAt
        })
        .returning()

    return c.json(
        {
            data: {
                ...toPublic(row!),
                // Plaintext shown to the user once. A copy with this field
                // never reaches the DB and the client must not persist it.
                token: generated.plaintext
            },
            error: false
        }
    )
})

// Revoke a token. Marks `revokedAt` rather than deleting so audit trails
// (last_used_at, call_count, daily usage rows) survive.
router.delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const db = drizzle(c.env.DB)

    const result = await db
        .update(apiTokens)
        .set({ revokedAt: Date.now() })
        .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
        .returning({ id: apiTokens.id })

    if (result.length === 0) {
        // Either the token doesn't exist, doesn't belong to this user, or
        // was already revoked. We don't distinguish to avoid leaking
        // existence to other users.
        return c.json({ data: null, error: true, message: 'API token not found' }, 404)
    }

    return c.json({ data: null, error: false })
})

// Per-token usage detail: the at-a-glance counters plus the last 30 days
// of per-bucket counts for charting.
router.get('/:id/usage', zValidator('param', idParamSchema), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const db = drizzle(c.env.DB)

    const [row] = await db
        .select()
        .from(apiTokens)
        .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
        .limit(1)

    if (!row) {
        return c.json({ data: null, error: true, message: 'API token not found' }, 404)
    }

    const dailyRaw = await getTokenDailyUsage(db, row.id)

    // Densify: emit one entry per day for the last 30 days, even when the
    // user had zero calls — the chart shouldn't have to fill gaps itself.
    const today = Math.floor(Date.now() / 86_400_000) * 86_400_000
    const byDay = new Map(dailyRaw.map((d) => [d.day, d.count]))
    const daily: { day: number; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
        const day = today - i * 86_400_000
        daily.push({ day, count: byDay.get(day) ?? 0 })
    }

    return c.json({
        data: {
            token: toPublic(row),
            daily
        },
        error: false
    })
})

export default router
