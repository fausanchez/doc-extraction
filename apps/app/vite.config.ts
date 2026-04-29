import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: 5173
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    build: {
        // Never ship sourcemaps to production — they leak the original source
        // including JSDoc, comments and unstripped logic to anyone with the
        // browser dev tools open.
        sourcemap: false
    }
})
