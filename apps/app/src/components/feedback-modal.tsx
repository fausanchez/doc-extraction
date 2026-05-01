import { useState } from 'react'
import { useAtom } from 'jotai'
import { atom } from 'jotai'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@repo/ui/components/ui/dialog.tsx'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { feedbackApi } from '@/api-client'

export const feedbackModalOpenAtom = atom(false)

type Category = 'bug' | 'feature' | 'general'

const CATEGORIES: { value: Category; label: string }[] = [
    { value: 'general', label: '💬 General' },
    { value: 'feature', label: '✨ Feature request' },
    { value: 'bug', label: '🐛 Bug report' }
]

export function FeedbackModal() {
    const [open, setOpen] = useAtom(feedbackModalOpenAtom)
    const [category, setCategory] = useState<Category>('general')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const handleClose = () => {
        setOpen(false)
        setMessage('')
        setCategory('general')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!message.trim()) return
        setLoading(true)
        try {
            await feedbackApi.send({ message: message.trim(), category })
            handleClose()
            toast.success('Thanks for your feedback!')
        } catch {
            toast.error('Could not send feedback. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Send feedback</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-2">
                        {CATEGORIES.map((c) => (
                            <button
                                key={c.value}
                                type="button"
                                onClick={() => setCategory(c.value)}
                                className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                                    category === c.value
                                        ? 'border-primary bg-primary/5 text-foreground font-medium'
                                        : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>

                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="What's on your mind?"
                        rows={5}
                        maxLength={2000}
                        className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                        autoFocus
                    />

                    <DialogFooter>
                        <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={!message.trim() || loading}>
                            {loading ? 'Sending…' : 'Send feedback'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
