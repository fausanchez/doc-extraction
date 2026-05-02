import {
    SidebarInset,
    SidebarProvider
} from '@repo/ui/components/ui/sidebar.tsx'
import { AppSidebar } from '@/components/sidebar/app-sidebar'
import { Outlet } from 'react-router'
import { SiteHeader } from '@/components/header/site-header'
import { Toaster } from 'sonner'
import { useTheme } from '@/hooks/use-theme'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { CommandPalette } from '@/components/command-palette'
import { ShortcutsModal } from '@/components/shortcuts-modal'
import { FeedbackModal } from '@/components/feedback-modal'
import { Wizard } from '@/components/wizard/wizard'
import { NavProgress } from '@/components/nav-progress'
import { useAtomValue, useSetAtom } from 'jotai'
import { wizardDoneAtom, wizardOpenAtom } from '@/stores/wizard'
import { useEffect } from 'react'

export function Layout() {
    const { theme } = useTheme()
    useKeyboardShortcuts()
    const wizardDone = useAtomValue(wizardDoneAtom)
    const setWizardOpen = useSetAtom(wizardOpenAtom)

    // Auto-open the wizard on first login (once — persisted in localStorage)
    useEffect(() => {
        if (!wizardDone) setWizardOpen(true)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <NavProgress />
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
            <ShortcutsModal />
            <FeedbackModal />
            <Wizard />
            <Toaster theme={theme} />
        </>
    )
}
