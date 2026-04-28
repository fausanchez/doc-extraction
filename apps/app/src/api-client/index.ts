import ky from 'ky'
import { getDefaultStore } from 'jotai'
import { refreshTokenAtom, tokenAtom, userAtom } from '@/stores/auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

export type ApiResponse<T> =
    | { data: T; error: false }
    | { data: null; error: true; message: string }

type LoginPayload = {
    accessToken: string
    accessTokenExpiresIn: number
    refreshToken: string
    refreshTokenExpiresIn: number
    user: { id: number; email: string; name: string; avatar: string }
}

type RefreshPayload = {
    accessToken: string
    accessTokenExpiresIn: number
    refreshToken: string
    refreshTokenExpiresIn: number
}

const store = getDefaultStore()

// Refresh-token rotation must be single-flight: if multiple requests fire and
// hit 401 simultaneously, only one /auth/refresh call should run.
let pendingRefresh: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
    if (pendingRefresh) return pendingRefresh

    const refreshToken = store.get(refreshTokenAtom)
    if (!refreshToken) return null

    pendingRefresh = (async () => {
        try {
            const res = await ky.post(`${API_URL}/auth/refresh`, {
                json: { refreshToken },
                throwHttpErrors: false
            })
            if (!res.ok) {
                clearAuth()
                return null
            }
            const body = (await res.json()) as ApiResponse<RefreshPayload>
            if (body.error) {
                clearAuth()
                return null
            }
            store.set(tokenAtom, body.data.accessToken)
            store.set(refreshTokenAtom, body.data.refreshToken)
            return body.data.accessToken
        } catch {
            clearAuth()
            return null
        } finally {
            pendingRefresh = null
        }
    })()

    return pendingRefresh
}

function clearAuth(): void {
    store.set(tokenAtom, null)
    store.set(refreshTokenAtom, null)
    store.set(userAtom, null)
}

// Endpoints that must NOT trigger a refresh-and-retry — they themselves are
// the auth surface.
const NO_REFRESH_PATHS = ['/auth/refresh', '/auth/google', '/auth/github', '/auth/logout']

const apiClient = ky.create({
    prefixUrl: API_URL,
    retry: { limit: 0 },
    hooks: {
        beforeRequest: [
            (request) => {
                const token = store.get(tokenAtom)
                if (token) {
                    request.headers.set('Authorization', `Bearer ${token}`)
                }
            }
        ],
        afterResponse: [
            async (request, _options, response) => {
                if (response.status !== 401) return response
                if (NO_REFRESH_PATHS.some((p) => request.url.endsWith(p))) return response
                if (request.headers.get('x-retry-after-refresh') === '1') return response

                const newToken = await refreshAccessToken()
                if (!newToken) return response

                const retried = request.clone()
                retried.headers.set('Authorization', `Bearer ${newToken}`)
                retried.headers.set('x-retry-after-refresh', '1')
                return fetch(retried)
            }
        ]
    }
})

// Auth
export const authApi = {
    google: (code: string) =>
        apiClient
            .post('auth/google', { json: { code } })
            .json<ApiResponse<LoginPayload>>(),
    github: (code: string) =>
        apiClient
            .post('auth/github', { json: { code } })
            .json<ApiResponse<LoginPayload>>(),
    refresh: (refreshToken: string) =>
        apiClient
            .post('auth/refresh', { json: { refreshToken } })
            .json<ApiResponse<RefreshPayload>>(),
    logout: (refreshToken: string | null) =>
        apiClient
            .post('auth/logout', {
                json: refreshToken ? { refreshToken } : {},
                throwHttpErrors: false
            })
            .json<ApiResponse<null>>(),
    me: () =>
        apiClient.get('auth/me').json<
            ApiResponse<{
                id: number
                email: string
                name: string
                avatar: string
                role: string
            }>
        >()
}

// Documents
export type Document = {
    id: number
    userId: number
    name: string
    filePath: string
    mimeType: string
    size: number
    status: string
    createdAt: number
}

export const documentsApi = {
    list: () => apiClient.get('documents').json<ApiResponse<Document[]>>(),
    get: (id: number) => apiClient.get(`documents/${id}`).json<ApiResponse<Document>>(),
    upload: (file: File) => {
        const formData = new FormData()
        formData.append('file', file)
        return apiClient.post('documents/upload', { body: formData }).json<ApiResponse<Document>>()
    },
    delete: (id: number) => apiClient.delete(`documents/${id}`).json<ApiResponse<null>>()
}

// Templates
export type TemplateField = {
    key: string
    label: string
    type: 'string' | 'number' | 'date' | 'boolean' | 'array'
    required: boolean
    description: string
}

export type Template = {
    id: number
    userId: number
    name: string
    description: string
    schema: string
    status: string
    createdAt: number
}

export const templatesApi = {
    list: () => apiClient.get('templates').json<ApiResponse<Template[]>>(),
    get: (id: number) => apiClient.get(`templates/${id}`).json<ApiResponse<Template>>(),
    create: (data: { name: string; description: string; schema: TemplateField[] }) =>
        apiClient.post('templates', { json: data }).json<ApiResponse<Template>>(),
    update: (id: number, data: { name: string; description: string; schema: TemplateField[] }) =>
        apiClient.put(`templates/${id}`, { json: data }).json<ApiResponse<Template>>(),
    delete: (id: number) => apiClient.delete(`templates/${id}`).json<ApiResponse<null>>()
}

// Extractions
export type Extraction = {
    id: number
    documentId: number
    templateId: number
    userId: number
    result: string
    status: string
    errorMessage: string
    createdAt: number
}

export const extractionsApi = {
    list: () => apiClient.get('extractions').json<ApiResponse<Extraction[]>>(),
    get: (id: number) => apiClient.get(`extractions/${id}`).json<ApiResponse<Extraction>>(),
    start: (documentId: number, templateId: number) =>
        apiClient.post('extractions', { json: { documentId, templateId } }).json<ApiResponse<Extraction>>()
}
