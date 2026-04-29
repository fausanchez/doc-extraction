import { ApiTokensPage } from './api-tokens'
import { urlApiTokens } from '@/urls'
import { apiTokensApi } from '@/api-client'

export const route = {
    element: <ApiTokensPage />,
    path: urlApiTokens(),
    loader: async () => {
        const res = await apiTokensApi.list()
        return { tokens: res.error ? [] : (res.data ?? []) }
    }
}
