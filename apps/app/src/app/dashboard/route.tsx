import { Dashboard } from './dashboard'
import { urlDashboard } from '@/urls'
import { documentsApi, extractionsApi, meApi, templatesApi } from '@/api-client'

export const route = {
    element: <Dashboard />,
    path: urlDashboard(),
    loader: async () => {
        try {
            // Fan out the four reads in parallel — usage is independent of
            // the activity stats so we don't pay for a sequential round-trip.
            const [docs, tmps, exts, usageRes] = await Promise.all([
                documentsApi.list(),
                templatesApi.list(),
                extractionsApi.list(),
                meApi.usage()
            ])

            const documents = docs.error ? [] : (docs.data ?? [])
            const templates = tmps.error ? [] : (tmps.data ?? [])
            const extractions = exts.error ? [] : (exts.data ?? [])
            const usage = usageRes.error ? null : (usageRes.data ?? null)

            return {
                stats: {
                    documents: documents.length,
                    templates: templates.length,
                    extractions: extractions.length,
                    done: extractions.filter((e) => e.status === 'done').length,
                    recentExtractions: extractions.slice(0, 5)
                },
                usage
            }
        } catch {
            return {
                stats: { documents: 0, templates: 0, extractions: 0, done: 0, recentExtractions: [] },
                usage: null
            }
        }
    }
}
