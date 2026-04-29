import { Link, useLoaderData } from 'react-router'
import { Badge } from '@repo/ui/components/ui/badge.tsx'
import { Button } from '@repo/ui/components/ui/button.tsx'
import {
    FileText,
    LayoutTemplate,
    Cpu,
    CheckCircle2,
    AlertCircle,
    Clock,
    Loader2,
    ArrowRight,
    Sparkles,
    Plus
} from 'lucide-react'
import {
    urlDocuments,
    urlExtractions,
    urlTemplates
} from '@/urls'
import type { route } from './route'

function StatusIcon({ status }: { status: string }) {
    if (status === 'done')
        return <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
    if (status === 'error') return <AlertCircle className="size-3.5 text-destructive" />
    if (status === 'processing')
        return <Loader2 className="size-3.5 animate-spin text-violet-500" />
    return <Clock className="size-3.5 text-muted-foreground" />
}

const stats = [
    {
        key: 'templates' as const,
        label: 'Templates',
        icon: LayoutTemplate,
        accent: 'text-violet-600 dark:text-violet-400',
        href: urlTemplates()
    },
    {
        key: 'documents' as const,
        label: 'Documents',
        icon: FileText,
        accent: 'text-indigo-600 dark:text-indigo-400',
        href: urlDocuments()
    },
    {
        key: 'extractions' as const,
        label: 'Extractions',
        icon: Cpu,
        accent: 'text-fuchsia-600 dark:text-fuchsia-400',
        href: urlExtractions()
    },
    {
        key: 'done' as const,
        label: 'Completed',
        icon: CheckCircle2,
        accent: 'text-emerald-600 dark:text-emerald-400',
        href: urlExtractions()
    }
]

export function Dashboard() {
    const { stats: data } = useLoaderData<typeof route.loader>()

    return (
        <div className="flex flex-col gap-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                        Overview of your workspace.
                    </p>
                </div>
                <Button asChild size="sm" className="gap-1.5">
                    <Link to={urlTemplates()} viewTransition>
                        <Sparkles className="size-3.5" />
                        Run extraction
                    </Link>
                </Button>
            </header>

            {/* Stats — single row, Linear-like */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border/60 lg:grid-cols-4">
                {stats.map((s) => (
                    <Link
                        key={s.key}
                        to={s.href}
                        viewTransition
                        className="group flex flex-col gap-2 bg-card p-4 transition-colors hover:bg-muted/40"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
                                {s.label}
                            </span>
                            <s.icon className={`size-3.5 ${s.accent}`} />
                        </div>
                        <div className="flex items-baseline justify-between">
                            <span className="tabular text-3xl font-semibold tracking-tight">
                                {data[s.key]}
                            </span>
                            <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                    </Link>
                ))}
            </div>

            {/* Two-col: recent activity + quick actions */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section>
                    <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
                            Recent activity
                        </h2>
                        <Button asChild variant="ghost" size="xs" className="text-xs">
                            <Link to={urlExtractions()} viewTransition>
                                View all
                            </Link>
                        </Button>
                    </div>
                    {data.recentExtractions.length === 0 ? (
                        <div className="dropzone flex flex-col items-center justify-center gap-3 rounded-xl py-12">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                                <Cpu className="size-5 text-muted-foreground" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium">No activity yet</p>
                                <p className="text-[13px] text-muted-foreground">
                                    Open a template and upload a document to get started.
                                </p>
                            </div>
                            <Button asChild variant="outline" size="sm" className="gap-1.5">
                                <Link to={urlTemplates()} viewTransition>
                                    <Sparkles className="size-3.5" />
                                    Browse templates
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="row-list">
                            {data.recentExtractions.map((ext) => (
                                <Link
                                    key={ext.id}
                                    to={urlExtractions()}
                                    viewTransition
                                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                                >
                                    <StatusIcon status={ext.status} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">
                                            Extraction #{ext.id}
                                        </p>
                                        <p className="truncate text-[11px] text-muted-foreground tabular">
                                            Document #{ext.documentId} · Template #
                                            {ext.templateId}
                                        </p>
                                    </div>
                                    <Badge
                                        variant={
                                            ext.status === 'done'
                                                ? 'default'
                                                : ext.status === 'error'
                                                  ? 'destructive'
                                                  : 'secondary'
                                        }
                                        className="capitalize"
                                    >
                                        {ext.status}
                                    </Badge>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                <aside className="flex flex-col gap-2">
                    <h2 className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
                        Quick actions
                    </h2>
                    <Link
                        to={urlTemplates()}
                        viewTransition
                        className="group flex items-start gap-3 rounded-xl border bg-gradient-to-br from-indigo-500/8 via-violet-500/8 to-fuchsia-500/8 p-4 transition-colors hover:bg-muted/40"
                    >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-violet-500/20">
                            <Sparkles className="size-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">Run an extraction</p>
                            <p className="text-[12px] text-muted-foreground">
                                Open a template, upload a doc.
                            </p>
                        </div>
                        <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link
                        to={urlTemplates()}
                        viewTransition
                        className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
                    >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Plus className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">Create a template</p>
                            <p className="text-[12px] text-muted-foreground">
                                Define the JSON schema for a doc type.
                            </p>
                        </div>
                        <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link
                        to={urlDocuments()}
                        viewTransition
                        className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
                    >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <FileText className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">Upload a document</p>
                            <p className="text-[12px] text-muted-foreground">
                                PDFs and images, up to 10 MB.
                            </p>
                        </div>
                        <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </aside>
            </div>
        </div>
    )
}
