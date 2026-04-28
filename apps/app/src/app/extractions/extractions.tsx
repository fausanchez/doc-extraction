import { useLoaderData, useRevalidator } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card.tsx'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Badge } from '@repo/ui/components/ui/badge.tsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@repo/ui/components/ui/dialog.tsx'
import { Label } from '@repo/ui/components/ui/label.tsx'
import { Cpu, Play } from 'lucide-react'
import { useState } from 'react'
import { extractionsApi, documentsApi, templatesApi, type Extraction } from '@/api-client'
import { toast } from 'sonner'
import type { route } from './route'

function statusVariant(status: string) {
    if (status === 'done') return 'default'
    if (status === 'error') return 'destructive'
    return 'secondary'
}

export function Extractions() {
    const { extractions, documents, templates } = useLoaderData<typeof route.loader>()
    const { revalidate } = useRevalidator()
    const [open, setOpen] = useState(false)
    const [docId, setDocId] = useState('')
    const [templateId, setTemplateId] = useState('')
    const [starting, setStarting] = useState(false)
    const [selected, setSelected] = useState<Extraction | null>(null)

    const handleStart = async () => {
        if (!docId || !templateId) {
            toast.error('Select a document and a template')
            return
        }
        setStarting(true)
        try {
            const res = await extractionsApi.start(Number(docId), Number(templateId))
            if (res.error) {
                toast.error(res.message)
                return
            }
            toast.success('Extraction started')
            setOpen(false)
            revalidate()
        } catch {
            toast.error('Failed to start extraction')
        } finally {
            setStarting(false)
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Extractions</h1>
                    <p className="text-muted-foreground text-sm">Data extraction results</p>
                </div>
                <Button onClick={() => setOpen(true)} className="gap-2">
                    <Play className="size-4" />
                    New extraction
                </Button>
            </div>

            {extractions.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12">
                        <Cpu className="text-muted-foreground size-10" />
                        <p className="text-muted-foreground text-sm">No extractions yet</p>
                        <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
                            <Play className="size-4" />
                            Start your first
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="flex flex-col gap-3">
                    {extractions.map((ext) => {
                        const doc = documents.find((d) => d.id === ext.documentId)
                        const tmpl = templates.find((t) => t.id === ext.templateId)
                        return (
                            <Card
                                key={ext.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => setSelected(ext)}
                            >
                                <CardHeader className="flex-row items-center justify-between py-3">
                                    <div className="flex flex-col gap-0.5">
                                        <CardTitle className="text-sm">{doc?.name ?? `Document #${ext.documentId}`}</CardTitle>
                                        <span className="text-muted-foreground text-xs">
                                            Template: {tmpl?.name ?? `#${ext.templateId}`}
                                        </span>
                                    </div>
                                    <Badge variant={statusVariant(ext.status)}>{ext.status}</Badge>
                                </CardHeader>
                            </Card>
                        )
                    })}
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New extraction</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="grid gap-1.5">
                            <Label>Document</Label>
                            <select
                                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={docId}
                                onChange={(e) => setDocId(e.target.value)}
                            >
                                <option value="">Select a document</option>
                                {documents.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Template</Label>
                            <select
                                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={templateId}
                                onChange={(e) => setTemplateId(e.target.value)}
                            >
                                <option value="">Select a template</option>
                                {templates.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleStart} disabled={starting} className="gap-2">
                            <Play className="size-4" />
                            {starting ? 'Starting...' : 'Start extraction'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {selected && (
                <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Extraction result #{selected.id}</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-3">
                            <Badge variant={statusVariant(selected.status)} className="self-start">
                                {selected.status}
                            </Badge>
                            {selected.status === 'done' && (
                                <pre className="rounded-lg bg-muted p-4 text-xs overflow-auto">
                                    {JSON.stringify(JSON.parse(selected.result || '{}'), null, 2)}
                                </pre>
                            )}
                            {selected.status === 'error' && (
                                <p className="text-destructive text-sm">{selected.errorMessage || 'Unknown error'}</p>
                            )}
                            {selected.status === 'pending' && (
                                <p className="text-muted-foreground text-sm">The extraction is queued for processing.</p>
                            )}
                            {selected.status === 'processing' && (
                                <p className="text-muted-foreground text-sm">The extraction is being processed...</p>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}
