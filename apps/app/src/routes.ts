import { ErrorBoundary } from './app/error-boundary/error-boundary'
import { route as apiTokensRoute } from './app/api-tokens/route'
import { route as billingRoute } from './app/billing/route'
import { route as dashboardRoute } from './app/dashboard/route'
import { route as documentsRoute } from './app/documents/route'
import { route as extractionsRoute } from './app/extractions/route'
import { route as layoutRoute } from './app/layout/route'
import { route as loginRoute } from './app/login/route'
import { route as notFoundRoute } from './app/not-found/route'
import { route as publicLayoutRoute } from './app/public-layout/route'
import { route as profileRoute } from './app/profile/route'
import { route as templatesRoute } from './app/templates/route'
import { route as templateDetailRoute } from './app/templates/detail-route'
import { redirect } from 'react-router'
import { urlDashboard } from './urls'
import type { RouteObject } from 'react-router'

export const routes: RouteObject[] = [
    {
        path: '/',
        loader: () => redirect(urlDashboard())
    },
    {
        ...publicLayoutRoute,
        ErrorBoundary,
        children: [loginRoute]
    },
    {
        ...layoutRoute,
        ErrorBoundary,
        children: [
            dashboardRoute,
            documentsRoute,
            templatesRoute,
            templateDetailRoute,
            extractionsRoute,
            apiTokensRoute,
            billingRoute,
            profileRoute
        ]
    },
    notFoundRoute
]
