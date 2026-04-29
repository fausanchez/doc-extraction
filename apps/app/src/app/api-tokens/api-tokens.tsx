import { useLoaderData, useRevalidator } from 'react-router'
import { useEffect, useMemo, useState } from 'react'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@repo/ui/components/ui/card.tsx'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Badge } from '@repo/ui/components/ui/badge.tsx'
import { Input } from '@repo/ui/components/ui/input.tsx'
import { Label } from '@repo/ui/components/ui/label.tsx'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@repo/ui/components/ui/dialog.tsx'
import { Plus, Copy, Trash2, KeyRound, BarChart2, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
    apiTokensApi,
    type ApiToken,
    type CreatedApiToken,
    type ApiTokenUsage
} from '@/api-client'
import type { route } from './route'

const EXPIRATION_PRESETS: { label: string; days: number | null }[] = [
    { label: '30 days', days: 30 },
    { label: '90 days', days: 90 },
    { label: '1 year', days: 365 },
    { label: 'Never', days: null }
]

function relativeTime(ms: number | null): string {
    if (!ms) return 'never'
    const diff = Date.now() - ms
    const m = Math.round(diff / 60_000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.round(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.round(h / 24)
    if (d < 30) return `${d}d ago`
    return new Date(ms).toLocaleDateString()
}

function dayLabel(ms: number): string {
    const d = new Date(ms)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ApiTokensPage() {
    const { tokens } = useLoaderData<typeof route.loader>()
    const { revalidate } = useRevalidator()

    const [createOpen, setCreateOpen] = useState(false)
    const [created, setCreated] = useState<CreatedApiToken | null>(null)

    const [usageFor, setUsageFor] = useState<ApiToken | null>(null)
    const [usage, setUsage] = useState<ApiTokenUsage | null>(null)
    const [usageLoading, setUsageLoading] = useState(false)

    const active = useMemo(() => tokens.filter((t) => t.status === 'active'), [tokens])
    const revoked = useMemo(() => tokens.filter((t) => t.status === 'revoked'), [tokens])

    useEffect(() => {
        if (!usageFor) {
            setUsage(null)
            return
        }
        setUsageLoading(true)
        apiTokensApi
            .usage(usageFor.id)
            .then((res) => {
                if (!res.error) setUsage(res.data)
            })
            .finally(() => setUsageLoading(false))
    }, [usageFor])

    const handleRevoke = async (token: ApiToken) => {
        if (!confirm(`Revoke "${token.name}"? Existing API calls using this token will start failing immediately.`)) {
            return
        }
        const res = await apiTokensApi.revoke(token.id)
        if (res.error) {
            toast.error(res.message)
            return
        }
        toast.success('Token revoked')
        revalidate()
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">API tokens</h1>
                    <p className="text-muted-foreground text-sm">
                        Programmatic access to the extraction API.
                    </p>
                </div>
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                    <Plus className="size-4" />
                    New token
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Quick start</CardTitle>
                    <CardDescription>Send a document and a template id, get JSON back.</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="bg-muted overflow-x-auto rounded-md p-3 text-[12px]">
{`curl -X POST https://api.dvop.io/v1/extract \\
  -H "Authorization: Bearer dx_live_..." \\
  -F "file=@invoice.pdf" \\
  -F "template_id=42"

# Returns 202 with { extractionId, status: "pending" }
# Poll: GET /v1/extractions/:id`}
                    </pre>
                </CardContent>
            </Card>

            {active.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12">
                        <KeyRound className="text-muted-foreground size-10" />
                        <p className="text-muted-foreground text-sm">No active API tokens</p>
                        <Button variant="outline" onClick={() => setCreateOpen(true)} className="gap-2">
                            <Plus className="size-4" />
                            Create your first
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Active tokens</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col divide-y">
                        {active.map((t) => (
                            <TokenRow
                                key={t.id}
                                token={t}
                                onUsage={() => setUsageFor(t)}
                                onRevoke={() => handleRevoke(t)}
                            />
                        ))}
                    </CardContent>
                </Card>
            )}

            {revoked.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-muted-foreground">Revoked</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col divide-y opacity-70">
                        {revoked.map((t) => (
                            <TokenRow key={t.id} token={t} onUsage={() => setUsageFor(t)} />
                        ))}
                    </CardContent>
                </Card>
            )}

            <CreateTokenDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(payload) => {
                    setCreated(payload)
                    setCreateOpen(false)
                    revalidate()
                }}
            />

            <RevealTokenDialog
                token={created}
                onClose={() => setCreated(null)}
            />

            <UsageDialog
                token={usageFor}
                usage={usage}
                loading={usageLoading}
                onClose={() => setUsageFor(null)}
            />
        </div>
    )
}

