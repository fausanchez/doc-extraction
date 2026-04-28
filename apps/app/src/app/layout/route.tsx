import { getDefaultStore } from 'jotai'
import { Layout } from './layout'
import { tokenAtom } from '@/stores/auth'
import { redirect } from 'react-router'
import { urlLogin } from '@/urls'
import { authApi } from '@/api-client'

export const layoutRouteId = 'layout'

export const route = {
    id: layoutRouteId,
    element: <Layout />,
    loader: async () => {
        const store = getDefaultStore()
        const token = store.get(tokenAtom)
        if (!token) {
            return redirect(urlLogin())
        }
        try {
            const me = await authApi.me()
            return { user: me.data }
        } catch {
            return { user: null }
        }
    }
}
