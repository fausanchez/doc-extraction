import ky from 'ky'
import { getDefaultStore } from 'jotai'
import { tokenAtom, userAtom } from '@/stores/auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

export type ApiResponse<T> =
    | { data: T; error: false }
    | { data: null; error: true; message: string }

type LoginPayload = {
    accessToken: string
    accessTokenExpiresIn: number
    user: { id: number; email: string; name: string; avatar: string }
}

type RefreshPayload = {
    accessToken: string
    accessTokenExpiresIn: number
}

const store = getDefaultStore()

// Refresh-token rotation must be single-flight: if N requests fire and all
// hit 401 simultaneously, only one /auth/refresh call should run. The shared
// promise lets every concurrent caller await the same rotation.
let pendingRefresh: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
    if (pendingRefresh) return pendingRefresh

    pendingRefresh = (async () => {
        try {
            const res = await ky.post(`${API_URL}/auth/refresh`, {
                // The refresh token lives in an httpOnly cookie — the browser
                // attaches it automatically when `credentials: 'include'`.
                credentials: 'include',
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
    store.set(userAtom, null)
}

// Endpoints that must NOT trigger refresh-and-retry — they themselves are the
// auth surface, and looping would mask the real failure.
const NO_REFRESH_PATHS = ['/auth/refresh', '/auth/google', '/auth/github', '/auth/logout']

const apiClient = ky.create({
    prefixUrl: API_URL,
    retry: { limit: 0 },
    // Always send cookies — needed for the refresh / logout endpoints which
    // rely on the dx_refresh httpOnly cookie. Other endpoints don't read any
    // cookie, so this is a no-op for them.
    credentials: 'include',
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
    refresh: () =>
        apiClient.post('auth/refresh').json<ApiResponse<RefreshPayload>>(),
    logout: () =>
        apiClient
            .post('auth/logout', { throwHttpErrors: false })
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

// Quota-exceeded response from POST /extractions (HTTP 402). Surfaced as a
// plain `error: true` value so callers can branch without a try/catch on the
// HTTP layer.
export type QuotaExceeded = {
    data: null
    error: true
    message: string
    usage: Usage
    product: { slug: string; name: string }
}

export type StartExtractionResponse = ApiResponse<Extraction> | QuotaExceeded

export const extractionsApi = {
    list: () => apiClient.get('extractions').json<ApiResponse<Extraction[]>>(),
    get: (id: number) => apiClient.get(`extractions/${id}`).json<ApiResponse<Extraction>>(),
    start: (documentId: number, templateId: number) =>
        apiClient
            .post('extractions', {
                json: { documentId, templateId },
                // 402 (quota) returns a structured body — let the caller inspect
                // it instead of throwing on a non-2xx.
                throwHttpErrors: false
            })
            .json<StartExtractionResponse>()
}

// Products + Prices (catalogue)
export type Price = {
    id: number
    productId: number
    amount: number
    currency: string
    interval: 'month' | 'year' | 'one_time' | 'free'
    intervalCount: number
    providerPriceId: string
    status: string
    createdAt: number
}

export type Product = {
    id: number
    slug: string
    name: string
    description: string
    monthlyExtractionCredits: number | null
    sortOrder: number
    isDefault: boolean
    status: string
    createdAt: number
    prices: Price[]
}

export const productsApi = {
    list: () => apiClient.get('products').json<ApiResponse<Product[]>>(),
    get: (slug: string) => apiClient.get(`products/${slug}`).json<ApiResponse<Product>>()
}

// Account / usage
export type Usage = {
    creditsUsed: number
    creditsLimit: number | null
    periodStart: string
    periodEnd: string
    percentUsed: number | null
    remaining: number | null
}

export type UsageResponse = {
    product: {
        id: number
        slug: string
        name: string
        description: string
        monthlyExtractionCredits: number | null
    }
    usage: Usage
}

export const meApi = {
    usage: () => apiClient.get('me/usage').json<ApiResponse<UsageResponse>>()
}

// API tokens
export type ApiToken = {
    id: number
    name: string
    prefix: string
    status: 'active' | 'revoked'
    createdAt: number
    expiresAt: number | null
    revokedAt: number | null
    lastUsedAt: number | null
    callCount: number
}

// Response shape for `apiTokensApi.create` — same as ApiToken plus the
// plaintext `token`, which is returned exactly once.
export type CreatedApiToken = ApiToken & { token: string }

export type ApiTokenUsage = {
    token: ApiToken
    daily: { day: number; count: number }[]
}

export const apiTokensApi = {
    list: () => apiClient.get('api-tokens').json<ApiResponse<ApiToken[]>>(),
    create: (data: { name: string; expiresInDays?: number }) =>
        apiClient.post('api-tokens', { json: data }).json<ApiResponse<CreatedApiToken>>(),
    revoke: (id: number) =>
        apiClient.delete(`api-tokens/${id}`).json<ApiResponse<null>>(),
    usage: (id: number) =>
        apiClient.get(`api-tokens/${id}/usage`).json<ApiResponse<ApiTokenUsage>>()
}