function TokenRow({
    token,
    onUsage,
    onRevoke
}: {
    token: ApiToken
    onUsage: () => void
    onRevoke?: () => void
}) {
    return (
        <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{token.name}</span>
                    {token.status === 'revoked' && (
                        <Badge variant="destructive">Revoked</Badge>
                    )}
                    {token.status === 'active' && token.expiresAt && token.expiresAt < Date.now() && (
                        <Badge variant="destructive">Expired</Badge>
                    )}
                </div>
                <code className="text-muted-foreground text-xs font-mono">
                    {token.prefix}
                    {'•'.repeat(28)}
                </code>
            </div>
            <div className="text-muted-foreground flex items-center gap-4 text-xs">
                <span title={`${token.callCount} total calls`}>
                    {token.callCount.toLocaleString()} calls
                </span>
                <span>last used {relativeTime(token.lastUsedAt)}</span>
            </div>
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={onUsage} title="View usage">
                    <BarChart2 className="size-4" />
                </Button>
                {onRevoke && (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={onRevoke}
                        title="Revoke token"
                    >
                        <Trash2 className="size-4" />
                    </Button>
                )}
            </div>
        </div>
    )
}

function CreateTokenDialog({
    open,
    onOpenChange,
    onCreated
}: {
    open: boolean
    onOpenChange: (next: boolean) => void
    onCreated: (token: CreatedApiToken) => void
}) {
    const [name, setName] = useState('')
    const [expiresIdx, setExpiresIdx] = useState(0)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) {
            setName('')
            setExpiresIdx(0)
        }
    }, [open])

    const handleCreate = async () => {
        if (!name.trim()) {
            toast.error('Name is required')
            return
        }
        setSaving(true)
        try {
            const days = EXPIRATION_PRESETS[expiresIdx]!.days
            const res = await apiTokensApi.create({
                name: name.trim(),
                expiresInDays: days ?? undefined
            })
            if (res.error) {
                toast.error(res.message)
                return
            }
            onCreated(res.data)
        } catch {
            toast.error('Failed to create token')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New API token</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                    <div className="grid gap-1.5">
                        <Label htmlFor="token-name">Name</Label>
                        <Input
                            id="token-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="E.g. Production server"
                            autoFocus
                        />
                        <p className="text-muted-foreground text-xs">
                            For your own bookkeeping — pick something you'll recognize later.
                        </p>
                    </div>

                    <div className="grid gap-1.5">
                        <Label>Expiration</Label>
                        <div className="flex flex-wrap gap-2">
                            {EXPIRATION_PRESETS.map((preset, i) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => setExpiresIdx(i)}
                                    className={`border-input rounded-md border px-3 py-1.5 text-xs transition-colors ${
                                        i === expiresIdx
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'hover:bg-muted'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={saving}>
                        {saving ? 'Creating…' : 'Create token'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function RevealTokenDialog({
    token,
    onClose
}: {
    token: CreatedApiToken | null
    onClose: () => void
}) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        if (!token) return
        await navigator.clipboard.writeText(token.token)
        setCopied(true)
        toast.success('Token copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Dialog open={!!token} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Token created</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <p className="text-xs">
                            Copy this token now — it will not be shown again. Treat it like a
                            password and store it in a secret manager.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 rounded-md bg-muted p-2">
                        <code className="flex-1 truncate font-mono text-xs">
                            {token?.token ?? ''}
                        </code>
                        <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
                            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                            {copied ? 'Copied' : 'Copy'}
                        </Button>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={onClose}>I've saved it</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function UsageDialog({
    token,
    usage,
    loading,
    onClose
}: {
    token: ApiToken | null
    usage: ApiTokenUsage | null
    loading: boolean
    onClose: () => void
}) {
    const max = useMemo(() => {
        if (!usage) return 0
        return Math.max(...usage.daily.map((d) => d.count), 1)
    }, [usage])

    const totalLast30 = useMemo(() => {
        if (!usage) return 0
        return usage.daily.reduce((sum, d) => sum + d.count, 0)
    }, [usage])

    return (
        <Dialog open={!!token} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>{token?.name ?? 'Token usage'}</DialogTitle>
                </DialogHeader>
                {loading || !usage ? (
                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                        Loading…
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <p className="text-muted-foreground text-xs">Last 30 days</p>
                                <p className="text-2xl font-bold">{totalLast30.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Total calls</p>
                                <p className="text-2xl font-bold">
                                    {usage.token.callCount.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Last used</p>
                                <p className="text-sm font-medium">
                                    {relativeTime(usage.token.lastUsedAt)}
                                </p>
                            </div>
                        </div>

                        <div>
                            <p className="text-muted-foreground mb-2 text-xs">
                                Daily calls (last 30 days)
                            </p>
                            <div className="flex h-32 items-end gap-px rounded-md bg-muted/40 p-2">
                                {usage.daily.map((d) => {
                                    const pct = max > 0 ? (d.count / max) * 100 : 0
                                    return (
                                        <div
                                            key={d.day}
                                            className="group relative flex-1"
                                            title={`${dayLabel(d.day)}: ${d.count} calls`}
                                        >
                                            <div
                                                className="bg-primary/80 hover:bg-primary w-full rounded-sm transition-colors"
                                                style={{ height: `${Math.max(pct, d.count > 0 ? 4 : 0)}%` }}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                                <span>{dayLabel(usage.daily[0]!.day)}</span>
                                <span>{dayLabel(usage.daily[usage.daily.length - 1]!.day)}</span>
                            </div>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
