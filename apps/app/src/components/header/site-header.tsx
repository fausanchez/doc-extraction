import { Button } from '@repo/ui/components/ui/button.tsx'
import { SidebarTrigger } from '@repo/ui/components/ui/sidebar.tsx'
import { Separator } from '@repo/ui/components/ui/separator.tsx'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator
} from '@repo/ui/components/ui/breadcrumb.tsx'
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/ui/avatar.tsx'
import { Link, useLocation, useMatches, useNavigate } from 'react-router'
import { useMemo } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { tokenAtom, userAtom } from '@/stores/auth'
import { authApi } from '@/api-client'
import { urlDashboard, urlLogin } from '@/urls'
import { cn } from '@repo/ui/lib/utils.ts'
import { LogOut, Home } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type BreadcrumbItemType = { label: string; to: string; icon?: LucideIcon }
type HandleData = {
    breadcrumb?: BreadcrumbItemType[] | ((data: Record<string, unknown>) => BreadcrumbItemType[])
}

export function SiteHeader() {
    const matches = useMatches()
    const location = useLocation()
    const navigate = useNavigate()
    const setToken = useSetAtom(tokenAtom)
    const setUser = useSetAtom(userAtom)
    const user = useAtomValue(userAtom)

    const handleLogout = async () => {
        // Server-side revocation; ignore errors so logout always succeeds locally.
        try {
            await authApi.logout()
        } catch {
            // ignore
        }
        setToken(null)
        setUser(null)
        navigate(urlLogin(), { viewTransition: true })
    }

    const loaderData = useMemo(() => {
        const data: Record<string, unknown> = {}
        for (const match of matches) {
            if ('loaderData' in match) {
                data[match.id as string] = match.loaderData
            }
        }
        return data
    }, [matches])

    const handleData = matches.find((m) => {
        return 'handle' in m && m.handle && typeof m.handle === 'object' && 'breadcrumb' in m.handle
    })?.handle as HandleData

    const breadcrumbItems = useMemo(() => {
        const extra = handleData?.breadcrumb
            ? typeof handleData.breadcrumb === 'function'
                ? handleData.breadcrumb(loaderData)
                : handleData.breadcrumb
            : []
        return [{ label: 'Home', to: urlDashboard(), icon: Home }, ...extra]
    }, [handleData, loaderData])

    return (
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
                <Breadcrumb>
                    <BreadcrumbList>
                        {breadcrumbItems.map((item, index) => (
                            <span key={item.to} className="contents">
                                <BreadcrumbItem
                                    className={cn(
                                        'py-px px-1.5 rounded-md',
                                        location.pathname === item.to && 'text-primary/80 bg-primary/10'
                                    )}
                                >
                                    <BreadcrumbLink asChild>
                                        <Link to={item.to} viewTransition className="flex items-center gap-1">
                                            {item.icon && <item.icon className="size-3.5 text-muted-foreground" />}
                                            {item.label}
                                        </Link>
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                {index < breadcrumbItems.length - 1 && <BreadcrumbSeparator />}
                            </span>
                        ))}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>
            <div className="flex items-center gap-3 pr-4 lg:pr-6">
                {user && (
                    <div className="flex items-center gap-2">
                        <Avatar size="sm">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>{user.name?.charAt(0).toUpperCase() ?? 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="hidden text-sm font-medium lg:block">{user.name}</span>
                    </div>
                )}
                <Button variant="ghost" size="icon-sm" onClick={handleLogout}>
                    <LogOut className="size-4" />
                </Button>
            </div>
        </header>
    )
}
