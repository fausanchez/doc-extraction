import { Link, useLocation } from 'react-router'
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@repo/ui/components/ui/sidebar.tsx'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
    title: string
    url: string
    icon: LucideIcon
}

export function NavMain({ items }: { items: NavItem[] }) {
    const location = useLocation()

    return (
        <SidebarGroup>
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={location.pathname === item.url}
                            >
                                <Link to={item.url} viewTransition>
                                    <item.icon />
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
