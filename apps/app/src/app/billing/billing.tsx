import { useLoaderData } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@repo/ui/components/ui/card.tsx'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Badge } from '@repo/ui/components/ui/badge.tsx'
import { Check, Sparkles } from 'lucide-react'
import { UsageCard } from '@/components/usage/usage-card'
import type { Price, Product } from '@/api-client'
import type { route } from './route'

// Display the catalogue alongside the user's current plan and usage. Checkout
// isn't wired up yet — buttons explain that a contact / waitlist flow is
// coming next, so the catalogue can ship without a payment integration.

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

export function Billing() {
    const { products, usage } = useLoaderData<typeof route.loader>()

    const currentSlug = usage?.product.slug ?? null

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
                        const headline =
                            product.prices.find((p) => p.interval === 'month') ??
                            product.prices.find((p) => p.interval === 'free') ??
                            product.prices[0]
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

                                    <Button
                                        variant={isCurrent ? 'outline' : 'default'}
                                        disabled
                                        className="w-full"
                                        title="Checkout coming soon"
                                    >
                                        {isCurrent ? 'Current plan' : 'Coming soon'}
                                    </Button>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
