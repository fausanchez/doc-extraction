// Tolerant JSON extractor used to lift a structured payload out of an LLM's
// free-form response. Any provider whose model returns text-with-embedded-JSON
// can pipe its output through here.
//
// Implementation notes:
// - Bounded input (200 KB cap) avoids worst-case scanning on adversarial
//   responses.
// - Brace-balancing scanner replaces `/\{[\s\S]*\}/`, which used to trigger
//   catastrophic backtracking on inputs that contained an opening brace but
//   no matching close.

const MAX_PARSE_LEN = 200_000

// Find the first balanced `{...}` block starting at `from` using a linear
// scan. Returns the matched substring or `null` when no balanced block exists
// in the remaining input.
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

export function parseJsonFromText(rawText: string): unknown {
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
