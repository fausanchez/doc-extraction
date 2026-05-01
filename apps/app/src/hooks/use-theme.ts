import { useAtom } from 'jotai'
import { useEffect } from 'react'
import { themeAtom, type Theme } from '@/stores/theme'

function resolveAndApply(theme: Theme) {
    const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
}

export function useTheme() {
    const [theme, setTheme] = useAtom(themeAtom)

    useEffect(() => {
        resolveAndApply(theme)

        if (theme !== 'system') return

        // Track OS preference changes when in system mode.
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        const handler = () => resolveAndApply('system')
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [theme])

    return { theme, setTheme }
}
