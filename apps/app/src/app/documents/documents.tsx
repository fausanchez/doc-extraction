import { useLoaderData, useRevalidator } from 'react-router'
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
    Upload,
    Trash2,
    FileText,
    MoreHorizontal,
    CheckCircle2,
    AlertCircle,
    Clock,
    Loader2
} from 'lucide-react'
import { useRef, useState } from 'react'
import { documentsApi, type Document } from '@/api-client'
import { EmptyState } from '@/components/empty-state'
import { Pagination, paginate } from '@/components/pagination'
import { toast } from 'sonner'
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

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function relativeTime(ts: number) {
    const diff = Date.now() - ts
    const m = Math.round(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.round(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.round(h / 24)
    if (d < 30) return `${d}d ago`
    return new Date(ts).toLocaleDateString()
}

export function Documents() {
    const { documents } = useLoaderData<typeof route.loader>()
    const { revalidate } = useRevalidator()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [page, setPage] = useState(1)
    const paged = paginate(documents, page, PAGE_SIZE)

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const res = await documentsApi.upload(file)
            if (res.error) {
                toast.error(res.message)
                return
            }
            toast.success('Document uploaded')
            revalidate()
        } catch {
            toast.error('Failed to upload document')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleDelete = async (doc: Document) => {
        try {
            await documentsApi.delete(doc.id)
            toast.success('Document deleted')
            revalidate()
        } catch {
            toast.error('Failed to delete document')
        }
    }

    return (
        <div className="flex flex-col gap-5">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold tracking-tight">Documents</h1>
                        <Badge variant="secondary" className="tabular">
                            {documents.length}
                        </Badge>
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                        Files available for extraction. Open a template to run one.
                    </p>
                </div>
                <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    size="sm"
                    className="gap-1.5"
                >
                    {uploading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                        <Upload className="size-3.5" />
                    )}
                    {uploading ? 'Uploading…' : 'Upload document'}
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={handleUpload}
                />
            </header>

            {documents.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title="No documents yet"
                    description="Upload a file or open a template to start an extraction."
                    action={
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="gap-1.5"
                        >
                            <Upload className="size-3.5" />
                            Upload document
                        </Button>
                    }
                />
            ) : (
                <>
                    <div className="row-list">
                    {paged.map((doc) => (
                        <div
                            key={doc.id}
                            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                        >
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{doc.name}</p>
                                <p className="truncate text-[11px] tabular text-muted-foreground">
                                    {formatBytes(doc.size)} · {relativeTime(doc.createdAt)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusIcon status={doc.status} />
                                <Badge
                                    variant={statusVariant(doc.status)}
                                    className="capitalize"
                                >
                                    {doc.status}
                                </Badge>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon-sm" aria-label="Actions">
                                        <MoreHorizontal className="size-3.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem disabled>Download</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={() => handleDelete(doc)}
                                    >
                                        <Trash2 />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                    </div>
                    <Pagination
                        page={page}
                        pageSize={PAGE_SIZE}
                        total={documents.length}
                        onPage={setPage}
                    />
                </>
            )}
        </div>
    )
}
