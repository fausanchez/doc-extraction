// Chunked base64 encoder. The naive `btoa(String.fromCharCode(...bytes))`
// blows the call-stack on multi-MB uploads; chunking keeps memory bounded.
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return btoa(binary)
}
