import { useLoaderData, useRevalidator } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card.tsx'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Badge } from '@repo/ui/components/ui/badge.tsx'
import { Upload, Trash2, FileText } from 'lucide-react'
import { useRef, useState } from 'react'
import { documentsApi, type Document } from '@/api-client'
import { toast } from 'sonner'
import type { route } from './route'

function statusVariant(status: string) {
    if (status === 'done') return 'default'
    if (status === 'error') return 'destructive'
    return 'secondary'
}

export function Documents() {
    const { documents } = useLoaderData<typeof route.loader>()
    const { revalidate } = useRevalidator()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)

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
            toast.success('Document uploaded successfully')
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
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Documents</h1>
                    <p className="text-muted-foreground text-sm">Manage your files for extraction</p>
                </div>
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
                    <Upload className="size-4" />
                    {uploading ? 'Uploading...' : 'Upload document'}
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={handleUpload}
                />
            </div>

            {documents.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12">
                        <FileText className="text-muted-foreground size-10" />
                        <p className="text-muted-foreground text-sm">No documents yet</p>
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                            <Upload className="size-4" />
                            Upload your first
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {documents.map((doc) => (
                        <Card key={doc.id}>
                            <CardHeader className="flex-row items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="text-muted-foreground size-4 shrink-0" />
                                    <CardTitle className="text-sm truncate">{doc.name}</CardTitle>
                                </div>
                                <Badge variant={statusVariant(doc.status)} className="shrink-0">
                                    {doc.status}
                                </Badge>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between">
                                <span className="text-muted-foreground text-xs">
                                    {(doc.size / 1024).toFixed(1)} KB
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(doc)}
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
