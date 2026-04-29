// Generated/maintained alongside `wrangler.jsonc`. Run `pnpm cf-typegen` to
// regenerate from wrangler config; the rate-limit bindings below mirror the
// `unsafe.bindings` entries.

interface RateLimit {
    limit(options: { key: string }): Promise<{ success: boolean }>
}

interface CloudflareBindings {
    DB: D1Database
    BUCKET: R2Bucket

    // Rate limit bindings (see wrangler.jsonc → unsafe.bindings)
    AUTH_RATE_LIMITER: RateLimit
    UPLOAD_RATE_LIMITER: RateLimit
    EXTRACTION_RATE_LIMITER: RateLimit

    JWT_SECRET: string
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    GITHUB_CLIENT_ID: string
    GITHUB_CLIENT_SECRET: string
    APP_URL: string
    ANTHROPIC_API_KEY: string
}
