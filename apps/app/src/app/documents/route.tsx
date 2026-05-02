import { Documents } from './documents'
import { ErrorBoundary } from '@/app/error-boundary/error-boundary'
import { urlDocuments } from '@/urls'
import { documentsApi } from '@/api-client'

export const route = {
    element: <Documents />,
    errorElement: <ErrorBoundary inline />,
    path: urlDocuments(),
    loader: async () => {
        const res = await documentsApi.list()
        if (res.error) throw new Error(res.message)
        return { documents: res.data }
    },
    handle: {
        breadcrumb: [{ label: 'Documents', to: urlDocuments() }]
    }
}
