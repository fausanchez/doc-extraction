import { Dashboard } from './dashboard'
import { urlDashboard } from '@/urls'
import { documentsApi, extractionsApi, templatesApi } from '@/api-client'

export const route = {
    element: <Dashboard />,
    path: urlDashboard(),
    loader: async () => {
        try {
            const [docs, tmps, exts] = await Promise.all([
                documentsApi.list(),
                templatesApi.list(),
                extractionsApi.list()
            ])

            const documents = docs.error ? [] : (docs.data ?? [])
            const templates = tmps.error ? [] : (tmps.data ?? [])
            const extractions = exts.error ? [] : (exts.data ?? [])

            return {
                stats: {
                    documents: documents.length,
                    templates: templates.length,
                    extractions: extractions.length,
                    done: extractions.filter((e) => e.status === 'done').length,
                    recentExtractions: extractions.slice(0, 5)
                }
            }
        } catch {
            return {
                stats: { documents: 0, templates: 0, extractions: 0, done: 0, recentExtractions: [] }
            }
        }
    },
    handle: {
        breadcrumb: []
    }
}
