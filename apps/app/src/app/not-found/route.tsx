import { Link } from 'react-router'
import { urlHome } from '@/urls'

function NotFound() {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
            <h1 className="text-4xl font-bold">404</h1>
            <p className="text-muted-foreground">Page not found</p>
            <Link to={urlHome()} className="text-primary text-sm underline-offset-4 hover:underline">
                Back to home
            </Link>
        </div>
    )
}

export const route = {
    path: '*',
    element: <NotFound />
}
