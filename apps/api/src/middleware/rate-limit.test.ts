import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { keyByIp, keyByUser, rateLimit, type RateLimit } from './rate-limit'

function buildApp(binding: RateLimit | undefined, getKey = () => 'k') {
    const app = new Hono()
    app.use('*', rateLimit(() => binding as RateLimit, getKey))
    app.get('/', (c) => c.json({ ok: true }))
    return app
}

describe('rateLimit middleware', () => {
    it('fails open when no binding is provided (local dev)', async () => {
        const app = buildApp(undefined)
        const res = await app.request('/')
        expect(res.status).toBe(200)
        await expect(res.json()).resolves.toEqual({ ok: true })
    })

    it('passes through when the binding allows the request', async () => {
        const limit = vi.fn().mockResolvedValue({ success: true })
        const app = buildApp({ limit })
        const res = await app.request('/')
        expect(res.status).toBe(200)
        expect(limit).toHaveBeenCalledTimes(1)
    })

    it('returns 429 with Retry-After when the binding refuses', async () => {
        const limit = vi.fn().mockResolvedValue({ success: false })
        const app = buildApp({ limit })
        const res = await app.request('/')
        expect(res.status).toBe(429)
        expect(res.headers.get('retry-after')).toBe('60')
        await expect(res.json()).resolves.toMatchObject({ error: true, message: 'Too many requests' })
    })

    it('forwards the configured key to the binding', async () => {
        const limit = vi.fn().mockResolvedValue({ success: true })
        const app = buildApp({ limit }, () => 'user:123')
        await app.request('/')
        expect(limit).toHaveBeenCalledWith({ key: 'user:123' })
    })
})

describe('keyByIp', () => {
    function ctx(headers: Record<string, string>) {
        return { req: { header: (h: string) => headers[h.toLowerCase()] } } as Parameters<typeof keyByIp>[0]
    }

    it('prefers cf-connecting-ip', () => {
        expect(keyByIp(ctx({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1')
    })

    it('falls back to the first hop in x-forwarded-for', () => {
        expect(keyByIp(ctx({ 'x-forwarded-for': '3.3.3.3, 4.4.4.4' }))).toBe('3.3.3.3')
    })

    it('returns "local" when no IP headers are present', () => {
        expect(keyByIp(ctx({}))).toBe('local')
    })
})

describe('keyByUser', () => {
    function ctx(userId: number | undefined, headers: Record<string, string> = {}) {
        return {
            get: (k: string) => (k === 'userId' ? userId : undefined),
            req: { header: (h: string) => headers[h.toLowerCase()] }
        } as unknown as Parameters<typeof keyByUser>[0]
    }

    it('uses u:<id> when a user is authenticated', () => {
        expect(keyByUser(ctx(42))).toBe('u:42')
    })

    it('falls back to ip:<ip> when no user is set', () => {
        expect(keyByUser(ctx(undefined, { 'cf-connecting-ip': '1.1.1.1' }))).toBe('ip:1.1.1.1')
    })
})
