import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { users } from '@/db/schema'
import { HTTPException } from 'hono/http-exception'

type GoogleIdTokenPayload = {
    sub: string
    email: string
    email_verified: string
    name?: string
    picture?: string
    aud: string
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

export async function verifyGoogleIdToken(
    idToken: string,
    env: CloudflareBindings
): Promise<GoogleIdTokenPayload> {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`)

    if (!res.ok) {
        throw new HTTPException(401, { message: 'Invalid Google token' })
    }

    const payload = await res.json<GoogleIdTokenPayload>()

    if (payload.aud !== env.GOOGLE_CLIENT_ID) {
        throw new HTTPException(401, { message: 'Invalid Google token' })
    }

    if (payload.email_verified !== 'true') {
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
