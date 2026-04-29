import { drizzle } from 'drizzle-orm/d1'
import { and, eq, gte, sql } from 'drizzle-orm'
import { apiTokens, apiTokenUsageDaily } from '@/db/schema'

type Db = ReturnType<typeof drizzle>

// Identifies a token as one we issued. Stripe-style live/test split is left
// for later (would be `dvop_test_` for sandbox keys); for now everything is
// live.
export const API_TOKEN_PREFIX = 'dvop_live_'

// 16 bytes of entropy → 32 hex chars after the prefix. Matches the strength
// of the refresh token (also 256-bit) without being unwieldy to copy.
const TOKEN_BODY_BYTES = 16

// Display prefix kept on the row: full prefix + first 4 hex of the secret.
// Long enough for users to disambiguate tokens in a list, short enough that
// the body remains effectively random.
const DISPLAY_PREFIX_LEN = API_TOKEN_PREFIX.length + 4

export type GeneratedToken = {
    plaintext: string
    prefix: string
    tokenHash: string
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(input: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return bytesToHex(new Uint8Array(buf))
}

// Mint a fresh token. Returns the plaintext (returned to the caller exactly
// once) plus the values to persist.
export async function generateApiToken(): Promise<GeneratedToken> {
    const bytes = new Uint8Array(TOKEN_BODY_BYTES)
    crypto.getRandomValues(bytes)
    const plaintext = `${API_TOKEN_PREFIX}${bytesToHex(bytes)}`
    const prefix = plaintext.slice(0, DISPLAY_PREFIX_LEN)
    const tokenHash = await sha256Hex(plaintext)
    return { plaintext, prefix, tokenHash }
}

export async function hashApiToken(plaintext: string): Promise<string> {
    return sha256Hex(plaintext)
}

// Cheap shape check before hitting the DB — rejects malformed tokens at the
// edge so we don't waste a query on every random bearer string.
export function looksLikeApiToken(token: string): boolean {
    if (!token.startsWith(API_TOKEN_PREFIX)) return false
    const body = token.slice(API_TOKEN_PREFIX.length)
    if (body.length !== TOKEN_BODY_BYTES * 2) return false
    return /^[a-f0-9]+$/i.test(body)
}

// Status returned by `verifyApiToken`. `userId` is set only when `valid`
// is true; the `reason` codes give the middleware enough context to render
// a useful 401.
export type VerificationResult =
    | { valid: true; tokenId: number; userId: number }
    | { valid: false; reason: 'malformed' | 'unknown' | 'revoked' | 'expired' }

export async function verifyApiToken(db: Db, plaintext: string): Promise<VerificationResult> {
    if (!looksLikeApiToken(plaintext)) {
        return { valid: false, reason: 'malformed' }
    }

    const tokenHash = await sha256Hex(plaintext)

    const [row] = await db
        .select({
            id: apiTokens.id,
            userId: apiTokens.userId,
            expiresAt: apiTokens.expiresAt,
            revokedAt: apiTokens.revokedAt
        })
        .from(apiTokens)
        .where(eq(apiTokens.tokenHash, tokenHash))
        .limit(1)

    if (!row) return { valid: false, reason: 'unknown' }
    if (row.revokedAt !== null) return { valid: false, reason: 'revoked' }
    if (row.expiresAt !== null && row.expiresAt < Date.now()) {
        return { valid: false, reason: 'expired' }
    }

    return { valid: true, tokenId: row.id, userId: row.userId }
}

// Bump the at-a-glance counters and the per-day rollup. Designed to run
// inside `c.executionCtx.waitUntil` so it never adds latency to the request
// it's measuring.
export async function recordTokenUsage(db: Db, tokenId: number): Promise<void> {
    const now = Date.now()
    // Floor to the start of the UTC day so all calls in the same day land
    // in the same bucket regardless of when they arrive.
    const day = Math.floor(now / 86_400_000) * 86_400_000

    await Promise.all([
        db
            .update(apiTokens)
            .set({ lastUsedAt: now, callCount: sql`${apiTokens.callCount} + 1` })
            .where(eq(apiTokens.id, tokenId)),
        db
            .insert(apiTokenUsageDaily)
            .values({ tokenId, day, count: 1 })
            .onConflictDoUpdate({
                target: [apiTokenUsageDaily.tokenId, apiTokenUsageDaily.day],
                set: { count: sql`${apiTokenUsageDaily.count} + 1` }
            })
    ])
}

// Last 30 days of per-bucket counts for one token, oldest first. The query
// returns sparse data (days with zero calls aren't persisted); callers can
// densify for charting if needed.
export async function getTokenDailyUsage(db: Db, tokenId: number) {
    const now = Date.now()
    const since = now - 30 * 86_400_000

    const rows = await db
        .select({ day: apiTokenUsageDaily.day, count: apiTokenUsageDaily.count })
        .from(apiTokenUsageDaily)
        .where(
            and(eq(apiTokenUsageDaily.tokenId, tokenId), gte(apiTokenUsageDaily.day, since))
        )
        .orderBy(apiTokenUsageDaily.day)

    return rows
}
