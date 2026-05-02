import { Button } from '@repo/ui/components/ui/button.tsx'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { urlExtractions, urlDashboard } from '@/urls'
import type { Extraction } from '@/api-client'

export function StepDone({
    extraction,
    onFinish
}: {
    extraction: Extraction | null
    onFinish: () => void
}) {
    let result: unknown = null
    if (extraction?.result) {
        try { result = JSON.parse(extraction.result as string) } catch { result = extraction.result }
    }

    return (
        <div className="flex flex-col gap-6 px-8 py-10">
            <div className="flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="size-12 text-emerald-500" />
                <div>
                    <h2 className="text-xl font-bold tracking-tight">You're all set!</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {extraction
                            ? "Your first extraction is complete. Here's the structured data:"
                            : 'You now know how dvop.io works. Go explore the dashboard!'}
                    </p>
                </div>
            </div>

            {result && (
                <pre className="max-h-48 overflow-auto rounded-lg border bg-muted/50 p-4 text-[12px] leading-relaxed text-foreground/80">
                    {JSON.stringify(result, null, 2)}
                </pre>
            )}

            <div className="flex flex-col items-center gap-3 pt-2">
                <Button onClick={onFinish} className="gap-1.5 px-8">
                    Go to dashboard
                    <ArrowRight className="size-4" />
                </Button>
                {extraction && (
                    <Link
                        to={urlExtractions()}
                        onClick={onFinish}
                        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                        View all extractions
                    </Link>
                )}
            </div>
        </div>
    )
}
