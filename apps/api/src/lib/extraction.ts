import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { documents, extractions, templates } from '@/db/schema'

type TemplateField = {
    key: string
    label: string
    type: string
    required?: boolean
    description?: string
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return btoa(binary)
}

// Extract a balanced `{...}` block from `text` starting at `from` using a
// linear scan with a brace-depth counter. Replaces the previous greedy regex
// (`/\{[\s\S]*\}/`) which could trigger catastrophic backtracking on inputs
// without a closing brace.
function findJsonObject(text: string, from = 0): string | null {
    const start = text.indexOf('{', from)
    if (start === -1) return null

    let depth = 0
    let inString = false
    let escape = false

    for (let i = start; i < text.length; i++) {
        const ch = text[i]

        if (escape) {
            escape = false
            continue
        }
        if (ch === '\\') {
            escape = true
            continue
        }
        if (ch === '"') {
            inString = !inString
            continue
        }
        if (inString) continue

        if (ch === '{') depth++
        else if (ch === '}') {
            depth--
            if (depth === 0) return text.slice(start, i + 1)
        }
    }
    return null
}

// Cap the input we scan to bound the worst-case work per extraction.
const MAX_PARSE_LEN = 200_000

function parseJsonFromText(rawText: string): unknown {
    const text = rawText.length > MAX_PARSE_LEN ? rawText.slice(0, MAX_PARSE_LEN) : rawText

    // 1. Markdown code fence: ```json\n...\n``` or ```\n...\n```
    const fenceStart = text.indexOf('```')
    if (fenceStart !== -1) {
        const afterOpen = fenceStart + 3
        const newline = text.indexOf('\n', afterOpen)
        // Skip an optional language tag (max 20 chars) on the opening fence.
        const contentStart =
            newline !== -1 && newline - afterOpen < 20 ? newline + 1 : afterOpen
        const fenceEnd = text.indexOf('```', contentStart)
        if (fenceEnd !== -1) {
            return JSON.parse(text.slice(contentStart, fenceEnd).trim())
        }
    }

    // 2. First balanced `{...}` block
    const block = findJsonObject(text)
    if (block) return JSON.parse(block)

    // 3. Fallback: parse the entire string
    return JSON.parse(text.trim())
}

export async function processExtraction(
    env: CloudflareBindings,
    extractionId: number,
    doc: typeof documents.$inferSelect,
    template: typeof templates.$inferSelect
): Promise<void> {
    const db = drizzle(env.DB)

    try {
        await db.update(extractions).set({ status: 'processing' }).where(eq(extractions.id, extractionId))

        const obj = await env.BUCKET.get(doc.filePath)
        if (!obj) throw new Error('File not found in storage')

        const base64 = arrayBufferToBase64(await obj.arrayBuffer())

        const fields = JSON.parse(template.schema) as TemplateField[]
        const schemaLines = fields
            .map((f) =>
                `- "${f.key}" (${f.label}): ${f.type}${f.required ? ' [required]' : ''}${f.description ? ` — ${f.description}` : ''}`
            )
            .join('\n')

        const isImage = doc.mimeType.startsWith('image/')
        const isPDF = doc.mimeType === 'application/pdf'

        type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

        const fileContent = isImage
            ? { type: 'image', source: { type: 'base64', media_type: doc.mimeType as ImageMediaType, data: base64 } }
            : isPDF
              ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
              : null

        if (!fileContent) throw new Error('Unsupported file type for extraction')

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: [
                            fileContent,
                            {
                                type: 'text',
                                text: `Extract the following fields from this document and return a JSON object:\n\n${schemaLines}\n\nReturn ONLY a valid JSON object with the field keys as properties. Use null for any field not found in the document.`
                            }
                        ]
                    }
                ]
            })
        })

        if (!response.ok) {
            throw new Error(`AI API error ${response.status}: ${await response.text()}`)
        }

        const aiResult = await response.json<{ content: Array<{ type: string; text: string }> }>()
        const text = aiResult.content.find((c) => c.type === 'text')?.text ?? '{}'
        const result = parseJsonFromText(text)

        await db
            .update(extractions)
            .set({ status: 'done', result: JSON.stringify(result) })
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
