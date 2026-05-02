import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { documentsApi, extractionsApi, type Extraction, type Template } from '@/api-client'
import { cn } from '@repo/ui/lib/utils'
import { toast } from 'sonner'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp'
const MAX_BYTES = 10 * 1024 * 1024
const POLL_MS = 2000

type Phase = 'idle' | 'uploading' | 'extracting' | 'done' | 'error'

export function StepExtract({
    template,
    onDone,
    onSkip
}: {
    template: Template | null
    onDone: (e: Extraction) => void
    onSkip: () => void
}) {
    const [phase, setPhase] = useState<Phase>('idle')
    const [dragOver, setDragOver] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

    const run = useCallback(async (file: File) => {
        if (file.size > MAX_BYTES) { toast.error('File exceeds 10 MB'); return }
        setPhase('uploading')
        setErrorMsg('')

        try {
            const uploadRes = await documentsApi.upload(file)
            if (uploadRes.error) { setPhase('error'); setErrorMsg(uploadRes.message); return }

            if (!template) {
                // No template was created — skip extraction silently
                onSkip()
                return
            }

            setPhase('extracting')
            const extRes = await extractionsApi.start(uploadRes.data.id, template.id)
            if (extRes.error) { setPhase('error'); setErrorMsg(extRes.message); return }

            const extractionId = extRes.data.id
            pollRef.current = setInterval(async () => {
                try {
                    const poll = await extractionsApi.get(extractionId)
                    if (poll.error) return
                    if (poll.data.status === 'done') {
                        clearInterval(pollRef.current!)
                        setPhase('done')
                        onDone(poll.data)
                    } else if (poll.data.status === 'error') {
                        clearInterval(pollRef.current!)
                        setPhase('error')
                        setErrorMsg(poll.data.errorMessage || 'Extraction failed')
                    }
                } catch {}
            }, POLL_MS)
        } catch {
            setPhase('error')
            setErrorMsg('Something went wrong. Please try again.')
        }
    }, [template, onDone, onSkip])

    const handleFiles = (files: FileList | null) => {
        const file = files?.[0]
        if (file) run(file)
    }

    return (
        <div className="flex flex-col gap-6 px-8 py-10">
            <div>
                <h2 className="text-xl font-bold tracking-tight">Upload a document</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    {template
                        ? <>We'll extract data using <span className="font-medium text-foreground">{template.name}</span>.</>
                        : 'Upload any PDF or image to see how extraction works.'}
                </p>
            </div>

            {phase === 'idle' || phase === 'error' ? (
                <>
                    <div
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
                        className={cn(
                            'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed py-12 transition-colors',
                            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/50'
                        )}
                    >
                        <Upload className="size-8 text-muted-foreground/50" />
                        <div className="text-center">
                            <p className="text-sm font-medium">Drop a file here, or click to browse</p>
                            <p className="text-xs text-muted-foreground">PDF, JPG, PNG, WebP — up to 10 MB</p>
                        </div>
                        <input
                            ref={inputRef}
                            type="file"
                            accept={ACCEPT}
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                    </div>
                    {phase === 'error' && (
                        <p className="flex items-center gap-1.5 text-sm text-destructive">
                            <AlertCircle className="size-4" /> {errorMsg}
                        </p>
                    )}
                </>
            ) : phase === 'uploading' ? (
                <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Uploading document…</p>
                </div>
            ) : phase === 'extracting' ? (
                <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="size-8 animate-spin text-violet-500" />
                    <p className="text-sm font-medium">Extracting data…</p>
                    <p className="text-xs text-muted-foreground">The AI is reading your document</p>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3 py-12">
                    <CheckCircle2 className="size-8 text-emerald-500" />
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Extraction complete!</p>
                </div>
            )}

            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
                    Skip this step
                </Button>
                {phase === 'done' && (
                    <Button onClick={onSkip} className="gap-1.5">
                        See result →
                    </Button>
                )}
            </div>
        </div>
    )
}
