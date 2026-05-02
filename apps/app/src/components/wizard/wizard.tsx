import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { X } from 'lucide-react'
import { wizardOpenAtom, wizardStepAtom, wizardDoneAtom } from '@/stores/wizard'
import { StepWelcome } from './step-welcome'
import { StepConcepts } from './step-concepts'
import { StepTemplate } from './step-template'
import { StepExtract } from './step-extract'
import { StepDone } from './step-done'
import { useState } from 'react'
import type { Template } from '@/api-client'
import type { Extraction } from '@/api-client'

export const TOTAL_STEPS = 5

export function Wizard() {
    const [open, setOpen] = useAtom(wizardOpenAtom)
    const [step, setStep] = useAtom(wizardStepAtom)
    const setDone = useSetAtom(wizardDoneAtom)
    // Created during the wizard — passed between steps
    const [createdTemplate, setCreatedTemplate] = useState<Template | null>(null)
    const [completedExtraction, setCompletedExtraction] = useState<Extraction | null>(null)

    if (!open) return null

    const dismiss = () => {
        setDone(true)
        setOpen(false)
        setStep(0)
    }

    const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
    const finish = () => {
        setDone(true)
        setOpen(false)
        setStep(0)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismiss} />

            {/* Card */}
            <div className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
                {/* Skip button */}
                <button
                    type="button"
                    onClick={dismiss}
                    className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <X className="size-3" />
                    Skip
                </button>

                {/* Step content */}
                <div className="min-h-[440px]">
                    {step === 0 && <StepWelcome onNext={next} />}
                    {step === 1 && <StepConcepts onNext={next} />}
                    {step === 2 && (
                        <StepTemplate
                            onNext={(t) => { setCreatedTemplate(t); next() }}
                            onSkip={next}
                        />
                    )}
                    {step === 3 && (
                        <StepExtract
                            template={createdTemplate}
                            onDone={(e) => { setCompletedExtraction(e); next() }}
                            onSkip={next}
                        />
                    )}
                    {step === 4 && (
                        <StepDone extraction={completedExtraction} onFinish={finish} />
                    )}
                </div>

                {/* Progress dots */}
                <div className="flex items-center justify-center gap-1.5 border-t py-4">
                    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all ${
                                i === step
                                    ? 'w-6 bg-primary'
                                    : i < step
                                      ? 'w-1.5 bg-primary/40'
                                      : 'w-1.5 bg-muted-foreground/20'
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
