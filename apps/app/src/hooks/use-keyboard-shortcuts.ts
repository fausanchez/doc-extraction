import { useEffect, useRef } from 'react'
import { useSetAtom } from 'jotai'
import { useNavigate } from 'react-router'
import { commandPaletteOpenAtom } from '@/stores/command-palette'
import { shortcutsModalOpenAtom } from '@/stores/shortcuts-modal'
import {
    urlDashboard,
    urlTemplates,
    urlDocuments,
    urlExtractions,
    urlApiTokens
} from '@/urls'

const GOTO_MAP: Record<string, () => string> = {
    d: urlDashboard,
    t: urlTemplates,
    f: urlDocuments,
    e: urlExtractions,
    a: urlApiTokens
}

function isInputFocused(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement
    return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
    )
}

export function useKeyboardShortcuts() {
    const navigate = useNavigate()
    const setPaletteOpen = useSetAtom(commandPaletteOpenAtom)
    const setShortcutsOpen = useSetAtom(shortcutsModalOpenAtom)
    // Tracks whether the user pressed G and is waiting for the second key
    const pendingG = useRef(false)
    const gTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const clearG = () => {
            pendingG.current = false
            if (gTimeout.current) {
                clearTimeout(gTimeout.current)
                gTimeout.current = null
            }
        }

        const handler = (e: KeyboardEvent) => {
            // ⌘K / Ctrl+K — command palette
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                clearG()
                setPaletteOpen((v) => !v)
                return
            }

            // Skip all other shortcuts when focus is inside a text field
            if (isInputFocused(e)) return
            // Skip when a modifier is held (except Shift for ?)
            if (e.metaKey || e.ctrlKey || e.altKey) return

            if (pendingG.current) {
                const url = GOTO_MAP[e.key.toLowerCase()]
                if (url) {
                    e.preventDefault()
                    clearG()
                    navigate(url(), { viewTransition: true })
                } else {
                    clearG()
                }
                return
            }

            if (e.key === 'g') {
                e.preventDefault()
                pendingG.current = true
                gTimeout.current = setTimeout(clearG, 800)
                return
            }

            if (e.key === '?') {
                e.preventDefault()
                setShortcutsOpen((v) => !v)
            }
        }

        window.addEventListener('keydown', handler)
        return () => {
            window.removeEventListener('keydown', handler)
            clearG()
        }
    }, [navigate, setPaletteOpen, setShortcutsOpen])
}
