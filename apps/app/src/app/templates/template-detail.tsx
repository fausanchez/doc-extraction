import { Link, useLoaderData, useNavigate, useRevalidator } from 'react-router'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Badge } from '@repo/ui/components/ui/badge.tsx'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@repo/ui/components/ui/dropdown-menu.tsx'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@repo/ui/components/ui/dialog.tsx'
import {
    Upload,
    FileText,
    Sparkles,
    Trash2,
    Edit,
    MoreHorizontal,
    ArrowLeft,
    Code2,
    Hash,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Clock,
    Play,
    X
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
    documentsApi,
    extractionsApi,
    templatesApi,
    type Document,
    type Extraction,
    type TemplateField
} from '@/api-client'
import { urlBilling, urlTemplates, urlExtractions } from '@/urls'
import { cn } from '@repo/ui/lib/utils.ts'
import { toast } from 'sonner'
import type { route } from './detail-route'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp'
const MAX_BYTES = 10 * 1024 * 1024

function statusVariant(status: string) {
    if (status === 'done') return 'default'
    if (status === 'error') return 'destructive'
    return 'secondary'
}

function StatusIcon({ status }: { status: string }) {
    if (status === 'done') return <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
    if (status === 'error') return <AlertCircle className="size-3.5 text-destructive" />
    if (status === 'processing') return <Loader2 className="size-3.5 animate-spin text-violet-500" />
    return <Clock className="size-3.5 text-muted-foreground" />
}

// Shared error toast for extraction-start failures. Quota responses ship a
// `usage` field (HTTP 402) — surface those with an upgrade affordance instead
// of a generic error toast.
function showExtractionError(res: { error: true; message: string } & { usage?: unknown }): void {
    if ('usage' in res && res.usage) {
        toast.error(res.message, {
            action: {
                label: 'See plans',
                onClick: () => {
                    window.location.href = urlBilling()
                }
            }
        })
        return
    }
    toast.error(res.message)
}

