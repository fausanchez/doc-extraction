import { Link, useLoaderData, useRevalidator } from 'react-router'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Badge } from '@repo/ui/components/ui/badge.tsx'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@repo/ui/components/ui/dialog.tsx'
import {
    Cpu,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Clock,
    Loader2,
    X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { type Extraction } from '@/api-client'
import { EmptyState } from '@/components/empty-state'
import { Pagination, paginate } from '@/components/pagination'
import { urlTemplate, urlTemplates } from '@/urls'
import type { route } from './route'

const PAGE_SIZE = 25

function statusVariant(status: string) {
    if (status === 'done') return 'default'
    if (status === 'error') return 'destructive'
    return 'secondary'
}

function StatusIcon({ status }: { status: string }) {
    if (status === 'done')
        return <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
    if (status === 'error') return <AlertCircle className="size-3.5 text-destructive" />
    if (status === 'processing')
        return <Loader2 className="size-3.5 animate-spin text-violet-500" />
    return <Clock className="size-3.5 text-muted-foreground" />
}

export function Extractions() {
    const { extractions, documents, templates } = useLoaderData<typeof route.loader>()
    const { revalidate } = useRevalidator()
    const [selected, setSelected] = useState<Extraction | null>(null)
    const [page, setPage] = useState(1)
    const paged = paginate(extractions, page, PAGE_SIZE)

    // Auto-refresh while jobs are in flight
    useEffect(() => {
        const inflight = extractions.some(
            (e) => e.status === 'pending' || e.status === 'processing'
        )
        if (!inflight) return
        const id = setInterval(() => revalidate(), 3000)
        return () => clearInterval(id)
    }, [extractions, revalidate])

    return (
        <div className="flex flex-col gap-5">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold tracking-tight">Extractions</h1>
                        <Badge variant="secondary" className="tabular">
                            {extractions.length}
                        </Badge>
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                        Jobs run against your documents. Start one from a template.
                    </p>
                </div>
                <Button asChild size="sm" className="gap-1.5">
                    <Link to={urlTemplates()} viewTransition>
                        <Sparkles className="size-3.5" />
                        New extraction
                    </Link>
                </Button>
            </header>

            {extractions.length === 0 ? (
                <EmptyState
                    icon={Cpu}
                    title="No extractions yet"
                    description="Open a template and upload a document to run your first."
                    action={
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                            <Link to={urlTemplates()} viewTransition>
                                <Sparkles className="size-3.5" />
                                Browse templates
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <>
                    <div className="row-list">
                    {paged.map((ext) => {
                        const doc = documents.find((d) => d.id === ext.documentId)
                        const tmpl = templates.find((t) => t.id === ext.templateId)
                        return (
                            <button
                                key={ext.id}
                                type="button"
                                onClick={() => setSelected(ext)}
                                className="flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                            >
                                <StatusIcon status={ext.status} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        {doc?.name ?? `Document #${ext.documentId}`}
                                    </p>
                                    <p className="truncate text-[11px] text-muted-foreground">
                                        Template:{' '}
                                        {tmpl ? (
                                            <Link
                                                to={urlTemplate(tmpl.id)}
                                                viewTransition
                                                onClick={(e) => e.stopPropagation()}
                                                className="hover:underline"
                                            >
                                                {tmpl.name}
                                            </Link>
                                        ) : (
                                            `#${ext.templateId}`
                                        )}
                                        {' · '}
                                        <span className="tabular">#{ext.id}</span>
                                    </p>
                                </div>
                                <span className="hidden text-[11px] tabular text-muted-foreground md:block">
                                    {new Date(ext.createdAt).toLocaleString()}
                                </span>
                                <Badge variant={statusVariant(ext.status)} className="capitalize">
                                    {ext.status}
                                </Badge>
                            </button>
                        )
                    })}
                    </div>
                    <Pagination
                        page={page}
                        pageSize={PAGE_SIZE}
                        total={extractions.length}
                        onPage={setPage}
                    />
                </>
            )}

            <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
                <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden p-0">
                    <DialogHeader className="flex-row items-center justify-between border-b px-4 py-3">
                        <div className="flex items-center gap-2">
                            <DialogTitle className="text-sm">
                                Extraction #{selected?.id}
                            </DialogTitle>
                            {selected && (
                                <Badge
                                    variant={statusVariant(selected.status)}
                                    className="capitalize"
                                >
                                    {selected.status}
                                </Badge>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setSelected(null)}
                            aria-label="Close"
                        >
                            <X className="size-3.5" />
                        </Button>
                    </DialogHeader>
                    <div className="max-h-[65vh] overflow-y-auto p-4">
                        {selected?.status === 'done' && (
                            <pre className="overflow-auto rounded-lg bg-muted p-4 font-mono text-[12px] leading-relaxed">
                                {(() => {
                                    try {
                                        return JSON.stringify(
                                            JSON.parse(selected.result || '{}'),
                                            null,
                                            2
                                        )
                                    } catch {
                                        return selected.result || ''
                                    }
                                })()}
                            </pre>
                        )}
                        {selected?.status === 'error' && (
                            <p className="text-sm text-destructive">
                                {selected.errorMessage || 'Unknown error'}
                            </p>
                        )}
                        {selected?.status === 'pending' && (
                            <p className="text-sm text-muted-foreground">
                                The extraction is queued for processing.
                            </p>
                        )}
                        {selected?.status === 'processing' && (
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" />
                                Processing…
                            </p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
