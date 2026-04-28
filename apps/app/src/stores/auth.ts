import { atomWithStorage } from 'jotai/utils'

export const tokenAtom = atomWithStorage<string | null>('token', null, undefined, {
    getOnInit: true
})

export const userAtom = atomWithStorage<{
    id: number
    email: string
    name: string
    avatar: string
} | null>('user', null, undefined, { getOnInit: true })
