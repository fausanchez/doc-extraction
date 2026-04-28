import { useLoaderData, useRevalidator } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@repo/ui/components/ui/card.tsx'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Badge } from '@repo/ui/components/ui/badge.tsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@repo/ui/components/ui/dialog.tsx'
import { Input } from '@repo/ui/components/ui/input.tsx'
import { Label } from '@repo/ui/components/ui/label.tsx'
import { LayoutTemplate, Plus, Trash2, Edit } from 'lucide-react'
import { useState } from 'react'
import { templatesApi, type Template, type TemplateField } from '@/api-client'
import { toast } from 'sonner'
import type { route } from './route'

const FIELD_TYPES = ['string', 'number', 'date', 'boolean', 'array'] as const

const emptyField = (): TemplateField => ({
    key: '',
    label: '',
    type: 'string',
    required: false,
    description: ''
})

export function Templates() {
    const { templates } = useLoaderData<typeof route.loader>()
    const { revalidate } = useRevalidator()
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState<Template | null>(null)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [fields, setFields] = useState<TemplateField[]>([emptyField()])
    const [saving, setSaving] = useState(false)

    const openCreate = () => {
        setEditing(null)
        setName('')
        setDescription('')
        setFields([emptyField()])
        setOpen(true)
    }

    const openEdit = (t: Template) => {
        setEditing(t)
        setName(t.name)
        setDescription(t.description)
        try {
            setFields(JSON.parse(t.schema) as TemplateField[])
        } catch {
            setFields([emptyField()])
        }
        setOpen(true)
    }

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Name is required')
            return
        }
        setSaving(true)
        try {
            const payload = { name: name.trim(), description: description.trim(), schema: fields.filter((f) => f.key && f.label) }
            const res = editing
                ? await templatesApi.update(editing.id, payload)
                : await templatesApi.create(payload)
            if (res.error) {
                toast.error(res.message)
                return
            }
            toast.success(editing ? 'Template updated' : 'Template created')
            setOpen(false)
            revalidate()
        } catch {
            toast.error('Failed to save template')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (t: Template) => {
        try {
            await templatesApi.delete(t.id)
            toast.success('Template deleted')
            revalidate()
        } catch {
            toast.error('Failed to delete template')
        }
    }

    const updateField = (i: number, patch: Partial<TemplateField>) => {
        setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Templates</h1>
                    <p className="text-muted-foreground text-sm">Define your extraction schemas</p>
                </div>
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="size-4" />
                    New template
                </Button>
            </div>

            {templates.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12">
                        <LayoutTemplate className="text-muted-foreground size-10" />
                        <p className="text-muted-foreground text-sm">No templates yet</p>
                        <Button variant="outline" onClick={openCreate} className="gap-2">
                            <Plus className="size-4" />
                            Create your first
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map((t) => {
                        let fieldCount = 0
                        try { fieldCount = (JSON.parse(t.schema) as TemplateField[]).length } catch { /* */ }
                        return (
                            <Card key={t.id}>
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <CardTitle className="text-base truncate">{t.name}</CardTitle>
                                            {t.description && (
                                                <CardDescription className="mt-1 line-clamp-2">{t.description}</CardDescription>
                                            )}
                                        </div>
                                        <Badge variant="secondary" className="shrink-0">{fieldCount} fields</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex items-center justify-end gap-2">
                                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)}>
                                        <Edit className="size-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => handleDelete(t)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit template' : 'New template'}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="E.g. Invoice" />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="description">Description (optional)</Label>
                            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="E.g. For extracting data from supplier invoices" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Fields to extract</Label>
                            {fields.map((field, i) => (
                                <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center rounded-lg border p-3">
                                    <Input
                                        placeholder="key (e.g. invoice_number)"
                                        value={field.key}
                                        onChange={(e) => updateField(i, { key: e.target.value })}
                                    />
                                    <Input
                                        placeholder="label (e.g. Invoice Number)"
                                        value={field.label}
                                        onChange={(e) => updateField(i, { label: e.target.value })}
                                    />
                                    <select
                                        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
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
                            <Button variant="outline" size="sm" onClick={() => setFields((prev) => [...prev, emptyField()])} className="gap-1.5 self-start">
                                <Plus className="size-3.5" />
                                Add field
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editing ? 'Save changes' : 'Create template'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
