import { atomWithStorage } from 'jotai/utils'

// Short-lived bearer token used for every API call.
export const tokenAtom = atomWithStorage<string | null>('token', null, undefined, {
    getOnInit: true
})

// Long-lived refresh token. Currently localStorage; phase 3 migrates it to a
// httpOnly cookie + CSRF token.
export const refreshTokenAtom = atomWithStorage<string | null>('refreshToken', null, undefined, {
    getOnInit: true
})

export const userAtom = atomWithStorage<{
    id: number
    email: string
    name: string
    avatar: string
} | null>('user', null, undefined, { getOnInit: true })
