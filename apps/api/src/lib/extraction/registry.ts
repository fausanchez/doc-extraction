import type { ExtractionProvider } from './types'
import { anthropicProvider } from './providers/anthropic'

// Registry of every extraction provider that ships in this build. The orchestrator
// looks up the provider whose id matches `env.EXTRACTION_PROVIDER` (default
// `'anthropic'`).
//
// To add a new provider:
//   1. Implement `ExtractionProvider` in `./providers/<id>.ts`.
//   2. Import + add it to this map under a stable id.
//   3. Set `EXTRACTION_PROVIDER=<id>` in `wrangler.jsonc` (or `.dev.vars`),
//      plus whatever credential env vars the provider needs.
const providers: Record<string, ExtractionProvider> = {
    anthropic: anthropicProvider
}

const DEFAULT_PROVIDER_ID = 'anthropic'

export function selectProvider(env: CloudflareBindings): ExtractionProvider {
    const id = env.EXTRACTION_PROVIDER ?? DEFAULT_PROVIDER_ID
    const provider = providers[id]

    if (!provider) {
        const known = Object.keys(providers).join(', ')
        throw new Error(
            `Unknown extraction provider "${id}". Registered providers: ${known}`
        )
    }

    if (!provider.isConfigured(env)) {
        throw new Error(
            `Extraction provider "${id}" is missing required credentials`
        )
    }

    return provider
}

// Listed providers — exposed for diagnostics / future admin UI.
export function listProviders(): string[] {
    return Object.keys(providers)
}
