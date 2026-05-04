import * as Sentry from '@sentry/react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { routes } from './routes'
import './index.css'

const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
if (sentryDsn) {
    Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
        integrations: [Sentry.browserTracingIntegration()]
    })
}

const router = createBrowserRouter(routes)

const root = document.getElementById('root')

createRoot(root!).render(<RouterProvider router={router} />)
