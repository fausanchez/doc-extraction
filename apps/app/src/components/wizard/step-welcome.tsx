import { Button } from '@repo/ui/components/ui/button.tsx'
import { Sparkles } from 'lucide-react'

export function StepWelcome({ onNext }: { onNext: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center gap-6 px-8 py-14 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg">
                <Sparkles className="size-8 text-white" />
            </div>

            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Welcome to dvop.io</h2>
                <p className="max-w-md text-muted-foreground">
                    Turn any PDF or image into clean, structured JSON in seconds — no code needed.
                </p>
            </div>

            <ul className="space-y-3 text-left text-sm">
                {[
                    ['📋', 'Define a template', 'Describe the fields you want to extract'],
                    ['📄', 'Upload a document', 'PDF, JPG, PNG or WebP — up to 10 MB'],
                    ['✨', 'Get structured data', 'AI returns your data as ready-to-use JSON']
                ].map(([emoji, title, desc]) => (
                    <li key={title} className="flex items-start gap-3">
                        <span className="text-xl leading-none">{emoji}</span>
                        <span>
                            <span className="font-medium">{title}</span>
                            <span className="text-muted-foreground"> — {desc}</span>
                        </span>
                    </li>
                ))}
            </ul>

            <Button onClick={onNext} className="mt-2 gap-1.5 px-8">
                Let's go →
            </Button>
        </div>
    )
}
