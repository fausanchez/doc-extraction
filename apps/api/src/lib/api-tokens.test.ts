import { describe, it, expect } from 'vitest'
import {
    API_TOKEN_PREFIX,
    generateApiToken,
    hashApiToken,
    looksLikeApiToken,
    verifyApiToken
} from './api-tokens'

describe('looksLikeApiToken', () => {
    it('accepts a freshly minted token', async () => {
        const { plaintext } = await generateApiToken()
        expect(looksLikeApiToken(plaintext)).toBe(true)
    })

    it('rejects strings without the dvop_live_ prefix', () => {
        expect(looksLikeApiToken('Bearer xyz')).toBe(false)
        expect(looksLikeApiToken('sk-ant-abcdef')).toBe(false)
        expect(looksLikeApiToken('')).toBe(false)
    })

    it('rejects tokens whose body length is wrong', () => {
        expect(looksLikeApiToken(`${API_TOKEN_PREFIX}deadbeef`)).toBe(false)
        expect(looksLikeApiToken(`${API_TOKEN_PREFIX}${'a'.repeat(64)}`)).toBe(false)
    })

    it('rejects tokens whose body is not lowercase hex', () => {
        expect(looksLikeApiToken(`${API_TOKEN_PREFIX}${'g'.repeat(32)}`)).toBe(false)
        expect(looksLikeApiToken(`${API_TOKEN_PREFIX}${'!'.repeat(32)}`)).toBe(false)
    })
})

describe('generateApiToken', () => {
    it('produces a 32-hex-char body after the prefix', async () => {
        const { plaintext } = await generateApiToken()
        const body = plaintext.slice(API_TOKEN_PREFIX.length)
        expect(body).toMatch(/^[a-f0-9]{32}$/)
    })

    it('produces a stable display prefix matching the start of the plaintext', async () => {
        const { plaintext, prefix } = await generateApiToken()
        expect(plaintext.startsWith(prefix)).toBe(true)
        expect(prefix.length).toBe(API_TOKEN_PREFIX.length + 4)
    })

    it('returns a hash that matches hashApiToken(plaintext) — deterministic SHA-256', async () => {
        const { plaintext, tokenHash } = await generateApiToken()
        const recomputed = await hashApiToken(plaintext)
        expect(tokenHash).toBe(recomputed)
    })

    it('produces unique tokens across calls', async () => {
        const a = await generateApiToken()
        const b = await generateApiToken()
        expect(a.plaintext).not.toBe(b.plaintext)
        expect(a.tokenHash).not.toBe(b.tokenHash)
    })
})

// Minimal stub of the drizzle query builder chain used by verifyApiToken.
// Returning the configured row from `.limit()` is enough; the function only
// reads the four columns selected in the SELECT.
function fakeDb(row: unknown) {
    return {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: async () => (row ? [row] : [])
                })
            })
        })
    } as Parameters<typeof verifyApiToken>[0]
}

describe('verifyApiToken', () => {
    it('returns malformed for non-API-token strings without hitting the DB', async () => {
        const result = await verifyApiToken(fakeDb(null), 'not-a-token')
        expect(result).toEqual({ valid: false, reason: 'malformed' })
    })

    it('returns unknown when the hash does not match any row', async () => {
        const { plaintext } = await generateApiToken()
        const result = await verifyApiToken(fakeDb(null), plaintext)
        expect(result).toEqual({ valid: false, reason: 'unknown' })
    })

    it('returns revoked when revokedAt is set', async () => {
        const { plaintext } = await generateApiToken()
        const result = await verifyApiToken(
            fakeDb({ id: 1, userId: 42, expiresAt: null, revokedAt: Date.now() }),
            plaintext
        )
        expect(result).toEqual({ valid: false, reason: 'revoked' })
    })

    it('returns expired when expiresAt is in the past', async () => {
        const { plaintext } = await generateApiToken()
        const result = await verifyApiToken(
            fakeDb({ id: 1, userId: 42, expiresAt: Date.now() - 1, revokedAt: null }),
            plaintext
        )
        expect(result).toEqual({ valid: false, reason: 'expired' })
    })

    it('returns valid for an unrevoked, unexpired token', async () => {
        const { plaintext } = await generateApiToken()
        const result = await verifyApiToken(
            fakeDb({ id: 7, userId: 42, expiresAt: null, revokedAt: null }),
            plaintext
        )
        expect(result).toEqual({ valid: true, tokenId: 7, userId: 42 })
    })

    it('treats a future expiresAt as still valid', async () => {
        const { plaintext } = await generateApiToken()
        const result = await verifyApiToken(
            fakeDb({
                id: 7,
                userId: 42,
                expiresAt: Date.now() + 60_000,
                revokedAt: null
            }),
            plaintext
        )
        expect(result).toEqual({ valid: true, tokenId: 7, userId: 42 })
    })
})
