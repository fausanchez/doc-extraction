import { useAtom } from 'jotai'
import { shortcutsModalOpenAtom } from '@/stores/shortcuts-modal'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@repo/ui/components/ui/dialog.tsx'

type ShortcutRow = { keys: string[]; label: string }
type ShortcutGroup = { title: string; rows: ShortcutRow[] }

const GROUPS: ShortcutGroup[] = [
    {
        title: 'Navigation',
        rows: [
            { keys: ['G', 'D'], label: 'Go to Dashboard' },
            { keys: ['G', 'T'], label: 'Go to Templates' },
            { keys: ['G', 'F'], label: 'Go to Documents' },
            { keys: ['G', 'E'], label: 'Go to Extractions' },
            { keys: ['G', 'A'], label: 'Go to API tokens' }
        ]
    },
    {
        title: 'General',
        rows: [
            { keys: ['⌘', 'K'], label: 'Open command palette' },
            { keys: ['?'], label: 'Open this cheatsheet' },
            { keys: ['⌘', ','], label: 'Go to Settings' }
        ]
    }
]

function Keys({ keys }: { keys: string[] }) {
    return (
        <span className="flex items-center gap-0.5">
            {keys.map((k, i) => (
                <span key={i} className="kbd text-[11px]">
                    {k}
                </span>
            ))}
        </span>
    )
}

export function ShortcutsModal() {
    const [open, setOpen] = useAtom(shortcutsModalOpenAtom)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Keyboard shortcuts</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {GROUPS.map((group) => (
                        <div key={group.title}>
                            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                                {group.title}
                            </p>
                            <div className="divide-y divide-border/60 rounded-md border">
                                {group.rows.map((row) => (
                                    <div
                                        key={row.label}
                                        className="flex items-center justify-between px-3 py-2"
                                    >
                                        <span className="text-sm text-foreground/80">
                                            {row.label}
                                        </span>
                                        <Keys keys={row.keys} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}
