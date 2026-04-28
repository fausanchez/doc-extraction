import { useRouteError, isRouteErrorResponse, Link } from 'react-router'
import { urlHome } from '@/urls'

export function ErrorBoundary() {
    const error = useRouteError()

    const message = isRouteErrorResponse(error)
        ? `${error.status} ${error.statusText}`
        : error instanceof Error
          ? error.message
          : 'Unknown error'

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">{message}</p>
            <Link to={urlHome()} className="text-primary text-sm underline-offset-4 hover:underline">
                Back to home
            </Link>
        </div>
    )
}
