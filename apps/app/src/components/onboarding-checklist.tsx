import { useAtom } from 'jotai'
import { onboardingDismissedAtom } from '@/stores/onboarding'
import { Link } from 'react-router'
import { urlTemplates, urlDocuments, urlApiTokens } from '@/urls'
import { CheckCircle2, Circle, X, Sparkles, FileText, Cpu, KeyRound } from 'lucide-react'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { cn } from '@repo/ui/lib/utils'

interface OnboardingStatus {
    hasTemplate: boolean
    hasDocument: boolean
    hasExtraction: boolean
    hasApiToken: boolean
}

const STEPS = [
    {
        key: 'hasTemplate' as const,
        icon: Sparkles,
        label: 'Create your first template',
        description: 'Define the fields you want to extract.',
        href: urlTemplates()
    },
    {
        key: 'hasDocument' as const,
        icon: FileText,
        label: 'Upload a document',
        description: 'A PDF or image to run extraction on.',
        href: urlDocuments()
    },
    {
        key: 'hasExtraction' as const,
        icon: Cpu,
        label: 'Run your first extraction',
        description: 'Open a template and extract structured data.',
        href: urlTemplates()
    },
    {
        key: 'hasApiToken' as const,
        icon: KeyRound,
        label: 'Generate an API token',
        description: 'Access dvop.io programmatically.',
        href: urlApiTokens()
    }
]

export function OnboardingChecklist({ status }: { status: OnboardingStatus }) {
    const [dismissed, setDismiss] = useAtom(onboardingDismissedAtom)

    const completed = STEPS.filter((s) => status[s.key]).length
    const allDone = completed === STEPS.length

    // Auto-hide once everything is done or manually dismissed
    if (dismissed || allDone) return null

    return (
        <section className="rounded-xl border bg-gradient-to-br from-indigo-500/5 via-violet-500/5 to-fuchsia-500/5 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-sm font-semibold">Getting started</h2>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {completed} of {STEPS.length} steps complete
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setDismiss(true)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Dismiss"
                >
                    <X className="size-3.5" />
                </button>
            </div>

            {/* Progress bar */}
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                    style={{ width: `${(completed / STEPS.length) * 100}%` }}
                />
            </div>

            <ul className="flex flex-col gap-2">
                {STEPS.map((step) => {
                    const done = status[step.key]
                    return (
                        <li key={step.key}>
                            <Link
                                to={step.href}
                                viewTransition
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                                    done
                                        ? 'pointer-events-none opacity-50'
                                        : 'hover:bg-background/60'
                                )}
                            >
                                {done ? (
                                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                                ) : (
                                    <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className={cn('text-sm font-medium', done && 'line-through')}>
                                        {step.label}
                                    </p>
                                    {!done && (
                                        <p className="text-[11px] text-muted-foreground">
                                            {step.description}
                                        </p>
                                    )}
                                </div>
                                {!done && (
                                    <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400">
                                        Go →
                                    </span>
                                )}
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}
