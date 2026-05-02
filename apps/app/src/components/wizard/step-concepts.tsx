import { Button } from '@repo/ui/components/ui/button.tsx'
import { LayoutTemplate, FileText, Cpu, ArrowRight } from 'lucide-react'

const CONCEPTS = [
    {
        icon: LayoutTemplate,
        color: 'text-violet-500',
        bg: 'bg-violet-500/10',
        title: 'Template',
        desc: 'A reusable schema that defines the fields you want to extract — like "invoice number", "vendor", "total amount".'
    },
    {
        icon: FileText,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        title: 'Document',
        desc: 'The source file you want to process. Upload a PDF or image and it gets stored securely.'
    },
    {
        icon: Cpu,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        title: 'Extraction',
        desc: 'The AI reads your document through the lens of your template and returns clean, structured JSON.'
    }
]

export function StepConcepts({ onNext }: { onNext: () => void }) {
    return (
        <div className="flex flex-col gap-6 px-8 py-10">
            <div className="text-center">
                <h2 className="text-xl font-bold tracking-tight">How it works</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Three building blocks — that's all you need.
                </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row">
                {CONCEPTS.map((c, i) => (
                    <div key={c.title} className="flex flex-1 flex-col items-start gap-3 sm:flex-row sm:items-start">
                        <div className="flex flex-1 flex-col gap-2 rounded-xl border p-4">
                            <div className={`flex size-9 items-center justify-center rounded-lg ${c.bg}`}>
                                <c.icon className={`size-4.5 ${c.color}`} />
                            </div>
                            <p className="font-semibold">{c.title}</p>
                            <p className="text-[13px] leading-relaxed text-muted-foreground">{c.desc}</p>
                        </div>
                        {i < CONCEPTS.length - 1 && (
                            <ArrowRight className="mx-1 mt-6 hidden size-4 shrink-0 text-muted-foreground/40 sm:block" />
                        )}
                    </div>
                ))}
            </div>

            <div className="flex justify-end">
                <Button onClick={onNext} className="gap-1.5">
                    Create your first template →
                </Button>
            </div>
        </div>
    )
}
