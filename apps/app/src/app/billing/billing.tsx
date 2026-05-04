import { useEffect, useRef } from 'react'
import { useLoaderData } from 'react-router'
import { useAtomValue } from 'jotai'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@repo/ui/components/ui/card.tsx'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Badge } from '@repo/ui/components/ui/badge.tsx'
import { Check, Sparkles, ExternalLink } from 'lucide-react'
import { UsageCard } from '@/components/usage/usage-card'
import { userAtom } from '@/stores/auth'
import type { Price, Product } from '@/api-client'
import type { route } from './route'

const PADDLE_CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined
const PADDLE_ENV = (import.meta.env.VITE_PADDLE_ENV as string | undefined) ?? 'production'

function formatPrice(p: Price): string {
    if (p.interval === 'free' || p.amount === 0) return 'Free'
    const major = (p.amount / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: p.currency,
        minimumFractionDigits: p.amount % 100 === 0 ? 0 : 2
    })
    if (p.interval === 'one_time') return major
    const unit = p.intervalCount === 1 ? p.interval : `${p.intervalCount} ${p.interval}s`
    return `${major} / ${unit}`
}

function planBullets(product: Product): string[] {
    const credits = product.monthlyExtractionCredits
    return [
        credits === null
            ? 'Unlimited extractions per month'
            : `${credits} extractions per 30 days`,
        'PDF, JPG, PNG, WebP up to 10 MB',
        'Custom JSON schemas',
        product.slug === 'enterprise' ? 'Priority support + custom SLA' : 'Email support'
    ]
}

// Returns the best price to lead with: monthly > free > first available.
function headlinePrice(product: Product): Price | undefined {
    return (
        product.prices.find((p) => p.interval === 'month') ??
        product.prices.find((p) => p.interval === 'free') ??
        product.prices[0]
    )
}

export function Billing() {
    const { products, usage } = useLoaderData<typeof route.loader>()
    const user = useAtomValue(userAtom)
    const paddleReady = useRef(false)

    const currentSlug = usage?.product.slug ?? null

    // Load Paddle.js once and initialize it. Checkout buttons call
    // window.Paddle.Checkout.open() directly — no React state needed.
    useEffect(() => {
        if (!PADDLE_CLIENT_TOKEN || paddleReady.current) return

        const script = document.createElement('script')
        script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
        script.async = true
        script.onload = () => {
            const P = (window as Record<string, unknown>)['Paddle'] as Record<string, unknown>
            if (!P) return
            if (PADDLE_ENV !== 'production') {
                ;(P['Environment'] as Record<string, unknown>)['set']?.(PADDLE_ENV)
            }
            ;(P['Initialize'] as (opts: unknown) => void)?.({
                token: PADDLE_CLIENT_TOKEN,
                eventCallback: (ev: { name: string }) => {
                    // After checkout completes, reload to reflect the new plan
                    // (the webhook may take a few seconds; the page reload acts
                    // as a soft refresh).
                    if (ev.name === 'checkout.completed') {
                        window.location.reload()
                    }
                }
            })
            paddleReady.current = true
        }
        document.head.appendChild(script)
    }, [])

    function openCheckout(priceId: string) {
        const P = (window as Record<string, unknown>)['Paddle'] as Record<string, unknown> | undefined
        if (!P) return
        ;(P['Checkout'] as Record<string, unknown>)['open']?.({
            items: [{ priceId, quantity: 1 }],
            customer: user?.email ? { email: user.email } : undefined,
            customData: user?.id ? { userId: String(user.id) } : undefined
        })
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Billing & plans</h1>
                <p className="text-muted-foreground text-sm">
                    Track your usage and choose the plan that fits your team.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-1">
                    <UsageCard data={usage} showUpgrade={false} />
                </div>
                <Card className="md:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Billing window</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            Extractions are counted on a rolling 30-day window. As older runs age
                            out, your credit balance recovers automatically — no fixed billing
                            cycle to track.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div>
                <h2 className="mb-3 text-lg font-semibold">Plans</h2>
                <div className="grid gap-4 md:grid-cols-3">
                    {products.map((product) => {
                        const isCurrent = product.slug === currentSlug
                        const headline = headlinePrice(product)
                        const isFree = product.prices.every((p) => p.interval === 'free' || p.amount === 0)

                        return (
                            <Card key={product.id} className={isCurrent ? 'border-primary' : ''}>
                                <CardHeader>
                                    <div className="flex items-center justify-between gap-2">
                                        <CardTitle>{product.name}</CardTitle>
                                        {isCurrent && (
                                            <Badge variant="default" className="gap-1">
                                                <Sparkles className="size-3" />
                                                Current
                                            </Badge>
                                        )}
                                    </div>
                                    <CardDescription>{product.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <div>
                                        <span className="text-3xl font-bold">
                                            {headline ? formatPrice(headline) : '—'}
                                        </span>
                                        {product.prices.length > 1 && (
                                            <p className="text-muted-foreground mt-1 text-xs">
                                                also{' '}
                                                {product.prices
                                                    .filter((p) => p !== headline)
                                                    .map(formatPrice)
                                                    .join(' · ')}
                                            </p>
                                        )}
                                    </div>

                                    <ul className="flex flex-col gap-2">
                                        {planBullets(product).map((line) => (
                                            <li key={line} className="flex items-start gap-2 text-sm">
                                                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                                                <span>{line}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {isCurrent ? (
                                        // Show "Manage" link only if they have a Paddle subscription
                                        usage?.product.slug !== 'free' && !isFree ? (
                                            <Button
                                                variant="outline"
                                                className="w-full gap-2"
                                                onClick={() =>
                                                    window.open(
                                                        'https://billing.paddle.com/checkout/subscription/manage',
                                                        '_blank'
                                                    )
                                                }
                                            >
                                                <ExternalLink className="size-4" />
                                                Manage subscription
                                            </Button>
                                        ) : (
                                            <Button variant="outline" disabled className="w-full">
                                                Current plan
                                            </Button>
                                        )
                                    ) : isFree ? (
                                        <Button variant="outline" disabled className="w-full">
                                            Free plan
                                        </Button>
                                    ) : PADDLE_CLIENT_TOKEN && headline?.providerPriceId ? (
                                        <Button
                                            className="w-full"
                                            onClick={() => openCheckout(headline.providerPriceId)}
                                        >
                                            Upgrade to {product.name}
                                        </Button>
                                    ) : (
                                        <Button disabled className="w-full">
                                            Coming soon
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
