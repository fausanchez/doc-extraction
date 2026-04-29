// Public contract for any extraction provider. Each implementation reads a
// document's bytes + a list of fields to extract and returns a parsed JSON
// object that matches the requested shape.
//
// To add a new provider:
//   1. Create `providers/<name>.ts` exporting an `ExtractionProvider`.
//   2. Register it in `registry.ts` under a stable id.
//   3. Set `EXTRACTION_PROVIDER=<id>` in wrangler vars to select it.

// Mirror of the on-disk template field shape. Kept here so providers don't
// have to import from the DB schema layer.
export type ExtractionField = {
    key: string
    label: string
    type: string
    required?: boolean
    description?: string
}

export type ExtractionInput = {
    file: {
        bytes: ArrayBuffer
        mimeType: string
        name: string
    }
    schema: ExtractionField[]
}

export type ExtractionOutput = {
    // Parsed JSON object that matches the requested schema.
    result: unknown
    // Raw text the provider returned, kept for debugging / observability.
    // Implementations should strip secrets before populating this.
    rawText?: string
    // Optional usage metadata for billing / quotas. Both fields nullable
    // because not every provider exposes both.
    tokensUsed?: { input?: number; output?: number }
}

export interface ExtractionProvider {
    /** Stable identifier used by the registry (e.g. `'anthropic'`). */
    readonly id: string
    /**
     * True when every credential / config var this provider needs is present
     * in `env`. The registry calls this before dispatching so a misconfigured
     * provider fails loudly instead of returning a half-formed result.
     */
    isConfigured(env: CloudflareBindings): boolean
    /**
     * Run the extraction. Implementations should throw on transport / API
     * errors; the orchestrator catches and persists the failure on the
     * extraction row.
     */
    extract(input: ExtractionInput, env: CloudflareBindings): Promise<ExtractionOutput>
}
