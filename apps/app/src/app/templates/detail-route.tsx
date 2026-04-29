import { redirect, type LoaderFunctionArgs } from 'react-router'
import { TemplateDetail } from './template-detail'
import { documentsApi, extractionsApi, templatesApi } from '@/api-client'
import { urlTemplate, urlTemplates } from '@/urls'

export const route = {
    element: <TemplateDetail />,
    path: urlTemplate(':id'),
    loader: async ({ params }: LoaderFunctionArgs) => {
        const id = params.id
        if (!id) throw redirect(urlTemplates())

        const [tmplRes, docsRes, extsRes] = await Promise.all([
            templatesApi.get(id),
            documentsApi.list(),
            extractionsApi.list()
        ])

        if (tmplRes.error) throw redirect(urlTemplates())

        return {
            template: tmplRes.data,
            documents: docsRes.error ? [] : (docsRes.data ?? []),
            extractions: extsRes.error ? [] : (extsRes.data ?? [])
        }
    },
    handle: {
        breadcrumb: (data: Record<string, unknown>) => {
            const detail = Object.values(data).find(
                (v) => v && typeof v === 'object' && 'template' in v
            ) as { template: { id: number; name: string } } | undefined
            const t = detail?.template
            return [
                { label: 'Templates', to: urlTemplates() },
                ...(t ? [{ label: t.name, to: urlTemplate(t.id) }] : [])
            ]
        }
    }
}
