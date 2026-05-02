import { Button } from '@repo/ui/components/ui/button.tsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
    page: number
    pageSize: number
    total: number
    onPage: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
    const totalPages = Math.ceil(total / pageSize)
    if (totalPages <= 1) return null

    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)

    return (
        <div className="flex items-center justify-between border-t pt-3">
            <p className="text-[12px] tabular text-muted-foreground">
                {from}–{to} of {total}
            </p>
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon-sm"
                    className="size-7"
                    disabled={page <= 1}
                    onClick={() => onPage(page - 1)}
                    aria-label="Previous page"
                >
                    <ChevronLeft className="size-3.5" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground tabular">
                    {page} / {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="icon-sm"
                    className="size-7"
                    disabled={page >= totalPages}
                    onClick={() => onPage(page + 1)}
                    aria-label="Next page"
                >
                    <ChevronRight className="size-3.5" />
                </Button>
            </div>
        </div>
    )
}

/** Slice a list for the current page. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
    return items.slice((page - 1) * pageSize, page * pageSize)
}
