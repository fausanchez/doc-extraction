import { Link, useLoaderData, useRevalidator } from 'react-router'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Badge } from '@repo/ui/components/ui/badge.tsx'
import { Input } from '@repo/ui/components/ui/input.tsx'
import { Label } from '@repo/ui/components/ui/label.tsx'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@repo/ui/components/ui/dialog.tsx'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@repo/ui/components/ui/dropdown-menu.tsx'
import {
    LayoutTemplate,
    Plus,
    Trash2,
    Edit,
    ChevronRight,
    MoreHorizontal,
    Search,
    Sparkles,
    Hash
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { templatesApi, type Template, type TemplateField } from '@/api-client'
import { urlTemplate } from '@/urls'
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

function parseFields(schema: string): TemplateField[] {
    try {
        return JSON.parse(schema) as TemplateField[]
    } catch {
        return []
    }
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

export function Templates() {
    const { templates } = useLoaderData<typeof route.loader>()
    const { revalidate } = useRevalidator()
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState<Template | null>(null)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [fields, setFields] = useState<TemplateField[]>([emptyField()])
    const [saving, setSaving] = useState(false)
    const [query, setQuery] = useState('')

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return templates
        return templates.filter(
            (t) =>
                t.name.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q)
        )
    }, [templates, query])

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
        setFields(parseFields(t.schema).length ? parseFields(t.schema) : [emptyField()])
        setOpen(true)
    }

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Name is required')
            return
        }
        setSaving(true)
        try {
            const payload = {
                name: name.trim(),
                description: description.trim(),
                schema: fields.filter((f) => f.key && f.label)
            }
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
        <div className="flex flex-col gap-5">
            {/* Page header */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold tracking-tight">Templates</h1>
                        <Badge variant="secondary" className="tabular">
                            {templates.length}
                        </Badge>
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                        Define a schema, then open a template to upload a document and run extraction.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-full sm:w-64">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search templates…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="h-8 pl-8"
                        />
                    </div>
                    <Button onClick={openCreate} size="sm" className="gap-1.5">
                        <Plus className="size-3.5" />
                        New template
                    </Button>
                </div>
            </header>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="dropzone flex flex-col items-center justify-center gap-3 rounded-xl py-16">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                        <LayoutTemplate className="size-5 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium">
                            {query ? 'No matches' : 'No templates yet'}
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                            {query
                                ? 'Try a different search term.'
                                : 'Create your first schema to start extracting data.'}
                        </p>
                    </div>
                    {!query && (
                        <Button variant="outline" onClick={openCreate} size="sm" className="gap-1.5">
                            <Plus className="size-3.5" />
                            Create template
                        </Button>
                    )}
                </div>
            ) : (
                <div className="row-list">
                    {filtered.map((t) => {
                        const fieldCount = parseFields(t.schema).length
                        return (
                            <div
                                key={t.id}
                                className="group/row relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                            >
                                <Link
                                    to={urlTemplate(t.id)}
                                    viewTransition
                                    aria-label={`Open template ${t.name}`}
                                    className="absolute inset-0"
                                />
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 ring-1 ring-inset ring-violet-500/15">
                                    <LayoutTemplate className="size-4 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate text-sm font-medium">{t.name}</p>
                                        <Badge
                                            variant="outline"
                                            className="tabular hidden gap-1 text-[10px] sm:inline-flex"
                                        >
                                            <Hash className="size-2.5" />
                                            {fieldCount} fields
                                        </Badge>
                                    </div>
                                    {t.description && (
                                        <p className="truncate text-[12.5px] text-muted-foreground">
                                            {t.description}
                                        </p>
                                    )}
                                </div>
                                <span className="hidden text-[11px] tabular text-muted-foreground md:block">
                                    {relativeTime(t.createdAt)}
                                </span>
                                <div className="relative flex items-center gap-0.5">
                                    <span className="hidden items-center gap-1 rounded-md border border-transparent px-1.5 py-1 text-[11px] font-medium text-violet-600 transition-colors group-hover/row:border-violet-500/20 group-hover/row:bg-violet-500/8 dark:text-violet-400 lg:inline-flex">
                                        <Sparkles className="size-3" />
                                        Extract
                                    </span>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Actions"
                                            >
                                                <MoreHorizontal className="size-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-44">
                                            <DropdownMenuItem
                                                onSelect={(e) => {
                                                    e.preventDefault()
                                                    openEdit(t)
                                                }}
                                            >
                                                <Edit />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                variant="destructive"
                                                onSelect={(e) => {
                                                    e.preventDefault()
                                                    handleDelete(t)
                                                }}
                                            >
                                                <Trash2 />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover/row:translate-x-0.5" />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create / edit dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit template' : 'New template'}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="E.g. Invoice"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="description">Description (optional)</Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="E.g. For extracting data from supplier invoices"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Fields to extract</Label>
                            {fields.map((field, i) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 rounded-lg border p-2"
                                >
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
                                        className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
                                        value={field.type}
                                        onChange={(e) =>
                                            updateField(i, {
                                                type: e.target.value as TemplateField['type']
                                            })
                                        }
                                    >
                                        {FIELD_TYPES.map((t) => (
                                            <option key={t} value={t}>
                                                {t}
                                            </option>
                                        ))}
                                    </select>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() =>
                                            setFields((prev) => prev.filter((_, idx) => idx !== i))
                                        }
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
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create template'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
