import { urlProfile } from '@/urls'
import { useAtomValue, useSetAtom } from 'jotai'
import { tokenAtom, userAtom } from '@/stores/auth'
import { authApi } from '@/api-client'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card.tsx'
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/ui/avatar.tsx'
import { useNavigate } from 'react-router'
import { urlLogin } from '@/urls'
import { LogOut } from 'lucide-react'

function Profile() {
    const user = useAtomValue(userAtom)
    const setToken = useSetAtom(tokenAtom)
    const setUser = useSetAtom(userAtom)
    const navigate = useNavigate()

    const handleLogout = async () => {
        // Best-effort server-side revocation; ignore network errors so the
        // user can always sign out client-side. The refresh cookie is
        // attached automatically by the browser.
        try {
            await authApi.logout()
        } catch {
            // ignore
        }
        setToken(null)
        setUser(null)
        navigate(urlLogin(), { viewTransition: true })
    }

    return (
        <div className="flex flex-col gap-6 max-w-lg">
            <div>
                <h1 className="text-2xl font-semibold">Profile</h1>
                <p className="text-muted-foreground text-sm">Your account settings</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Personal information</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <Avatar size="lg">
                            <AvatarImage src={user?.avatar} alt={user?.name} />
                            <AvatarFallback>
                                {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-medium">{user?.name ?? '-'}</p>
                            <p className="text-muted-foreground text-sm">{user?.email ?? '-'}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Session</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button variant="destructive" onClick={handleLogout} className="gap-2">
                        <LogOut className="size-4" />
                        Sign out
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

export const route = {
    element: <Profile />,
    path: urlProfile()
}
