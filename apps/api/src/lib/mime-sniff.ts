// Magic-byte detection for the file types we accept on upload. Trusting the
// browser-supplied Content-Type alone lets an attacker upload an executable
// disguised as a PDF; sniffing the first bytes pins the format to its real
// content.

export type SniffedMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | null

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] // "%PDF"
const JPEG_MAGIC = [0xff, 0xd8, 0xff]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46] // "RIFF" (offset 0)
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50] // "WEBP" (offset 8)

function startsWith(buf: Uint8Array, magic: number[], offset = 0): boolean {
    if (buf.length < offset + magic.length) return false
    for (let i = 0; i < magic.length; i++) {
        if (buf[offset + i] !== magic[i]) return false
    }
    return true
}

// Inspect the first 16 bytes and return the detected MIME, or null if the
// content doesn't match any of our allowed formats.
export function sniffMimeType(buf: Uint8Array): SniffedMime {
    if (startsWith(buf, PDF_MAGIC)) return 'application/pdf'
    if (startsWith(buf, JPEG_MAGIC)) return 'image/jpeg'
    if (startsWith(buf, PNG_MAGIC)) return 'image/png'
    if (startsWith(buf, RIFF_MAGIC) && startsWith(buf, WEBP_MAGIC, 8)) {
        return 'image/webp'
    }
    return null
}

// Read just enough leading bytes from a Blob/File to identify the format
// without loading the whole upload into memory.
export async function sniffFile(file: Blob): Promise<SniffedMime> {
    const head = await file.slice(0, 16).arrayBuffer()
    return sniffMimeType(new Uint8Array(head))
}
