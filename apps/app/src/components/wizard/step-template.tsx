import { useState } from 'react'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Input } from '@repo/ui/components/ui/input.tsx'
import { Label } from '@repo/ui/components/ui/label.tsx'
import { Plus, Trash2 } from 'lucide-react'
import { templatesApi, type Template, type TemplateField } from '@/api-client'
import { toast } from 'sonner'

const PRESET_FIELDS: TemplateField[] = [
    { key: 'vendor_name', label: 'Vendor name', type: 'string', required: true, description: '' },
    { key: 'invoice_number', label: 'Invoice number', type: 'string', required: true, description: '' },
    { key: 'date', label: 'Date', type: 'date', required: false, description: '' },
    { key: 'total_amount', label: 'Total amount', type: 'number', required: false, description: '' }
]

const FIELD_TYPES = ['string', 'number', 'date', 'boolean', 'array'] as const

const emptyField = (): TemplateField => ({
    key: '', label: '', type: 'string', required: false, description: ''
})

export function StepTemplate({
    onNext,
    onSkip
}: {
    onNext: (template: Template) => void
    onSkip: () => void
}) {
    const [name, setName] = useState('Invoice extractor')
    const [fields, setFields] = useState<TemplateField[]>(PRESET_FIELDS)
    const [saving, setSaving] = useState(false)

    const updateField = (i: number, patch: Partial<TemplateField>) =>
        setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))

    const handleCreate = async () => {
        if (!name.trim()) { toast.error('Name is required'); return }
        setSaving(true)
        try {
            const res = await templatesApi.create({
                name: name.trim(),
                description: 'Created during onboarding',
                schema: fields.filter((f) => f.key && f.label)
            })
            if (res.error) { toast.error(res.message); return }
            onNext(res.data)
        } catch {
            toast.error('Failed to create template')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex flex-col gap-5 overflow-y-auto px-8 py-8" style={{ maxHeight: '440px' }}>
            <div>
                <h2 className="text-xl font-bold tracking-tight">Create your first template</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    We've pre-filled an invoice example — edit it or use it as-is.
                </p>
            </div>

            <div className="grid gap-1.5">
                <Label htmlFor="wiz-name">Template name</Label>
                <Input
                    id="wiz-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g. Invoice extractor"
                />
            </div>

            <div className="flex flex-col gap-2">
                <Label>Fields to extract</Label>
                {fields.map((field, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 rounded-lg border p-2">
                        <Input
                            placeholder="key"
                            value={field.key}
                            onChange={(e) => updateField(i, { key: e.target.value })}
                        />
                        <Input
                            placeholder="label"
                            value={field.label}
                            onChange={(e) => updateField(i, { label: e.target.value })}
                        />
                        <select
                            className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
                            value={field.type}
                            onChange={(e) => updateField(i, { type: e.target.value as TemplateField['type'] })}
                        >
                            {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}
                            disabled={fields.length === 1}
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                ))}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFields((prev) => [...prev, emptyField()])}
                    className="gap-1.5 self-start"
                >
                    <Plus className="size-3.5" />
                    Add field
                </Button>
            </div>

            <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
                    Skip this step
                </Button>
                <Button onClick={handleCreate} disabled={saving} className="gap-1.5">
                    {saving ? 'Creating…' : 'Create template →'}
                </Button>
            </div>
        </div>
    )
}
