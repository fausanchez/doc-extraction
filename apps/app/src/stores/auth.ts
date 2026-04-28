import { atomWithStorage } from 'jotai/utils'

// Short-lived bearer token. Lives in localStorage so it survives a page
// refresh; the long-lived refresh credential is now in an httpOnly cookie
// (set by the API on login) so XSS can't exfiltrate it.
export const tokenAtom = atomWithStorage<string | null>('token', null, undefined, {
    getOnInit: true
})

export const userAtom = atomWithStorage<{
    id: number
    email: string
    name: string
    avatar: string
} | null>('user', null, undefined, { getOnInit: true })
