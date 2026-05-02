import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom, tokenAtom } from '@/stores/auth'
import { useTheme } from '@/hooks/use-theme'
import { shortcutsModalOpenAtom } from '@/stores/shortcuts-modal'
import { authApi } from '@/api-client'
import { useNavigate, Link } from 'react-router'
import { urlLogin, urlProfile, urlBilling } from '@/urls'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Separator } from '@repo/ui/components/ui/separator.tsx'
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/ui/avatar.tsx'
import { Sun, Moon, Monitor, Keyboard, LogOut, ExternalLink, CreditCard, User } from 'lucide-react'
import type { Theme } from '@/stores/theme'
import { cn } from '@repo/ui/lib/utils'

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor }
]

function Section({ title, description, children }: {
    title: string
    description?: string
    children: React.ReactNode
}) {
    return (
        <section className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div>
                <h2 className="text-sm font-semibold">{title}</h2>
                {description && (
                    <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
                )}
            </div>
            <div className="flex flex-col gap-3">{children}</div>
        </section>
    )
}

export function Settings() {
    const user = useAtomValue(userAtom)
    const setToken = useSetAtom(tokenAtom)
    const setUser = useSetAtom(userAtom)
    const navigate = useNavigate()
    const { theme, setTheme } = useTheme()
    const setShortcutsOpen = useSetAtom(shortcutsModalOpenAtom)

    const handleLogout = async () => {
        try { await authApi.logout() } catch {}
        setToken(null)
        setUser(null)
        navigate(urlLogin(), { viewTransition: true })
    }

    return (
        <div className="flex flex-col gap-8 max-w-2xl">
            <header>
                <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Manage your preferences and account.
                </p>
            </header>

            {/* Appearance */}
            <Section title="Appearance" description="Choose how dvop.io looks for you.">
                <div className="grid grid-cols-3 gap-2">
                    {THEMES.map(({ value, label, icon: Icon }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setTheme(value)}
                            className={cn(
                                'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-colors',
                                theme === value
                                    ? 'border-primary bg-primary/5 text-foreground font-medium'
                                    : 'border-border text-muted-foreground hover:border-border/70 hover:text-foreground'
                            )}
                        >
                            <Icon className="size-5" />
                            {label}
                        </button>
                    ))}
                </div>
            </Section>

            <Separator />

            {/* Account */}
            <Section title="Account" description="Your identity on dvop.io.">
                <div className="flex items-center gap-3 rounded-xl border p-4">
                    <Avatar size="md">
                        <AvatarImage src={user?.avatar} alt={user?.name} />
                        <AvatarFallback>{user?.name?.charAt(0).toUpperCase() ?? 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{user?.name ?? '—'}</p>
                        <p className="truncate text-[12px] text-muted-foreground">{user?.email ?? '—'}</p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
                        <Link to={urlProfile()} viewTransition>
                            <User className="size-3.5" />
                            Profile
                        </Link>
                    </Button>
                </div>
                <Button asChild variant="outline" size="sm" className="gap-1.5 self-start">
                    <Link to={urlBilling()} viewTransition>
                        <CreditCard className="size-3.5" />
                        Billing & plan
                        <ExternalLink className="size-3 text-muted-foreground" />
                    </Link>
                </Button>
            </Section>

            <Separator />

            {/* Keyboard shortcuts */}
            <Section title="Keyboard shortcuts" description="Navigate dvop.io without a mouse.">
                <div className="flex items-center justify-between rounded-xl border p-4">
                    <div>
                        <p className="text-sm font-medium">View all shortcuts</p>
                        <p className="text-[12px] text-muted-foreground">
                            Or press <kbd className="kbd">?</kbd> anywhere in the app.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setShortcutsOpen(true)}
                    >
                        <Keyboard className="size-3.5" />
                        Open cheatsheet
                    </Button>
                </div>
            </Section>

            <Separator />

            {/* Danger zone */}
            <Section title="Danger zone" description="Irreversible account actions.">
                <div className="rounded-xl border border-destructive/20 p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium">Sign out</p>
                            <p className="text-[12px] text-muted-foreground">
                                End your current session on this device.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                            onClick={handleLogout}
                        >
                            <LogOut className="size-3.5" />
                            Sign out
                        </Button>
                    </div>
                </div>
            </Section>
        </div>
    )
}
