import { Billing } from './billing'
import { urlBilling } from '@/urls'
import { meApi, productsApi } from '@/api-client'

export const route = {
    element: <Billing />,
    path: urlBilling(),
    loader: async () => {
        // Two parallel reads: the public catalogue + the authed usage view.
        // Both errors degrade silently — the page renders an empty state
        // rather than throwing the user back to login.
        const [productsRes, usageRes] = await Promise.all([
            productsApi.list(),
            meApi.usage()
        ])

        return {
            products: productsRes.error ? [] : (productsRes.data ?? []),
            usage: usageRes.error ? null : (usageRes.data ?? null)
        }
    }
}
