import { Templates } from './templates'
import { ErrorBoundary } from '@/app/error-boundary/error-boundary'
import { urlTemplates } from '@/urls'
import { templatesApi } from '@/api-client'

export const route = {
    element: <Templates />,
    errorElement: <ErrorBoundary inline />,
    path: urlTemplates(),
    loader: async () => {
        const res = await templatesApi.list()
        if (res.error) throw new Error(res.message)
        return { templates: res.data }
    },
    handle: {
        breadcrumb: [{ label: 'Templates', to: urlTemplates() }]
    }
}
