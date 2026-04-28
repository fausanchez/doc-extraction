import { Login } from './login'
import { urlLogin } from '@/urls'

export const route = {
    element: <Login />,
    path: urlLogin()
}
