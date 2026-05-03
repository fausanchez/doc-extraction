import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { documents, extractions, templates } from '@/db/schema'
import { selectProvider } from './registry'
import type { ExtractionField } from './types'

export type { ExtractionField, ExtractionInput, ExtractionOutput, ExtractionProvider } from './types'
export { selectProvider, listProviders } from './registry'

// Orchestrates an extraction:
//   1. Mark the row `processing`.
//   2. Pull the source bytes from R2.
//   3. Hand off to the configured provider.
//   4. Persist `result` + flip status to `done`, or capture the failure
//      message on `error`.
//
// The function never throws — every failure path lands as an `error` row so
// the caller (which runs us via `executionCtx.waitUntil`) sees a clean
// promise.
// Cloudflare Workers have a 30 s wall-clock limit on paid plans. Leave 5 s of
// headroom for DB writes and error handling after the LLM call returns.
const EXTRACTION_TIMEOUT_MS = 25_000

export async function processExtraction(
    env: CloudflareBindings,
    extractionId: number,
    doc: typeof documents.$inferSelect,
    template: typeof templates.$inferSelect
): Promise<void> {
    const db = drizzle(env.DB)

    try {
        await db
            .update(extractions)
            .set({ status: 'processing' })
            .where(eq(extractions.id, extractionId))

        const obj = await env.BUCKET.get(doc.filePath)
        if (!obj) throw new Error('File not found in storage')

        const fields = JSON.parse(template.schema) as ExtractionField[]
        const provider = selectProvider(env)

        const extractionCall = provider.extract(
            {
                file: {
                    bytes: await obj.arrayBuffer(),
                    mimeType: doc.mimeType,
                    name: doc.name
                },
                schema: fields
            },
            env
        )

        const timeoutRace = new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new Error(`Extraction timed out after ${EXTRACTION_TIMEOUT_MS / 1000}s`)),
                EXTRACTION_TIMEOUT_MS
            )
        )

        const output = await Promise.race([extractionCall, timeoutRace])

        const resultJson = JSON.stringify(output.result)
        if (resultJson.length > 1_000_000) {
            throw new Error('Extraction result exceeds the maximum allowed size (1 MB)')
        }

        await db
            .update(extractions)
            .set({ status: 'done', result: resultJson })
            .where(eq(extractions.id, extractionId))

        await db.update(documents).set({ status: 'done' }).where(eq(documents.id, doc.id))
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Extraction failed'
        await db
            .update(extractions)
            .set({ status: 'error', errorMessage: message })
            .where(eq(extractions.id, extractionId))
        await db.update(documents).set({ status: 'error' }).where(eq(documents.id, doc.id))
    }
}
