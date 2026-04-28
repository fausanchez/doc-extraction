import { Templates } from './templates'
import { urlTemplates } from '@/urls'
import { templatesApi } from '@/api-client'

export const route = {
    element: <Templates />,
    path: urlTemplates(),
    loader: async () => {
        try {
            const res = await templatesApi.list()
            return { templates: res.error ? [] : (res.data ?? []) }
        } catch {
            return { templates: [] }
        }
    }
}
