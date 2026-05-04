import { Data } from './data'
import { ErrorBoundary } from '@/app/error-boundary/error-boundary'
import { urlData } from '@/urls'

export const route = {
    element: <Data />,
    errorElement: <ErrorBoundary inline />,
    path: urlData(),
    handle: {
        breadcrumb: [{ label: 'Your data', to: urlData() }]
    }
}
