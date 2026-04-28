import { useSetAtom } from 'jotai'
import { tokenAtom, userAtom } from '@/stores/auth'
import { useNavigate } from 'react-router'
import { urlDashboard } from '@/urls'
import { authApi } from '@/api-client'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { Button } from '@repo/ui/components/ui/button.tsx'

declare const google: {
    accounts: {
        oauth2: {
            initCodeClient: (config: {
                client_id: string
                scope: string
                ux_mode: string
                callback: (response: { code: string }) => void
            }) => { requestCode: () => void }
        }
    }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID ?? ''

const GITHUB_OAUTH_STATE_KEY = 'oauth_state_github'

// Cryptographically-random state value bound to the browser session. GitHub
// returns the same value on callback; mismatch implies a CSRF attempt.
function generateOAuthState(): string {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function Login() {
    const navigate = useNavigate()
    const setToken = useSetAtom(tokenAtom)
    const setUser = useSetAtom(userAtom)
    const [loading, setLoading] = useState<'google' | 'github' | null>(null)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const provider = params.get('provider')
        const returnedState = params.get('state')
        if (code && provider === 'github') {
            const expectedState = sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY)
            sessionStorage.removeItem(GITHUB_OAUTH_STATE_KEY)
            // Strip the OAuth params from the URL so a refresh can't replay them.
            window.history.replaceState({}, '', '/login')
            if (!expectedState || !returnedState || expectedState !== returnedState) {
                toast.error('Invalid sign-in attempt. Please try again.')
                return
            }
            handleGitHubCallback(code)
        }
    }, [])

    const handleGitHubCallback = async (code: string) => {
        setLoading('github')
        try {
            const res = await authApi.github(code)
            if (res.error) {
                toast.error(res.message)
                return
            }
            setToken(res.data.accessToken)
            setUser(res.data.user)
            navigate(urlDashboard(), { viewTransition: true })
        } catch {
            toast.error('Failed to sign in with GitHub')
        } finally {
            setLoading(null)
        }
    }

    const handleGoogle = () => {
        if (!GOOGLE_CLIENT_ID) {
            toast.error('Google Client ID is not configured')
            return
        }
        setLoading('google')
        const client = google.accounts.oauth2.initCodeClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'email profile',
            ux_mode: 'popup',
            callback: async ({ code }) => {
                try {
                    const res = await authApi.google(code)
                    if (res.error) {
                        toast.error(res.message)
                        return
                    }
                    setToken(res.data.accessToken)
                    setUser(res.data.user)
                    navigate(urlDashboard(), { viewTransition: true })
                } catch {
                    toast.error('Failed to sign in with Google')
                } finally {
                    setLoading(null)
                }
            }
        })
        client.requestCode()
    }

    const handleGitHub = () => {
        if (!GITHUB_CLIENT_ID) {
            toast.error('GitHub Client ID is not configured')
            return
        }
        const state = generateOAuthState()
        sessionStorage.setItem(GITHUB_OAUTH_STATE_KEY, state)
        const redirectUri = `${window.location.origin}/login?provider=github`
        const params = new URLSearchParams({
            client_id: GITHUB_CLIENT_ID,
            redirect_uri: redirectUri,
            scope: 'user:email',
            state,
            allow_signup: 'true'
        })
        window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`
    }

    return (
        <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
            <div className="w-full max-w-sm">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-2 text-center">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                            D
                        </div>
                        <h1 className="text-2xl font-semibold">DocExtract</h1>
                        <p className="text-muted-foreground text-sm">
                            Extract structured data from documents using AI
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full gap-3"
                            onClick={handleGoogle}
                            disabled={loading !== null}
                        >
                            {loading === 'google' ? (
                                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                                <svg className="size-4" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            )}
                            Continue with Google
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full gap-3"
                            onClick={handleGitHub}
                            disabled={loading !== null}
                        >
                            {loading === 'github' ? (
                                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                                </svg>
                            )}
                            Continue with GitHub
                        </Button>
                    </div>

                    <p className="text-muted-foreground text-center text-xs">
                        By continuing you agree to our{' '}
                        <a href="#" className="underline underline-offset-4 hover:text-foreground">
                            Terms of Service
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}
