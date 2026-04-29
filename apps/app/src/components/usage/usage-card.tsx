import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card.tsx'
import { Badge } from '@repo/ui/components/ui/badge.tsx'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Sparkles } from 'lucide-react'
import type { UsageResponse } from '@/api-client'
import { urlBilling } from '@/urls'

type Props = {
    data: UsageResponse | null
    /** Hide the upgrade CTA on the billing page itself. */
    showUpgrade?: boolean
}

// Dashboard / sidebar widget showing the current plan + extractions
// consumed in the rolling 30-day window. Renders an "unlimited" pill when
// the plan has no credit cap.
export function UsageCard({ data, showUpgrade = true }: Props) {
    if (!data) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Usage</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-xs">Loading…</p>
                </CardContent>
            </Card>
        )
    }

    const { product, usage } = data
    const unlimited = usage.creditsLimit === null
    const used = usage.creditsUsed
    const limit = usage.creditsLimit
    const percent = usage.percentUsed ?? 0
    const remaining = usage.remaining
    const overLimit = remaining !== null && remaining <= 0

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Usage</CardTitle>
                <Badge variant="secondary" className="capitalize">
                    {product.name}
                </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div>
                    <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold">{used}</span>
                        <span className="text-muted-foreground text-xs">
                            {unlimited ? 'unlimited' : `of ${limit}`}
                        </span>
                    </div>
                    <p className="text-muted-foreground text-xs">extractions in the last 30 days</p>
                </div>

                {!unlimited && (
                    <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                        aria-label={`${percent}% used`}
                    >
                        <div
                            className={`h-full transition-all ${
                                overLimit
                                    ? 'bg-destructive'
                                    : percent >= 80
                                      ? 'bg-amber-500'
                                      : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, percent)}%` }}
                        />
                    </div>
                )}

                {showUpgrade && !unlimited && (
                    <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                        <Link to={urlBilling()} viewTransition>
                            <Sparkles className="size-3.5" />
                            {overLimit ? 'Upgrade now' : 'View plans'}
                        </Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
