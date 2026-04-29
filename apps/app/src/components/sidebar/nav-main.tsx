import { Link, useLocation } from 'react-router'
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from '@repo/ui/components/ui/sidebar.tsx'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
    title: string
    url: string
    icon: LucideIcon
    kbd?: string
}

export function NavMain({ items, label }: { items: NavItem[]; label?: string }) {
    const location = useLocation()

    const isActive = (url: string) => {
        if (url === '/') return location.pathname === '/'
        return location.pathname === url || location.pathname.startsWith(url + '/')
    }

    return (
        <SidebarGroup>
            {label && (
                <SidebarGroupLabel className="px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
                    {label}
                </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={isActive(item.url)}>
                                <Link to={item.url} viewTransition>
                                    <item.icon className="text-muted-foreground" />
                                    <span className="flex-1">{item.title}</span>
                                    {item.kbd && (
                                        <span className="kbd opacity-0 transition-opacity group-hover/menu-item:opacity-100">
                                            G {item.kbd}
                                        </span>
                                    )}
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
