// Sanitize a user-supplied filename before using it inside an R2 object key.
// Defends against path traversal (`../`), null bytes, oversized names, and
// noisy whitespace / control characters. Preserves the extension when present.
const MAX_BASE_LEN = 120
const MAX_EXT_LEN = 16

export function sanitizeFilename(input: string): string {
    const normalized = input.normalize('NFKC').trim()

    // Drop leading dots so a `.htaccess`-style name can't shadow hidden-file
    // semantics on any consumer that interprets them.
    const stripped = normalized.replace(/^\.+/, '')

    if (!stripped) return 'file'

    const lastDot = stripped.lastIndexOf('.')
    const hasExt = lastDot > 0 && lastDot < stripped.length - 1

    let base = hasExt ? stripped.slice(0, lastDot) : stripped
    let ext = hasExt ? stripped.slice(lastDot + 1) : ''

    // Allowlist: ASCII alphanumerics plus dot, dash and underscore. Anything
    // else (path separators, NUL, whitespace, unicode tricks) becomes `_`.
    base = base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, MAX_BASE_LEN)
    ext = ext.replace(/[^A-Za-z0-9]/g, '').slice(0, MAX_EXT_LEN).toLowerCase()

    if (!base || base === '.' || base === '..') base = 'file'

    return ext ? `${base}.${ext}` : base
}

// Build an R2 key. The userId prefix scopes the bucket per-tenant; the
// timestamp + random suffix prevents collisions on concurrent uploads of the
// same name within the same millisecond.
export function buildObjectKey(userId: number, originalFilename: string): string {
    const safe = sanitizeFilename(originalFilename)
    const suffix = randomToken(6)
    return `${userId}/${Date.now()}-${suffix}-${safe}`
}

function randomToken(length: number): string {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
