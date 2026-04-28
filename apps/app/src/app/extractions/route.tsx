import { Extractions } from './extractions'
import { urlExtractions } from '@/urls'
import { extractionsApi, documentsApi, templatesApi } from '@/api-client'

export const route = {
    element: <Extractions />,
    path: urlExtractions(),
    loader: async () => {
        try {
            const [exts, docs, tmps] = await Promise.all([
                extractionsApi.list(),
                documentsApi.list(),
                templatesApi.list()
            ])
            return {
                extractions: exts.error ? [] : (exts.data ?? []),
                documents: docs.error ? [] : (docs.data ?? []),
                templates: tmps.error ? [] : (tmps.data ?? [])
            }
        } catch {
            return { extractions: [], documents: [], templates: [] }
        }
    }
}
