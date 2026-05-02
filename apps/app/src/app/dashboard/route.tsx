import { Dashboard } from './dashboard'
import { urlDashboard } from '@/urls'
import { documentsApi, extractionsApi, meApi, templatesApi, apiTokensApi } from '@/api-client'

export const route = {
    element: <Dashboard />,
    path: urlDashboard(),
    loader: async () => {
        try {
            const [docs, tmps, exts, usageRes, tokensRes] = await Promise.all([
                documentsApi.list(),
                templatesApi.list(),
                extractionsApi.list(),
                meApi.usage(),
                apiTokensApi.list()
            ])

            const documents = docs.error ? [] : (docs.data ?? [])
            const templates = tmps.error ? [] : (tmps.data ?? [])
            const extractions = exts.error ? [] : (exts.data ?? [])
            const usage = usageRes.error ? null : (usageRes.data ?? null)
            const apiTokens = tokensRes.error ? [] : (tokensRes.data ?? [])

            return {
                stats: {
                    documents: documents.length,
                    templates: templates.length,
                    extractions: extractions.length,
                    done: extractions.filter((e) => e.status === 'done').length,
                    recentExtractions: extractions.slice(0, 5)
                },
                onboarding: {
                    hasTemplate: templates.length > 0,
                    hasDocument: documents.length > 0,
                    hasExtraction: extractions.length > 0,
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
