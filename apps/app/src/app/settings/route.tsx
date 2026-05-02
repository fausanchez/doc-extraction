import { Settings } from './settings'
import { ErrorBoundary } from '@/app/error-boundary/error-boundary'
import { urlSettings } from '@/urls'

export const route = {
    element: <Settings />,
    errorElement: <ErrorBoundary inline />,
    path: urlSettings(),
    handle: {
        breadcrumb: [{ label: 'Settings', to: urlSettings() }]
    }
}
