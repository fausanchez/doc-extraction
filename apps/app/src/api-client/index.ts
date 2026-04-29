import ky from 'ky'
import { getDefaultStore } from 'jotai'
import { tokenAtom } from '@/stores/auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

const apiClient = ky.create({
    prefixUrl: API_URL,
    hooks: {
        beforeRequest: [
            (request) => {
                const store = getDefaultStore()
                const token = store.get(tokenAtom)
                if (token) {
                    request.headers.set('Authorization', `Bearer ${token}`)
                }
            }
        ]
    }
})

export type ApiResponse<T> = { data: T; error: false } | { data: null; error: true; message: string }

// Auth
export const authApi = {
    google: (code: string) =>
        apiClient.post('auth/google', { json: { code } }).json<ApiResponse<{ token: string; user: { id: number; email: string; name: string; avatar: string } }>>(),
    github: (code: string) =>
        apiClient.post('auth/github', { json: { code } }).json<ApiResponse<{ token: string; user: { id: number; email: string; name: string; avatar: string } }>>(),
    me: () => apiClient.get('auth/me').json<ApiResponse<{ id: number; email: string; name: string; avatar: string; role: string }>>()
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
    get: (id: number | string) => apiClient.get(`templates/${id}`).json<ApiResponse<Template>>(),
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
