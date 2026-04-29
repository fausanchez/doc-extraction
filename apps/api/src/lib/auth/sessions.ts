import { drizzle } from 'drizzle-orm/d1'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { sessions, users } from '@/db/schema'
import { ACCESS_TOKEN_TTL_SECONDS, generateAccessToken } from '@/lib/utils'

export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

type Db = ReturnType<typeof drizzle>

// SHA-256 of `input`, hex-encoded. Used to derive a deterministic lookup key
// for refresh tokens without ever storing the secret itself.
async function sha256Hex(input: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(byteLength: number): string {
    const bytes = new Uint8Array(byteLength)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export type IssuedTokens = {
    accessToken: string
    accessTokenExpiresIn: number
    refreshToken: string
    refreshTokenExpiresIn: number
}

// Mint a new access + refresh pair tied to a fresh `sessions` row.
export async function createSession(
    db: Db,
    userId: number,
    role: string,
    secret: string
): Promise<IssuedTokens> {
    const sessionId = crypto.randomUUID()
    const refreshToken = randomHex(32)
    const tokenHash = await sha256Hex(refreshToken)
    const expiresAt = Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000

    await db.insert(sessions).values({
        id: sessionId,
        userId,
        tokenHash,
        expiresAt
    })

    const accessToken = await generateAccessToken(userId, sessionId, role, secret)

    return {
        accessToken,
        accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshToken,
        refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SECONDS
    }
}

// Rotate refresh token: lookup by hash, validate, mark old session revoked,
// issue a fresh pair. Reuse of an already-rotated refresh token returns null
// (the new chain has already replaced this row) so monitoring catches it
// instead of silently extending a leaked token.
export async function rotateSession(
    db: Db,
    refreshToken: string,
    secret: string
): Promise<IssuedTokens | null> {
    const tokenHash = await sha256Hex(refreshToken)
    const now = Date.now()

    const [row] = await db
        .select({ id: sessions.id, userId: sessions.userId, role: users.role })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(
            and(
                eq(sessions.tokenHash, tokenHash),
                isNull(sessions.revokedAt),
                gt(sessions.expiresAt, now)
            )
        )
        .limit(1)

    if (!row) return null

    // Mark this session revoked atomically — the `isNull` guard prevents two
    // concurrent rotations using the same row.
    const revokeResult = await db
        .update(sessions)
        .set({ revokedAt: now })
        .where(and(eq(sessions.id, row.id), isNull(sessions.revokedAt)))
        .returning({ id: sessions.id })

    if (revokeResult.length === 0) return null

    return createSession(db, row.userId, row.role, secret)
}

// Revoke a refresh token (server-side logout). Idempotent: revoking an already
// revoked token returns true so retries on the client are safe.
export async function revokeSession(db: Db, refreshToken: string): Promise<boolean> {
    const tokenHash = await sha256Hex(refreshToken)
    const result = await db
        .update(sessions)
        .set({ revokedAt: Date.now() })
        .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
        .returning({ id: sessions.id })

    return result.length > 0
}

// Revoke a session by its id (used when an access token is decoded but the
// underlying refresh row no longer exists or was revoked).
export async function revokeSessionById(db: Db, sessionId: string): Promise<void> {
    await db
        .update(sessions)
        .set({ revokedAt: Date.now() })
        .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
}
