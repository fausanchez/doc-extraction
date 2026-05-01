import { atomWithStorage } from 'jotai/utils'

export type Theme = 'light' | 'dark' | 'system'

export const themeAtom = atomWithStorage<Theme>('dvop-theme', 'system', undefined, {
    getOnInit: true
})
