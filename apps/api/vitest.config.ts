import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Vitest is run in plain Node — none of these tests touch Cloudflare-specific
// bindings (D1, R2, Workers Rate Limit). They cover pure helpers (token
// crypto, JWT) and middlewares wired to Hono with simple in-memory mocks.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts']
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    }
})
