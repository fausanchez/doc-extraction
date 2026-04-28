import { Documents } from './documents'
import { urlDocuments } from '@/urls'
import { documentsApi } from '@/api-client'

export const route = {
    element: <Documents />,
    path: urlDocuments(),
    loader: async () => {
        try {
            const res = await documentsApi.list()
            return { documents: res.error ? [] : (res.data ?? []) }
        } catch {
            return { documents: [] }
        }
    }
}
