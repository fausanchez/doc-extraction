import { drizzle } from 'drizzle-orm/d1'
import { and, count, desc, eq, gte } from 'drizzle-orm'
import { extractions, prices, products, users } from '@/db/schema'

type Db = ReturnType<typeof drizzle>

// Rolling window: how far back to count extractions when computing usage.
// 30 days expressed in milliseconds.
export const USAGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

// Resolve the catalogue's default product (Free). We look it up by the
// `is_default` flag rather than hard-coding the slug so the marketing team
// can move the default tier later without a code change.
export async function getDefaultProduct(db: Db) {
    const [row] = await db
        .select()
        .from(products)
        .where(and(eq(products.isDefault, true), eq(products.status, 'active')))
        .limit(1)
    return row ?? null
}

// Resolve the product currently assigned to a user, falling back to the
// default product if the column is NULL (legacy rows pre-migration). Returns
// `null` only when no products exist at all — a misconfigured install.
export async function getUserProduct(db: Db, userId: number) {
    const [row] = await db
        .select({ product: products })
        .from(users)
        .leftJoin(products, eq(users.productId, products.id))
        .where(eq(users.id, userId))
        .limit(1)

    if (row?.product) return row.product
    return getDefaultProduct(db)
}

export type Usage = {
    creditsUsed: number
    // null = unlimited
    creditsLimit: number | null
    // ISO timestamps so the client can render human-friendly dates without
    // worrying about the server's epoch format.
    periodStart: string
    periodEnd: string
    percentUsed: number | null
    remaining: number | null
}

// Count successful extraction _attempts_ in the rolling window. We count any
// extraction that wasn't rejected at validation time (so `error` rows still
// consume credit — they cost AI tokens) but exclude rows that never got past
// the credit check itself.
export async function getUsage(
    db: Db,
    userId: number,
    monthlyExtractionCredits: number | null
): Promise<Usage> {
    const now = Date.now()
    const windowStart = now - USAGE_WINDOW_MS

    const [{ value: used }] = await db
        .select({ value: count() })
        .from(extractions)
        .where(and(eq(extractions.userId, userId), gte(extractions.createdAt, windowStart)))

    const limit = monthlyExtractionCredits
    const remaining = limit === null ? null : Math.max(0, limit - used)
    const percent = limit === null ? null : Math.min(100, Math.round((used / Math.max(1, limit)) * 100))

    return {
        creditsUsed: used,
        creditsLimit: limit,
        periodStart: new Date(windowStart).toISOString(),
        periodEnd: new Date(now).toISOString(),
        percentUsed: percent,
        remaining
    }
}

// Hard check before kicking off an extraction. Returns `null` if the user is
// allowed to proceed, otherwise an explanation suitable for the API response.
export async function assertExtractionAllowed(
    db: Db,
    userId: number
): Promise<
    | { allowed: true; product: typeof products.$inferSelect; usage: Usage }
    | { allowed: false; product: typeof products.$inferSelect; usage: Usage; message: string }
> {
    const product = await getUserProduct(db, userId)
    if (!product) {
        // No products in catalogue at all — fail closed rather than silently
        // letting unlimited extractions through.
        throw new Error('No products configured')
    }

    const usage = await getUsage(db, userId, product.monthlyExtractionCredits)

    if (product.monthlyExtractionCredits === null) {
        return { allowed: true, product, usage }
    }

    if (usage.creditsUsed >= product.monthlyExtractionCredits) {
        return {
            allowed: false,
            product,
            usage,
            message: `Extraction credit limit reached (${product.monthlyExtractionCredits} per 30 days on the ${product.name} plan).`
        }
    }

    return { allowed: true, product, usage }
}

// Public catalogue listing — products in display order with their prices
// nested. Archived products and prices are filtered out so the marketing
// surface only shows what's currently sellable.
export async function listCatalogue(db: Db) {
    const productRows = await db
        .select()
        .from(products)
        .where(eq(products.status, 'active'))
        .orderBy(products.sortOrder)

    if (productRows.length === 0) return []

    const priceRows = await db
        .select()
        .from(prices)
        .where(eq(prices.status, 'active'))
        .orderBy(desc(prices.amount))

    const byProduct = new Map<number, (typeof prices.$inferSelect)[]>()
    for (const p of priceRows) {
        const list = byProduct.get(p.productId) ?? []
        list.push(p)
        byProduct.set(p.productId, list)
    }

    return productRows.map((p) => ({
        ...p,
        prices: byProduct.get(p.id) ?? []
    }))
}
