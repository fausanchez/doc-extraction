import { Extractions } from './extractions'
import { ErrorBoundary } from '@/app/error-boundary/error-boundary'
import { urlExtractions } from '@/urls'
import { extractionsApi, documentsApi, templatesApi } from '@/api-client'

export const route = {
    element: <Extractions />,
    errorElement: <ErrorBoundary inline />,
    path: urlExtractions(),
    loader: async () => {
        const [exts, docs, tmps] = await Promise.all([
            extractionsApi.list(),
            documentsApi.list(),
            templatesApi.list()
        ])
        if (exts.error) throw new Error(exts.message)
        return {
            extractions: exts.data,
            documents: docs.error ? [] : (docs.data ?? []),
            templates: tmps.error ? [] : (tmps.data ?? [])
        }
    },
    handle: {
        breadcrumb: [{ label: 'Extractions', to: urlExtractions() }]
    }
}
