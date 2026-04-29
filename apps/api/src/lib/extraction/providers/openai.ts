import type {
    ExtractionField,
    ExtractionInput,
    ExtractionOutput,
    ExtractionProvider
} from '../types'
import { arrayBufferToBase64 } from '../bytes'

// OpenAI Responses API — supports both image and PDF inputs natively, and
// returns guaranteed-valid JSON when given a `json_schema` text format.
// We map our `ExtractionField[]` to a strict JSON Schema so the provider
// hands back a parseable object with the exact keys the template defined.

const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_OUTPUT_TOKENS = 1024

type ResponsesAPIBody = {
    model: string
    input: Array<{
        role: 'user' | 'system' | 'assistant'
        content: ContentBlock[]
    }>
    text?: {
        format: {
            type: 'json_schema'
            name: string
            schema: Record<string, unknown>
            strict: boolean
        }
    }
    max_output_tokens?: number
}

type ContentBlock =
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url: string }
    | { type: 'input_file'; filename: string; file_data: string }

type ResponsesAPIResult = {
    output_text?: string
    output?: Array<{
        type: string
        content?: Array<{ type: string; text?: string }>
    }>
    usage?: {
        input_tokens?: number
        output_tokens?: number
    }
}

// Map an internal field type to the JSON Schema fragment OpenAI expects.
// `null` is included in every type union so the model can signal "not present
// in the document" without breaking strict-mode validation.
function fieldToJsonSchemaProperty(f: ExtractionField): Record<string, unknown> {
    const base: Record<string, unknown> = {
        description: f.description?.trim() || f.label
    }
    switch (f.type) {
        case 'number':
            return { ...base, type: ['number', 'null'] }
        case 'boolean':
            return { ...base, type: ['boolean', 'null'] }
        case 'date':
            return {
                ...base,
                type: ['string', 'null'],
                description: `${base.description} (ISO 8601 date)`
            }
        case 'array':
            // We don't know the item shape from the template, so let any value
            // through. Tighten this once templates support nested schemas.
            return { ...base, type: ['array', 'null'], items: {} }
        case 'string':
        default:
            return { ...base, type: ['string', 'null'] }
    }
}

// Build the strict JSON Schema body. OpenAI's strict mode requires every
// declared property to appear in `required` and `additionalProperties: false`
// at the root — optionality is encoded via the `["type", "null"]` union above.
function buildJsonSchema(schema: ExtractionField[]): Record<string, unknown> {
    const properties: Record<string, unknown> = {}
    const required: string[] = []

    for (const f of schema) {
        properties[f.key] = fieldToJsonSchemaProperty(f)
        required.push(f.key)
    }

    return {
        type: 'object',
        properties,
        required,
        additionalProperties: false
    }
}

function buildPrompt(schema: ExtractionField[]): string {
    const lines = schema
        .map(
            (f) =>
                `- "${f.key}" (${f.label}): ${f.type}${f.required ? ' [required]' : ''}${f.description ? ` — ${f.description}` : ''}`
        )
        .join('\n')

    return `Extract the following fields from this document:\n\n${lines}\n\nReturn null for any field not found in the document.`
}

function buildFileContent(file: ExtractionInput['file']): ContentBlock | null {
    const base64 = arrayBufferToBase64(file.bytes)
    if (file.mimeType.startsWith('image/')) {
        return {
            type: 'input_image',
            image_url: `data:${file.mimeType};base64,${base64}`
        }
    }
    if (file.mimeType === 'application/pdf') {
        return {
            type: 'input_file',
            filename: file.name,
            file_data: `data:application/pdf;base64,${base64}`
        }
    }
    return null
}

// Walk OpenAI's Responses output structure and extract the assistant's text.
// Prefer the convenience `output_text` field when the SDK populates it; fall
// back to walking the structured `output[].content[]` tree otherwise.
function readOutputText(result: ResponsesAPIResult): string | null {
    if (result.output_text) return result.output_text
    if (!result.output) return null
    for (const item of result.output) {
        if (item.type !== 'message' || !item.content) continue
        for (const block of item.content) {
            if (block.type === 'output_text' && block.text) return block.text
        }
    }
    return null
}

export const openaiProvider: ExtractionProvider = {
    id: 'openai',

    isConfigured(env) {
        return Boolean(env.OPENAI_API_KEY)
    },

    async extract({ file, schema }, env): Promise<ExtractionOutput> {
        const fileContent = buildFileContent(file)
        if (!fileContent) {
            throw new Error(
                `Unsupported file type for OpenAI provider: ${file.mimeType}`
            )
        }

        const body: ResponsesAPIBody = {
            model: env.OPENAI_MODEL ?? DEFAULT_MODEL,
            input: [
                {
                    role: 'user',
                    content: [fileContent, { type: 'input_text', text: buildPrompt(schema) }]
                }
            ],
            // Strict JSON Schema → guaranteed parseable response, no need for
            // the tolerant parser the Anthropic path uses.
            text: {
                format: {
                    type: 'json_schema',
                    name: 'extraction',
                    schema: buildJsonSchema(schema),
                    strict: true
                }
            },
            max_output_tokens: MAX_OUTPUT_TOKENS
        }

        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            throw new Error(
                `OpenAI API error ${response.status}: ${await response.text()}`
            )
        }

        const aiResult = (await response.json()) as ResponsesAPIResult
        const text = readOutputText(aiResult)
        if (!text) {
            throw new Error('OpenAI returned no text content')
        }

        // Strict JSON Schema mode guarantees the body is valid JSON; if it
        // isn't, that's a server-side breach of contract worth surfacing.
        const result = JSON.parse(text)

        return {
            result,
            rawText: text,
            tokensUsed: {
                input: aiResult.usage?.input_tokens,
                output: aiResult.usage?.output_tokens
            }
        }
    }
}
