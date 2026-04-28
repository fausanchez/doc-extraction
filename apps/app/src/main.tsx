import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { routes } from './routes'
import './index.css'

const router = createBrowserRouter(routes)

const root = document.getElementById('root')

createRoot(root!).render(<RouterProvider router={router} />)
