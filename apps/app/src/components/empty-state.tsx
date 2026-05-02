import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description: string
    action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="dropzone flex flex-col items-center justify-center gap-3 rounded-xl py-16">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-[13px] text-muted-foreground">{description}</p>
            </div>
            {action}
        </div>
    )
}
