import { getDefaultStore } from 'jotai'
import { tokenAtom } from '@/stores/auth'
import { Outlet, redirect } from 'react-router'
import { urlDashboard } from '@/urls'
import { Toaster } from 'sonner'
import { useTheme } from '@/hooks/use-theme'

function PublicLayout() {
    const { theme } = useTheme()
    return (
        <>
            <Outlet />
            <Toaster theme={theme} />
        </>
    )
}

export const route = {
    element: <PublicLayout />,
    loader: async () => {
        const store = getDefaultStore()
        const token = store.get(tokenAtom)
        if (token) {
            return redirect(urlDashboard())
        }
        return null
    }
}
