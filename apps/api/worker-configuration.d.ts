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

    // Slack Incoming Webhook for feedback notifications.
    // Set via: wrangler secret put SLACK_WEBHOOK_URL [--env develop|production]
    // When unset, feedback is accepted but not forwarded to Slack.
    SLACK_WEBHOOK_URL?: string

    // Extraction provider selector. Optional — defaults to `'anthropic'`
    // when unset. See `src/lib/extraction/registry.ts` for the registered
    // ids.
    EXTRACTION_PROVIDER?: string

    // Provider-specific credentials. Only the active provider needs its
    // credentials present at request time; the registry's `isConfigured`
    // check fails-fast on misconfiguration.
    ANTHROPIC_API_KEY: string
    OPENAI_API_KEY?: string
    // Optional model override for the openai provider (defaults to gpt-4o-mini).
    OPENAI_MODEL?: string

    // Sentry DSN for error tracking. Optional — when unset, errors are not forwarded.
    // Set via: wrangler secret put SENTRY_DSN [--env develop|production]
    SENTRY_DSN?: string
    // Deployment environment label surfaced in Sentry events (development | develop | production).
    ENVIRONMENT?: string

    // Paddle billing. Set via `wrangler secret put` — never commit plaintext values.
    // PADDLE_SECRET_KEY is the server-side API key for Paddle API calls.
    // PADDLE_WEBHOOK_SECRET is the endpoint secret used to verify webhook signatures.
    PADDLE_SECRET_KEY?: string
    PADDLE_WEBHOOK_SECRET?: string
}
