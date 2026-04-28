import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { users } from '@/db/schema'
import { HTTPException } from 'hono/http-exception'

type GoogleIdTokenPayload = {
    iss: string
    sub: string
    aud: string
    email: string
    email_verified: boolean | string
    name?: string
    picture?: string
    exp: number
    iat: number
}

export async function exchangeGoogleCode(code: string, env: CloudflareBindings): Promise<string> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: 'postmessage',
            grant_type: 'authorization_code'
        })
    })

    if (!tokenRes.ok) {
        throw new HTTPException(401, { message: 'Invalid Google code' })
    }

    const tokenData = await tokenRes.json<{ id_token?: string }>()
    if (!tokenData.id_token) {
        throw new HTTPException(401, { message: 'Invalid Google response' })
    }

    return tokenData.id_token
}

// JWKS cache shared across requests within an isolate. Honors Cache-Control:
// max-age from the JWKS response and falls back to one hour. Keys rotate
// rarely, so isolate-local memory is sufficient.
type Jwk = {
    kid: string
    kty: string
    n: string
    e: string
    alg?: string
    use?: string
}

let jwksCache: { keys: Jwk[]; expiresAt: number } | null = null

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_VALID_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com'])

async function fetchGoogleJwks(): Promise<Jwk[]> {
    if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys

    const res = await fetch(GOOGLE_JWKS_URL)
    if (!res.ok) {
        throw new HTTPException(503, { message: 'Failed to fetch Google JWKS' })
    }
    const body = (await res.json()) as { keys: Jwk[] }

    const cacheControl = res.headers.get('cache-control') ?? ''
    const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] ?? 3600)
    jwksCache = { keys: body.keys, expiresAt: Date.now() + maxAge * 1000 }

    return body.keys
}

function base64UrlToBytes(input: string): Uint8Array {
    const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
    const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
}

function base64UrlToJson<T>(input: string): T {
    const bytes = base64UrlToBytes(input)
    return JSON.parse(new TextDecoder().decode(bytes)) as T
}

async function importGoogleKey(jwk: Jwk): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'jwk',
        jwk as JsonWebKey,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
    )
}

// Verify a Google-issued ID token offline. Replaces the previous tokeninfo
// round-trip (deprecated, exposed token in URL → logs/referrers). Validates
// signature against Google's published JWKS plus iss / aud / exp / email
// verification per the OpenID Connect spec.
export async function verifyGoogleIdToken(
    idToken: string,
    env: CloudflareBindings
): Promise<GoogleIdTokenPayload> {
    const parts = idToken.split('.')
    if (parts.length !== 3) {
        throw new HTTPException(401, { message: 'Malformed Google token' })
    }
    const [headerSeg, payloadSeg, signatureSeg] = parts as [string, string, string]

    type Header = { alg: string; kid: string; typ?: string }
    let header: Header
    let payload: GoogleIdTokenPayload
    try {
        header = base64UrlToJson<Header>(headerSeg)
        payload = base64UrlToJson<GoogleIdTokenPayload>(payloadSeg)
    } catch {
        throw new HTTPException(401, { message: 'Invalid Google token' })
    }

    if (header.alg !== 'RS256') {
        throw new HTTPException(401, { message: 'Unsupported token algorithm' })
    }

    const keys = await fetchGoogleJwks()
    const jwk = keys.find((k) => k.kid === header.kid)
    if (!jwk) {
        throw new HTTPException(401, { message: 'Unknown signing key' })
    }

    const cryptoKey = await importGoogleKey(jwk)
    const signedData = new TextEncoder().encode(`${headerSeg}.${payloadSeg}`)
    const signature = base64UrlToBytes(signatureSeg)

    const valid = await crypto.subtle.verify(
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        cryptoKey,
        signature,
        signedData
    )
    if (!valid) {
        throw new HTTPException(401, { message: 'Invalid token signature' })
    }

    if (!GOOGLE_VALID_ISSUERS.has(payload.iss)) {
        throw new HTTPException(401, { message: 'Invalid token issuer' })
    }
    if (payload.aud !== env.GOOGLE_CLIENT_ID) {
        throw new HTTPException(401, { message: 'Token audience mismatch' })
    }
    // 60s leeway for clock skew between this Worker isolate and Google.
    if (payload.exp * 1000 < Date.now() - 60_000) {
        throw new HTTPException(401, { message: 'Token expired' })
    }
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
        throw new HTTPException(401, { message: 'Google email not verified' })
    }

    return payload
}

export async function upsertGoogleUser(db: ReturnType<typeof drizzle>, payload: GoogleIdTokenPayload) {
    const existing = await db.select().from(users).where(eq(users.email, payload.email)).limit(1)

    if (existing.length > 0) {
        const [user] = await db
            .update(users)
            .set({
                name: payload.name ?? existing[0]!.name,
                avatar: payload.picture ?? existing[0]!.avatar
            })
            .where(eq(users.email, payload.email))
            .returning()
        return user!
    }

    const [user] = await db
        .insert(users)
        .values({
            email: payload.email,
            name: payload.name ?? '',
            avatar: payload.picture ?? '',
            provider: 'google',
            providerId: payload.sub
        })
        .returning()
    return user!
}
