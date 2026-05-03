import { Extractions } from './extractions'
import { ErrorBoundary } from '@/app/error-boundary/error-boundary'
import { urlExtractions } from '@/urls'
import { extractionsApi, documentsApi, templatesApi } from '@/api-client'

export const route = {
    element: <Extractions />,
    errorElement: <ErrorBoundary inline />,
    path: urlExtractions(),
    loader: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
        const [exts, docs, tmps] = await Promise.all([
            extractionsApi.list({ page, limit: 25 }),
            // Documents and templates are needed for name resolution in the list;
            // fetch all active ones (they're small sets).
            documentsApi.list({ limit: 100 }),
            templatesApi.list({ limit: 100 })
        ])
        if (exts.error) throw new Error(exts.message)
        return {
            extractions: exts.data,
            pagination: exts.pagination,
            documents: docs.error ? [] : (docs.data ?? []),
            templates: tmps.error ? [] : (tmps.data ?? [])
        }
    },
    handle: {
        breadcrumb: [{ label: 'Extractions', to: urlExtractions() }]
    }
}
