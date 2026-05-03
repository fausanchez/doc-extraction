import { Dashboard } from './dashboard'
import { urlDashboard } from '@/urls'
import { documentsApi, extractionsApi, meApi, templatesApi, apiTokensApi } from '@/api-client'

export const route = {
    element: <Dashboard />,
    path: urlDashboard(),
    loader: async () => {
        try {
            const [docsPage, tmpsPage, extsPage, doneExtsPage, usageRes, tokensRes] =
                await Promise.all([
                    documentsApi.list({ limit: 1 }),
                    templatesApi.list({ limit: 1 }),
                    extractionsApi.list({ limit: 5 }),
                    extractionsApi.list({ status: 'done', limit: 1 }),
                    meApi.usage(),
                    apiTokensApi.list()
                ])

            const usage = usageRes.error ? null : (usageRes.data ?? null)
            const apiTokens = tokensRes.error ? [] : (tokensRes.data ?? [])

            return {
                stats: {
                    documents: docsPage.error ? 0 : docsPage.pagination.total,
                    templates: tmpsPage.error ? 0 : tmpsPage.pagination.total,
                    extractions: extsPage.error ? 0 : extsPage.pagination.total,
                    done: doneExtsPage.error ? 0 : doneExtsPage.pagination.total,
                    recentExtractions: extsPage.error ? [] : (extsPage.data ?? [])
                },
                onboarding: {
                    hasTemplate: !tmpsPage.error && tmpsPage.pagination.total > 0,
                    hasDocument: !docsPage.error && docsPage.pagination.total > 0,
                    hasExtraction: !extsPage.error && extsPage.pagination.total > 0,
                    hasApiToken: apiTokens.length > 0
                },
                usage
            }
        } catch {
            return {
                stats: { documents: 0, templates: 0, extractions: 0, done: 0, recentExtractions: [] },
                onboarding: { hasTemplate: false, hasDocument: false, hasExtraction: false, hasApiToken: false },
                usage: null
            }
        }
    },
    handle: {
        breadcrumb: []
    }
}
