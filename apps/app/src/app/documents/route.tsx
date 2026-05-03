import { Documents } from './documents'
import { ErrorBoundary } from '@/app/error-boundary/error-boundary'
import { urlDocuments } from '@/urls'
import { documentsApi } from '@/api-client'

export const route = {
    element: <Documents />,
    errorElement: <ErrorBoundary inline />,
    path: urlDocuments(),
    loader: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
        const res = await documentsApi.list({ page, limit: 25 })
        if (res.error) throw new Error(res.message)
        return { documents: res.data, pagination: res.pagination }
    },
    handle: {
        breadcrumb: [{ label: 'Documents', to: urlDocuments() }]
    }
}
