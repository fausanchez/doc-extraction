import { describe, it, expect } from 'vitest'
import { generateAccessToken, verifyAccessToken } from './utils'

const SECRET = 'a'.repeat(32) // matches the >=32 char check enforced at the request boundary

describe('generateAccessToken / verifyAccessToken', () => {
    it('round-trips the payload', async () => {
        const token = await generateAccessToken(42, 'sess-abc', 'user', SECRET)
        const decoded = await verifyAccessToken(token, SECRET)
        expect(decoded.sub).toBe(42)
        expect(decoded.sid).toBe('sess-abc')
        expect(decoded.role).toBe('user')
        expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it('rejects a token signed with a different secret', async () => {
        const token = await generateAccessToken(42, 'sess-abc', 'user', SECRET)
        await expect(verifyAccessToken(token, 'b'.repeat(32))).rejects.toBeDefined()
    })

    it('rejects a tampered payload', async () => {
        const token = await generateAccessToken(42, 'sess-abc', 'user', SECRET)
        // Flip a character in the payload section (segment 1) to invalidate the signature.
        const [header, payload, sig] = token.split('.')
        const tampered = [header, payload!.slice(0, -1) + (payload!.endsWith('A') ? 'B' : 'A'), sig].join('.')
        await expect(verifyAccessToken(tampered, SECRET)).rejects.toBeDefined()
    })

    it('rejects a malformed token', async () => {
        await expect(verifyAccessToken('not-a-jwt', SECRET)).rejects.toBeDefined()
    })
})
