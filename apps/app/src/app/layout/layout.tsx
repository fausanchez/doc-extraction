import {
    SidebarInset,
    SidebarProvider
} from '@repo/ui/components/ui/sidebar.tsx'
import { AppSidebar } from '@/components/sidebar/app-sidebar'
import { Outlet } from 'react-router'
import { SiteHeader } from '@/components/header/site-header'
import { Toaster } from 'sonner'
import { useTheme } from '@/hooks/use-theme'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { commandPaletteOpenAtom } from '@/stores/command-palette'
import { CommandPalette } from '@/components/command-palette'

export function Layout() {
    const { theme } = useTheme()
    const setOpen = useSetAtom(commandPaletteOpenAtom)

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setOpen((v) => !v)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [setOpen])

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
            <CommandPalette />
            <Toaster theme={theme} />
        </>
    )
}
