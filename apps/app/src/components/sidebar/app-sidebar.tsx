import * as React from 'react'
import { NavMain } from '@/components/sidebar/nav-main.tsx'
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from '@repo/ui/components/ui/sidebar.tsx'
import { FileText, LayoutTemplate, Cpu, LayoutDashboard, User } from 'lucide-react'
import { Link } from 'react-router'
import { urlDashboard, urlDocuments, urlTemplates, urlExtractions, urlProfile } from '@/urls'

const navItems = [
    { title: 'Dashboard', url: urlDashboard(), icon: LayoutDashboard },
    { title: 'Documents', url: urlDocuments(), icon: FileText },
    { title: 'Templates', url: urlTemplates(), icon: LayoutTemplate },
    { title: 'Extractions', url: urlExtractions(), icon: Cpu },
    { title: 'Profile', url: urlProfile(), icon: User }
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible="offcanvas" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="data-[slot=sidebar-menu-button]:!p-1.5"
                        >
                            <Link to={urlDashboard()} viewTransition>
                                <div className="flex items-center gap-2">
                                    <div className="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-xs">
                                        D
                                    </div>
                                    <span className="font-semibold">DocExtract</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={navItems} />
            </SidebarContent>
        </Sidebar>
    )
}
