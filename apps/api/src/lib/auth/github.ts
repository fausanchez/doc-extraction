import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { users } from '@/db/schema'
import { HTTPException } from 'hono/http-exception'

type GitHubUser = {
    id: number
    login: string
    name: string | null
    email: string | null
    avatar_url: string
}

type GitHubEmail = {
    email: string
    primary: boolean
    verified: boolean
}

export async function exchangeGitHubCode(code: string, env: CloudflareBindings): Promise<string> {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: `${env.APP_URL}/auth/github/callback`
        })
    })

    if (!tokenRes.ok) {
        throw new HTTPException(401, { message: 'Invalid GitHub code' })
    }

    const tokenData = await tokenRes.json<{ access_token?: string; error?: string }>()
    if (!tokenData.access_token) {
        throw new HTTPException(401, { message: tokenData.error ?? 'Invalid GitHub response' })
    }

    return tokenData.access_token
}

export async function getGitHubUser(accessToken: string): Promise<{ user: GitHubUser; email: string }> {
    const [userRes, emailsRes] = await Promise.all([
        fetch('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'doc-extraction' }
        }),
        fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'doc-extraction' }
        })
    ])

    if (!userRes.ok) {
        throw new HTTPException(401, { message: 'Failed to get GitHub user' })
    }

    const ghUser = await userRes.json<GitHubUser>()
    const emails = emailsRes.ok ? await emailsRes.json<GitHubEmail[]>() : []

    const primaryEmail =
        ghUser.email ??
        emails.find((e) => e.primary && e.verified)?.email ??
        emails.find((e) => e.verified)?.email

    if (!primaryEmail) {
        throw new HTTPException(401, { message: 'No verified email found in GitHub account' })
    }

    return { user: ghUser, email: primaryEmail }
}

export async function upsertGitHubUser(
    db: ReturnType<typeof drizzle>,
    ghUser: GitHubUser,
    email: string
) {
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)

    if (existing.length > 0) {
        const [user] = await db
            .update(users)
            .set({
                name: ghUser.name ?? existing[0]!.name,
                avatar: ghUser.avatar_url ?? existing[0]!.avatar
            })
            .where(eq(users.email, email))
            .returning()
        return user!
    }

    const [user] = await db
        .insert(users)
        .values({
            email,
            name: ghUser.name ?? ghUser.login,
            avatar: ghUser.avatar_url,
            provider: 'github',
            providerId: String(ghUser.id)
        })
        .returning()
    return user!
}