export function TemplateDetail() {
    const { template, documents, extractions } = useLoaderData<typeof route.loader>()
    const { revalidate } = useRevalidator()
    const navigate = useNavigate()

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [dragOver, setDragOver] = useState(false)
    const [busy, setBusy] = useState<null | 'upload' | 'run'>(null)
    const [progress, setProgress] = useState<string | null>(null)
    const [selectedExtraction, setSelectedExtraction] = useState<Extraction | null>(null)
    const [pickerOpen, setPickerOpen] = useState(false)

    const fields = useMemo<TemplateField[]>(() => {
        try {
            return JSON.parse(template.schema) as TemplateField[]
        } catch {
            return []
        }
    }, [template.schema])

    const templateExtractions = useMemo(
        () =>
            extractions
                .filter((e) => e.templateId === template.id)
                .sort((a, b) => b.createdAt - a.createdAt),
        [extractions, template.id]
    )

    // Polling: while there are pending/processing extractions, refresh.
    useEffect(() => {
        const hasInflight = templateExtractions.some(
            (e) => e.status === 'pending' || e.status === 'processing'
        )
        if (!hasInflight) return
        const id = setInterval(() => revalidate(), 3000)
        return () => clearInterval(id)
    }, [templateExtractions, revalidate])

    const handleDelete = async () => {
        if (!confirm('Delete this template? This cannot be undone.')) return
        const res = await templatesApi.delete(template.id)
        if (res.error) {
            toast.error(res.message)
            return
        }
        toast.success('Template deleted')
        navigate(urlTemplates(), { viewTransition: true })
    }

    const runWithFile = async (file: File) => {
        if (file.size > MAX_BYTES) {
            toast.error('File is larger than 10 MB')
            return
        }
        setBusy('upload')
        setProgress(`Uploading ${file.name}…`)
        try {
            const upload = await documentsApi.upload(file)
            if (upload.error) {
                toast.error(upload.message)
                return
            }
            setBusy('run')
            setProgress(`Running extraction…`)
            const run = await extractionsApi.start(upload.data.id, template.id)
            if (run.error) {
                showExtractionError(run)
                return
            }
            toast.success('Extraction started')
            revalidate()
        } catch {
            toast.error('Failed to process document')
        } finally {
            setBusy(null)
            setProgress(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const runWithExisting = async (doc: Document) => {
        setBusy('run')
        setProgress(`Running extraction on ${doc.name}…`)
        try {
            const res = await extractionsApi.start(doc.id, template.id)
            if (res.error) {
                showExtractionError(res)
                return
            }
            toast.success('Extraction started')
            setPickerOpen(false)
            revalidate()
        } catch {
            toast.error('Failed to start extraction')
        } finally {
            setBusy(null)
            setProgress(null)
        }
    }

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (f) runWithFile(f)
    }

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) runWithFile(f)
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Page header */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <Button variant="ghost" size="icon-sm" asChild>
                        <Link to={urlTemplates()} viewTransition aria-label="Back to templates">
                            <ArrowLeft className="size-4" />
                        </Link>
                    </Button>
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 ring-1 ring-inset ring-violet-500/15">
                        <Sparkles className="size-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="truncate text-xl font-semibold tracking-tight">
                                {template.name}
                            </h1>
                            <Badge variant="outline" className="tabular gap-1">
                                <Hash className="size-3" />
                                {fields.length} fields
                            </Badge>
                        </div>
                        {template.description && (
                            <p className="mt-0.5 max-w-2xl text-[13px] text-muted-foreground">
                                {template.description}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!!busy}
                    >
                        {busy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <Upload className="size-3.5" />
                        )}
                        {busy ? 'Processing…' : 'Upload & extract'}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon-sm" aria-label="More actions">
                                <MoreHorizontal className="size-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onSelect={() => setPickerOpen(true)}>
                                <FileText />
                                Use existing document
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled>
                                <Edit />
                                Edit schema
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
                                <Trash2 />
                                Delete template
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={onFileChange}
            />

            {/* Two-column layout */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                {/* Left: schema + recent extractions */}
                <div className="flex flex-col gap-5">
                    {/* Schema */}
                    <section>
                        <div className="mb-2 flex items-center gap-2">
                            <Code2 className="size-3.5 text-muted-foreground" />
                            <h2 className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
                                Schema
                            </h2>
                            <span className="tabular text-[11px] text-muted-foreground">
                                {fields.length} {fields.length === 1 ? 'field' : 'fields'}
                            </span>
                        </div>
                        {fields.length === 0 ? (
                            <div className="rounded-xl border bg-card p-5 text-[13px] text-muted-foreground">
                                No fields defined yet. Edit the template to add fields.
                            </div>
                        ) : (
                            <div className="row-list">
                                {fields.map((f, i) => (
                                    <div
                                        key={`${f.key}-${i}`}
                                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
                                    >
                                        <code className="truncate font-mono text-[12px] text-foreground">
                                            {f.key || <span className="text-muted-foreground">unnamed</span>}
                                        </code>
                                        <span className="truncate text-[13px] text-muted-foreground">
                                            {f.label}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            {f.required && (
                                                <Badge variant="outline" className="text-[10px] uppercase">
                                                    required
                                                </Badge>
                                            )}
                                            <Badge variant="secondary" className="font-mono text-[10px]">
                                                {f.type}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Recent extractions */}
                    <section>
                        <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Play className="size-3.5 text-muted-foreground" />
                                <h2 className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
                                    Extractions
                                </h2>
                                <span className="tabular text-[11px] text-muted-foreground">
                                    {templateExtractions.length}
                                </span>
                            </div>
                            <Button asChild variant="ghost" size="xs" className="text-xs">
                                <Link to={urlExtractions()} viewTransition>
                                    View all
                                </Link>
                            </Button>
                        </div>

                        {templateExtractions.length === 0 ? (
                            <div className="rounded-xl border bg-card p-6 text-center">
                                <p className="text-[13px] text-muted-foreground">
                                    No extractions yet. Upload a document on the right to run your first.
                                </p>
                            </div>
                        ) : (
                            <div className="row-list">
                                {templateExtractions.map((ext) => {
                                    const doc = documents.find((d) => d.id === ext.documentId)
                                    return (
                                        <button
                                            key={ext.id}
                                            type="button"
                                            onClick={() => setSelectedExtraction(ext)}
                                            className="flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                                        >
                                            <StatusIcon status={ext.status} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">
                                                    {doc?.name ?? `Document #${ext.documentId}`}
                                                </p>
                                                <p className="truncate text-[11px] text-muted-foreground">
                                                    Extraction #{ext.id} ·{' '}
                                                    {new Date(ext.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                            <Badge
                                                variant={statusVariant(ext.status)}
                                                className="capitalize"
                                            >
                                                {ext.status}
                                            </Badge>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </section>
                </div>

                {/* Right: sticky upload panel */}
                <aside className="lg:sticky lg:top-20 lg:h-fit">
                    <div className="rounded-xl border bg-card">
                        <div className="border-b px-4 py-3">
                            <h2 className="text-sm font-semibold">Run extraction</h2>
                            <p className="text-[12px] text-muted-foreground">
                                Drop a file to run it through this template.
                            </p>
                        </div>

                        <div className="p-3">
                            <button
                                type="button"
                                onClick={() => !busy && fileInputRef.current?.click()}
                                onDragOver={(e) => {
                                    e.preventDefault()
                                    setDragOver(true)
                                }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={onDrop}
                                disabled={!!busy}
                                data-active={dragOver}
                                className={cn(
                                    'dropzone flex w-full flex-col items-center justify-center gap-2 rounded-lg p-6 text-center transition-colors',
                                    'cursor-pointer hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-70'
                                )}
                            >
                                <div className="flex size-10 items-center justify-center rounded-full bg-background ring-1 ring-border">
                                    {busy ? (
                                        <Loader2 className="size-5 animate-spin text-violet-500" />
                                    ) : (
                                        <Upload className="size-5 text-muted-foreground" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-medium">
                                        {busy
                                            ? progress ?? 'Working…'
                                            : 'Drop file or click to upload'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        PDF, JPG, PNG, WebP · up to 10 MB
                                    </p>
                                </div>
                            </button>

                            <div className="my-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                                <span className="h-px flex-1 bg-border" />
                                or
                                <span className="h-px flex-1 bg-border" />
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start gap-2"
                                onClick={() => setPickerOpen(true)}
                                disabled={!!busy || documents.length === 0}
                            >
                                <FileText className="size-3.5" />
                                Use existing document
                                {documents.length > 0 && (
                                    <Badge
                                        variant="secondary"
                                        className="ml-auto tabular text-[10px]"
                                    >
                                        {documents.length}
                                    </Badge>
                                )}
                            </Button>
                        </div>

                        <div className="border-t px-4 py-2.5 text-[11px] text-muted-foreground">
                            Files are stored encrypted on Cloudflare R2.
                        </div>
                    </div>
                </aside>
            </div>

            {/* Existing-document picker */}
            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                <DialogContent className="max-h-[80vh] max-w-md overflow-hidden p-0">
                    <DialogHeader className="border-b px-4 py-3">
                        <DialogTitle className="text-sm">Pick a document</DialogTitle>
                    </DialogHeader>
                    {documents.length === 0 ? (
                        <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                            No documents available. Upload one first.
                        </div>
                    ) : (
                        <div className="max-h-[60vh] divide-y overflow-y-auto">
                            {documents.map((d) => (
                                <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => runWithExisting(d)}
                                    disabled={!!busy}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
                                >
                                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{d.name}</p>
                                        <p className="text-[11px] tabular text-muted-foreground">
                                            {(d.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                    <Sparkles className="size-3.5 text-violet-500 opacity-0 transition-opacity hover:opacity-100" />
                                </button>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Result dialog */}
            <Dialog
                open={!!selectedExtraction}
                onOpenChange={(o) => !o && setSelectedExtraction(null)}
            >
                <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden p-0">
                    <DialogHeader className="flex-row items-center justify-between border-b px-4 py-3">
                        <div className="flex items-center gap-2">
                            <DialogTitle className="text-sm">
                                Extraction #{selectedExtraction?.id}
                            </DialogTitle>
                            {selectedExtraction && (
                                <Badge
                                    variant={statusVariant(selectedExtraction.status)}
                                    className="capitalize"
                                >
                                    {selectedExtraction.status}
                                </Badge>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setSelectedExtraction(null)}
                            aria-label="Close"
                        >
                            <X className="size-3.5" />
                        </Button>
                    </DialogHeader>
                    <div className="max-h-[65vh] overflow-y-auto p-4">
                        {selectedExtraction?.status === 'done' && (
                            <pre className="overflow-auto rounded-lg bg-muted p-4 font-mono text-[12px] leading-relaxed">
                                {(() => {
                                    try {
                                        return JSON.stringify(
                                            JSON.parse(selectedExtraction.result || '{}'),
                                            null,
                                            2
                                        )
                                    } catch {
                                        return selectedExtraction.result || ''
                                    }
                                })()}
                            </pre>
                        )}
                        {selectedExtraction?.status === 'error' && (
                            <p className="text-sm text-destructive">
                                {selectedExtraction.errorMessage || 'Unknown error'}
                            </p>
                        )}
                        {selectedExtraction?.status === 'pending' && (
                            <p className="text-sm text-muted-foreground">
                                The extraction is queued for processing.
                            </p>
                        )}
                        {selectedExtraction?.status === 'processing' && (
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
