import { getDefaultStore } from 'jotai'
import { tokenAtom } from '@/stores/auth'
import { Outlet, redirect } from 'react-router'
import { urlDashboard } from '@/urls'
import { Toaster } from 'sonner'

export const route = {
    element: (
        <>
            <Outlet />
            <Toaster />
        </>
    ),
    loader: async () => {
        const store = getDefaultStore()
        const token = store.get(tokenAtom)
        if (token) {
            return redirect(urlDashboard())
        }
        return null
    }
}
