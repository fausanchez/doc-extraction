import { Hono } from 'hono'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users } from '@/db/schema'
import { authMiddleware } from '@/middleware/auth'
import { zValidator } from '@/lib/utils'

const router = new Hono<{
    Bindings: CloudflareBindings
    Variables: { userId: number; sessionId: string; role: string }
}>()

router.use('*', authMiddleware)

const feedbackSchema = z.object({
    message: z.string().min(1).max(2000),
    category: z.enum(['bug', 'feature', 'general']).default('general')
})

router.post('/', zValidator('json', feedbackSchema), async (c) => {
    const userId = c.get('userId')
    const { message, category } = c.req.valid('json')

    // Resolve user email for the Slack notification
    const db = drizzle(c.env.DB)
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
    const userLabel = user?.email ?? `User #${userId}`

    const categoryEmoji: Record<string, string> = {
        bug: '🐛',
        feature: '✨',
        general: '💬'
    }
    const emoji = categoryEmoji[category] ?? '💬'

    if (c.env.SLACK_WEBHOOK_URL) {
        const payload = {
            blocks: [
                {
                    type: 'header',
                    text: { type: 'plain_text', text: `${emoji} New feedback — dvop.io` }
                },
                {
                    type: 'section',
                    fields: [
                        { type: 'mrkdwn', text: `*From:*\n${userLabel}` },
                        { type: 'mrkdwn', text: `*Category:*\n${category}` }
                    ]
                },
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `*Message:*\n${message}` }
                }
            ]
        }

        // Fire-and-forget — don't let a Slack outage fail the user's request
        c.executionCtx.waitUntil(
            fetch(c.env.SLACK_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(() => {})
        )
    }

    return c.json({ data: null, error: false })
})

export default router
