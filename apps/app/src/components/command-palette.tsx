import { useState, useEffect, useRef, useCallback } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { useNavigate } from 'react-router'
import { Dialog, DialogContent } from '@repo/ui/components/ui/dialog.tsx'
import {
    LayoutDashboard,
    LayoutTemplate,
    FileText,
    Cpu,
    KeyRound,
    User,
    CreditCard,
    LogOut,
    Search
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@repo/ui/lib/utils'
import { commandPaletteOpenAtom } from '@/stores/command-palette'
import { tokenAtom, userAtom } from '@/stores/auth'
import { authApi } from '@/api-client'
import {
    urlDashboard,
    urlTemplates,
    urlDocuments,
    urlExtractions,
    urlApiTokens,
    urlProfile,
    urlBilling,
    urlLogin
} from '@/urls'

type Command = {
    id: string
    label: string
    icon: LucideIcon
    group: string
    kbd?: string
    onSelect: () => void
}

export function CommandPalette() {
    const [open, setOpen] = useAtom(commandPaletteOpenAtom)
    const navigate = useNavigate()
    const setToken = useSetAtom(tokenAtom)
    const setUser = useSetAtom(userAtom)
    const [query, setQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    const close = useCallback(() => {
        setOpen(false)
        setQuery('')
        setActiveIndex(0)
    }, [setOpen])

    const goTo = useCallback(
        (url: string) => {
            close()
            navigate(url, { viewTransition: true })
        },
        [close, navigate]
    )

    const handleLogout = useCallback(async () => {
        close()
        try {
            await authApi.logout()
        } catch {}
        setToken(null)
        setUser(null)
        navigate(urlLogin(), { viewTransition: true })
    }, [close, navigate, setToken, setUser])

    const commands: Command[] = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Navigate', kbd: 'G D', onSelect: () => goTo(urlDashboard()) },
        { id: 'templates', label: 'Templates', icon: LayoutTemplate, group: 'Navigate', kbd: 'G T', onSelect: () => goTo(urlTemplates()) },
        { id: 'documents', label: 'Documents', icon: FileText, group: 'Navigate', kbd: 'G F', onSelect: () => goTo(urlDocuments()) },
        { id: 'extractions', label: 'Extractions', icon: Cpu, group: 'Navigate', kbd: 'G E', onSelect: () => goTo(urlExtractions()) },
        { id: 'api-tokens', label: 'API tokens', icon: KeyRound, group: 'Navigate', kbd: 'G A', onSelect: () => goTo(urlApiTokens()) },
        { id: 'profile', label: 'Profile', icon: User, group: 'Account', onSelect: () => goTo(urlProfile()) },
        { id: 'billing', label: 'Billing', icon: CreditCard, group: 'Account', onSelect: () => goTo(urlBilling()) },
        { id: 'logout', label: 'Log out', icon: LogOut, group: 'Account', onSelect: handleLogout }
    ]

    const filtered = query.trim()
        ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
        : commands

    const groups = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
        ;(acc[cmd.group] ??= []).push(cmd)
        return acc
    }, {})

    useEffect(() => {
        setActiveIndex(0)
    }, [query])

    useEffect(() => {
        if (open) {
            // Let the dialog finish rendering before focusing
            const id = setTimeout(() => inputRef.current?.focus(), 0)
            return () => clearTimeout(id)
        }
    }, [open])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => Math.max(i - 1, 0))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            filtered[activeIndex]?.onSelect()
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
                showCloseButton={false}
                className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0"
                onKeyDown={handleKeyDown}
            >
                <div className="flex items-center gap-2 border-b px-3">
                    <Search className="size-4 shrink-0 text-muted-foreground" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search or jump to…"
                        className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                </div>

                <div className="max-h-80 overflow-y-auto py-1.5">
                    {filtered.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            No results found.
                        </p>
                    ) : (
                        Object.entries(groups).map(([group, items]) => (
                            <div key={group}>
                                <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                                    {group}
                                </p>
                                {items.map((item) => {
                                    const globalIdx = filtered.indexOf(item)
                                    const isActive = globalIdx === activeIndex
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={cn(
                                                'mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                                                isActive
                                                    ? 'bg-accent text-accent-foreground'
                                                    : 'hover:bg-accent hover:text-accent-foreground'
                                            )}
                                            onMouseEnter={() => setActiveIndex(globalIdx)}
                                            onClick={item.onSelect}
                                        >
                                            <item.icon className="size-4 shrink-0 text-muted-foreground" />
                                            <span className="flex-1 text-left">{item.label}</span>
                                            {item.kbd && (
                                                <span className="flex items-center gap-0.5">
                                                    {item.kbd.split(' ').map((k, i) => (
                                                        <span key={i} className="kbd text-[10px]">
                                                            {k}
                                                        </span>
                                                    ))}
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
