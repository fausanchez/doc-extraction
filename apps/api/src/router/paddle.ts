import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { prices, users } from '@/db/schema'
import { getDefaultProduct } from '@/lib/products'

const router = new Hono<{ Bindings: CloudflareBindings }>()

// Verify the Paddle-Signature header using HMAC-SHA256.
// Paddle format: `ts=<unix>;h1=<hex-signature>`
// Signature input: `<ts>:<raw-body>`
async function verifyPaddleSignature(
    rawBody: string,
    signatureHeader: string | null,
    secret: string
): Promise<boolean> {
    if (!signatureHeader) return false

    const parts = Object.fromEntries(
        signatureHeader.split(';').map((p) => p.split('=') as [string, string])
    )
    const ts = parts['ts']
    const h1 = parts['h1']
    if (!ts || !h1) return false

    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )

    const computed = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(`${ts}:${rawBody}`)
    )

    const computedHex = Array.from(new Uint8Array(computed))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

    // Constant-time comparison to prevent timing attacks.
    if (computedHex.length !== h1.length) return false
    let diff = 0
    for (let i = 0; i < computedHex.length; i++) {
        diff |= computedHex.charCodeAt(i) ^ h1.charCodeAt(i)
    }
    return diff === 0
}

// Paddle sends webhooks for every subscription lifecycle event.
// We only process the three events that affect billing state:
//   subscription.activated  → user subscribed; upgrade product + store Paddle IDs
//   subscription.updated    → status change (past_due, paused, etc.)
//   subscription.canceled   → downgrade to free product
router.post('/webhook', async (c) => {
    const secret = c.env.PADDLE_WEBHOOK_SECRET
    if (!secret) {
        return c.json({ data: null, error: true, message: 'Paddle not configured' }, 503)
    }

    const rawBody = await c.req.text()
    const signature = c.req.header('Paddle-Signature') ?? null

    const valid = await verifyPaddleSignature(rawBody, signature, secret)
    if (!valid) {
        return c.json({ data: null, error: true, message: 'Invalid signature' }, 401)
    }

    let event: { event_type: string; data: Record<string, unknown> }
    try {
        event = JSON.parse(rawBody)
    } catch {
        return c.json({ data: null, error: true, message: 'Invalid JSON' }, 400)
    }

    const db = drizzle(c.env.DB)
    const { event_type: eventType, data } = event

    if (eventType === 'subscription.activated' || eventType === 'subscription.updated') {
        const subscriptionId = data['id'] as string
        const status = data['status'] as string
        const customerId = (data['customer'] as Record<string, string>)?.['id'] ?? null
        const rawCustomData = data['custom_data'] as Record<string, string> | null
        const userIdStr = rawCustomData?.['userId']
        const priceId = ((data['items'] as unknown[])?.[0] as Record<string, Record<string, string>>)?.['price']?.['id'] ?? null

        const userId = userIdStr ? parseInt(userIdStr, 10) : NaN
        if (!userId || isNaN(userId)) {
            // customData.userId is required; log and ignore rather than 500-ing
            // so Paddle doesn't retry indefinitely.
            return c.json({ data: null, error: false }, 200)
        }

        // Resolve our product from the Paddle price ID (only for activation).
        let productId: number | undefined
        if (eventType === 'subscription.activated' && priceId) {
            const [price] = await db
                .select({ productId: prices.productId })
                .from(prices)
                .where(eq(prices.providerPriceId, priceId))
                .limit(1)
            productId = price?.productId
        }

        await db
            .update(users)
            .set({
                ...(productId !== undefined ? { productId } : {}),
                ...(customerId ? { paddleCustomerId: customerId } : {}),
                paddleSubscriptionId: subscriptionId,
                paddleSubscriptionStatus: status
            })
            .where(eq(users.id, userId))
    } else if (eventType === 'subscription.canceled') {
        const subscriptionId = data['id'] as string

        const [user] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.paddleSubscriptionId, subscriptionId))
            .limit(1)

        if (user) {
            const freeProduct = await getDefaultProduct(db)
            await db
                .update(users)
                .set({
                    productId: freeProduct?.id ?? null,
                    paddleSubscriptionStatus: 'canceled'
                })
                .where(eq(users.id, user.id))
        }
    }

    // Always return 200 so Paddle doesn't retry unhandled event types.
    return c.json({ data: null, error: false }, 200)
})

export default router
