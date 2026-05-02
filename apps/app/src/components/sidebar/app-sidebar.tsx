import * as React from 'react'
import { useSetAtom } from 'jotai'
import { commandPaletteOpenAtom } from '@/stores/command-palette'
import { wizardOpenAtom, wizardDoneAtom, wizardStepAtom } from '@/stores/wizard'
import { NavMain } from '@/components/sidebar/nav-main.tsx'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from '@repo/ui/components/ui/sidebar.tsx'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger
} from '@repo/ui/components/ui/dropdown-menu.tsx'
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/ui/avatar.tsx'
import {
    FileText,
    LayoutTemplate,
    Cpu,
    LayoutDashboard,
    User,
    ChevronsUpDown,
    CreditCard,
    KeyRound,
    LogOut,
    Search,
    Settings,
    Sparkles,
    BookOpen
} from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { tokenAtom, userAtom } from '@/stores/auth'
import { authApi } from '@/api-client'
import {
    urlDashboard,
    urlDocuments,
    urlTemplates,
    urlExtractions,
    urlProfile,
    urlBilling,
    urlApiTokens,
    urlSettings,
    urlLogin
} from '@/urls'

const workspaceItems = [
    { title: 'Dashboard', url: urlDashboard(), icon: LayoutDashboard, kbd: 'D' },
    { title: 'Templates', url: urlTemplates(), icon: LayoutTemplate, kbd: 'T' },
    { title: 'Documents', url: urlDocuments(), icon: FileText, kbd: 'F' },
    { title: 'Extractions', url: urlExtractions(), icon: Cpu, kbd: 'E' }
]

const developerItems = [
    { title: 'API tokens', url: urlApiTokens(), icon: KeyRound, kbd: 'A' }
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const user = useAtomValue(userAtom)
    const setToken = useSetAtom(tokenAtom)
    const setUser = useSetAtom(userAtom)
    const navigate = useNavigate()
    const openPalette = useSetAtom(commandPaletteOpenAtom)
    const setWizardOpen = useSetAtom(wizardOpenAtom)
    const setWizardStep = useSetAtom(wizardStepAtom)
    const setWizardDone = useSetAtom(wizardDoneAtom)

    const openWizard = () => {
        setWizardDone(false)
        setWizardStep(0)
        setWizardOpen(true)
    }

    const handleLogout = async () => {
        // Best-effort server-side revocation; the refresh token rides in an
        // httpOnly cookie attached automatically by the browser, so the call
        // takes no body. Ignore network errors so logout always succeeds
        // client-side.
        try {
            await authApi.logout()
        } catch {
            // ignore
        }
        setToken(null)
        setUser(null)
        navigate(urlLogin(), { viewTransition: true })
    }

    return (
        <Sidebar collapsible="offcanvas" {...props}>
            <SidebarHeader className="border-b border-sidebar-border/60 pb-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="data-[slot=sidebar-menu-button]:!p-1.5"
                        >
                            <Link to={urlDashboard()} viewTransition>
                                <div className="flex items-center gap-2.5">
                                    <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
                                        D
                                    </div>
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate text-sm font-semibold leading-tight">
                                            dvop.io
                                        </span>
                                        <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                                            Workspace
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>

                <button
                    type="button"
                    onClick={() => openPalette(true)}
                    className="mt-2 flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 text-xs text-muted-foreground hover:bg-sidebar-accent transition-colors"
                >
                    <Search className="size-3.5" />
                    <span className="flex-1 text-left">Search…</span>
                    <span className="kbd">⌘K</span>
                </button>
            </SidebarHeader>

            <SidebarContent>
                <NavMain label="Workspace" items={workspaceItems} />
                <NavMain label="Developer" items={developerItems} />

                <SidebarGroup className="mt-auto">
                    <SidebarGroupContent>
                        <Link
                            to={urlTemplates()}
                            viewTransition
                            className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-gradient-to-br from-indigo-500/8 via-violet-500/8 to-fuchsia-500/8 p-3 transition-colors hover:bg-sidebar-accent"
                        >
                            <Sparkles className="size-4 text-violet-500" />
                            <div className="min-w-0">
                                <p className="text-xs font-medium leading-tight">Quick extract</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                    Open a template to upload & run
                                </p>
                            </div>
                        </Link>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border/60 pt-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-[slot=sidebar-menu-button]:!p-2"
                                >
                                    <Avatar size="sm">
                                        <AvatarImage src={user?.avatar} alt={user?.name} />
                                        <AvatarFallback className="text-[10px]">
                                            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left">
                                        <span className="truncate text-sm font-medium leading-tight">
                                            {user?.name ?? 'User'}
                                        </span>
                                        <span className="truncate text-[11px] text-muted-foreground">
                                            {user?.email ?? ''}
                                        </span>
                                    </div>
                                    <ChevronsUpDown className="ml-auto size-4 opacity-50" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="right"
                                align="end"
                                className="w-56"
                            >
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{user?.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {user?.email}
                                        </span>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link to={urlProfile()} viewTransition>
                                        <User />
                                        Profile
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to={urlBilling()} viewTransition>
                                        <CreditCard />
                                        Billing
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to={urlSettings()} viewTransition>
                                        <Settings />
                                        Settings
                                        <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={openWizard}>
                                    <BookOpen />
                                    Start tour
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={handleLogout}
                                >
                                    <LogOut />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
