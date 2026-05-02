import { useNavigation } from 'react-router'
import { useEffect, useRef, useState } from 'react'

export function NavProgress() {
    const navigation = useNavigation()
    const active = navigation.state !== 'idle'

    // Fake-progress: advance to 80% quickly, hold there until done
    const [width, setWidth] = useState(0)
    const [visible, setVisible] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (active) {
            setVisible(true)
            setWidth(0)
            // Jump to 30% immediately, then crawl to 80%
            requestAnimationFrame(() => {
                setWidth(30)
                timerRef.current = setTimeout(() => setWidth(80), 80)
            })
        } else {
            setWidth(100)
            timerRef.current = setTimeout(() => {
                setVisible(false)
                setWidth(0)
            }, 300)
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }, [active])

    if (!visible) return null

    return (
        <div
            className="fixed left-0 top-0 z-[60] h-[2px] bg-primary transition-all duration-300 ease-out"
            style={{ width: `${width}%` }}
        />
    )
}
