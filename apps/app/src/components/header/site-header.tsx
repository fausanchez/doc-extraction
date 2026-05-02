import { SidebarTrigger } from '@repo/ui/components/ui/sidebar.tsx'
import { Separator } from '@repo/ui/components/ui/separator.tsx'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator
} from '@repo/ui/components/ui/breadcrumb.tsx'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Link, useLocation, useMatches } from 'react-router'
import { useMemo, type ReactNode } from 'react'
import { useSetAtom } from 'jotai'
import { urlDashboard } from '@/urls'
import { cn } from '@repo/ui/lib/utils.ts'
import { Home } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { feedbackModalOpenAtom } from '@/components/feedback-modal'

type BreadcrumbItemType = { label: string; to: string; icon?: LucideIcon }
type HandleData = {
    breadcrumb?: BreadcrumbItemType[] | ((data: Record<string, unknown>) => BreadcrumbItemType[])
    actions?: ReactNode | ((data: Record<string, unknown>) => ReactNode)
}

export function SiteHeader() {
    const matches = useMatches()
    const location = useLocation()
    const openFeedback = useSetAtom(feedbackModalOpenAtom)

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
        return 'handle' in m && m.handle && typeof m.handle === 'object'
    })?.handle as HandleData | undefined

    const breadcrumbItems = useMemo(() => {
        const extra = handleData?.breadcrumb
            ? typeof handleData.breadcrumb === 'function'
                ? handleData.breadcrumb(loaderData)
                : handleData.breadcrumb
            : []
        return [{ label: 'Home', to: urlDashboard(), icon: Home }, ...extra]
    }, [handleData, loaderData])

    const actions =
        typeof handleData?.actions === 'function'
            ? handleData.actions(loaderData)
            : handleData?.actions

    return (
        <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex w-full items-center gap-1 px-3 lg:gap-2 lg:px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />

                <Breadcrumb>
                    <BreadcrumbList className="text-[13px]">
                        {breadcrumbItems.map((item, index) => (
                            <span key={`${item.to}-${index}`} className="contents">
                                <BreadcrumbItem
                                    className={cn(
                                        'rounded-md px-1.5 py-0.5 transition-colors',
                                        location.pathname === item.to &&
                                            'bg-muted text-foreground font-medium'
                                    )}
                                >
                                    <BreadcrumbLink asChild>
                                        <Link
                                            to={item.to}
                                            viewTransition
                                            className="flex items-center gap-1.5"
                                        >
                                            {item.icon && (
                                                <item.icon className="size-3.5 text-muted-foreground" />
                                            )}
                                            <span>{item.label}</span>
                                        </Link>
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                {index < breadcrumbItems.length - 1 && (
                                    <BreadcrumbSeparator className="text-muted-foreground/60" />
                                )}
                            </span>
                        ))}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>

            <div className="flex items-center gap-1.5 pr-3 lg:pr-4">
                {actions}
                <Button
                    variant="ghost"
                    size="sm"
                    className="hidden h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
                    onClick={() => openFeedback(true)}
                >
                    Feedback
                </Button>
                <ThemeToggle />
                <Separator orientation="vertical" className="mx-1 hidden data-[orientation=vertical]:h-4 sm:block" />
                <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex">
                    <span className="kbd">⌘</span>
                    <span className="kbd">K</span>
                </span>
            </div>
        </header>
    )
}
