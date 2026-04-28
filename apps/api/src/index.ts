import { Hono } from 'hono'
import { cors } from 'hono/cors'
import router from './router'

const app = new Hono()

app.use(
    '*',
    cors({
        origin: (origin) => {
            return origin.includes('localhost') || origin.endsWith('.doc-extraction.com')
                ? origin
                : 'https://app.doc-extraction.com'
        },
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization']
    })
)

app.route('/', router)

export default { fetch: app.fetch }
