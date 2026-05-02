import { useRouteError, isRouteErrorResponse, Link, useNavigate } from 'react-router'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { urlDashboard } from '@/urls'

interface ErrorBoundaryProps {
    /** When true, renders a compact inline version (for route-level errors inside the layout) */
    inline?: boolean
}

export function ErrorBoundary({ inline = false }: ErrorBoundaryProps) {
    const error = useRouteError()
    const navigate = useNavigate()

    let status: number | null = null
    let title = 'Something went wrong'
    let message = 'An unexpected error occurred. Please try again.'

    if (isRouteErrorResponse(error)) {
        status = error.status
        if (error.status === 404) {
            title = 'Page not found'
            message = "The page you're looking for doesn't exist or has been moved."
        } else if (error.status === 401 || error.status === 403) {
            title = 'Access denied'
            message = "You don't have permission to view this page."
        } else if (error.status >= 500) {
            title = 'Server error'
            message = 'Something went wrong on our end. Please try again in a moment.'
        } else {
            title = `Error ${error.status}`
            message = error.statusText || message
        }
    } else if (error instanceof Error) {
        message = error.message
    }

    const content = (
        <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-6 text-destructive" />
            </div>
            <div className="space-y-1">
                {status && (
                    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        {status}
                    </p>
                )}
                <h1 className="text-lg font-semibold">{title}</h1>
                <p className="max-w-sm text-[13px] text-muted-foreground">{message}</p>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate(0)}
                >
                    <RefreshCw className="size-3.5" />
                    Try again
                </Button>
                <Button asChild size="sm" className="gap-1.5">
                    <Link to={urlDashboard()} viewTransition>
                        <Home className="size-3.5" />
                        Dashboard
                    </Link>
                </Button>
            </div>
        </div>
    )

    if (inline) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center p-8">
                {content}
            </div>
        )
    }

    return (
        <div className="flex min-h-svh items-center justify-center p-8">
            {content}
        </div>
    )
}
