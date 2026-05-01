import {
    SidebarInset,
    SidebarProvider
} from '@repo/ui/components/ui/sidebar.tsx'
import { AppSidebar } from '@/components/sidebar/app-sidebar'
import { Outlet } from 'react-router'
import { SiteHeader } from '@/components/header/site-header'
import { Toaster } from 'sonner'
import { useTheme } from '@/hooks/use-theme'

export function Layout() {
    const { theme } = useTheme()

    return (
        <>
            <SidebarProvider
                style={
                    {
                        '--sidebar-width': 'calc(var(--spacing) * 64)',
                        '--header-height': 'calc(var(--spacing) * 12)'
                    } as React.CSSProperties as never
                }
            >
                <AppSidebar variant="inset" />
                <SidebarInset>
                    <SiteHeader />
                    <main className="p-4 md:p-6">
                        <Outlet />
                    </main>
                </SidebarInset>
            </SidebarProvider>
            <Toaster theme={theme} />
        </>
    )
}
