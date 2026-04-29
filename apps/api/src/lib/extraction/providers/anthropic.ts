import type {
    ExtractionInput,
    ExtractionOutput,
    ExtractionProvider
} from '../types'
import { arrayBufferToBase64 } from '../bytes'
import { parseJsonFromText } from '../parser'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

type AnthropicResponse = {
    content: Array<{ type: string; text?: string }>
    usage?: { input_tokens?: number; output_tokens?: number }
}

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

// Anthropic's Messages API content blocks. Images carry the raw mime type;
// PDFs always advertise `application/pdf` per the docs.
function buildFileContent(mimeType: string, base64: string) {
    if (mimeType.startsWith('image/')) {
        return {
            type: 'image' as const,
            source: {
                type: 'base64' as const,
                media_type: mimeType as ImageMediaType,
                data: base64
            }
        }
    }
    if (mimeType === 'application/pdf') {
        return {
            type: 'document' as const,
            source: {
                type: 'base64' as const,
                media_type: 'application/pdf' as const,
                data: base64
            }
        }
    }
    return null
}

function buildPrompt(schema: ExtractionInput['schema']): string {
    const lines = schema
        .map(
            (f) =>
                `- "${f.key}" (${f.label}): ${f.type}${f.required ? ' [required]' : ''}${f.description ? ` — ${f.description}` : ''}`
        )
        .join('\n')

    return `Extract the following fields from this document and return a JSON object:\n\n${lines}\n\nReturn ONLY a valid JSON object with the field keys as properties. Use null for any field not found in the document.`
}

export const anthropicProvider: ExtractionProvider = {
    id: 'anthropic',

    isConfigured(env) {
        return Boolean(env.ANTHROPIC_API_KEY)
    },

    async extract({ file, schema }, env): Promise<ExtractionOutput> {
        const fileContent = buildFileContent(file.mimeType, arrayBufferToBase64(file.bytes))
        if (!fileContent) {
            throw new Error(
                `Unsupported file type for Anthropic provider: ${file.mimeType}`
            )
        }

        const response = await fetch(ANTHROPIC_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: MAX_TOKENS,
                messages: [
                    {
                        role: 'user',
                        content: [
                            fileContent,
                            { type: 'text', text: buildPrompt(schema) }
                        ]
                    }
                ]
            })
        })

        if (!response.ok) {
            throw new Error(
                `Anthropic API error ${response.status}: ${await response.text()}`
            )
        }

        const aiResult = (await response.json()) as AnthropicResponse
        const text = aiResult.content.find((c) => c.type === 'text')?.text ?? '{}'
        const result = parseJsonFromText(text)

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
