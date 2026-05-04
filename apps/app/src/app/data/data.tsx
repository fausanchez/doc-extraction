import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@repo/ui/components/ui/card.tsx'
import { Button } from '@repo/ui/components/ui/button.tsx'
import { Download, Shield, Clock, Trash2, Loader2 } from 'lucide-react'
import { meApi } from '@/api-client'
import { toast } from 'sonner'

const RETENTION_ITEMS = [
    {
        category: 'Account data',
        fields: 'Email, display name, avatar, OAuth provider ID',
        retention: 'Until account deletion'
    },
    {
        category: 'Documents',
        fields: 'Uploaded files stored in R2 (PDFs, images)',
        retention: 'Until you delete the document or your account'
    },
    {
        category: 'Templates',
        fields: 'JSON schemas you define for extractions',
        retention: 'Until you delete the template or your account'
    },
    {
        category: 'Extractions',
        fields: 'Extracted JSON results and processing metadata',
        retention: 'Until you delete the source document or your account'
    },
    {
        category: 'Session data',
        fields: 'Hashed refresh tokens — plaintext never stored',
        retention: '30 days, or until you log out'
    },
    {
        category: 'API tokens',
        fields: 'Token prefix and SHA-256 hash — plaintext never stored',
        retention: 'Until you revoke the token or delete your account'
    },
    {
        category: 'Usage analytics',
        fields: 'Extraction count per day per API token (aggregated, no content)',
        retention: '90 days rolling'
    }
]

export function Data() {
    const [exporting, setExporting] = useState(false)

    const handleExport = async () => {
        setExporting(true)
        try {
            await meApi.exportData()
            toast.success('Data export downloaded')
        } catch {
            toast.error('Failed to export data')
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Your data</h1>
                <p className="text-muted-foreground text-sm">
                    Understand what we store and exercise your data rights.
                </p>
            </div>

            {/* Export */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Download className="text-primary size-4" />
                        <CardTitle className="text-base">Export your data</CardTitle>
                    </div>
                    <CardDescription>
                        Download a JSON file containing all data we hold about your account —
                        documents, templates, extraction results, API token metadata and usage
                        stats.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleExport} disabled={exporting} className="gap-2">
                        {exporting ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Download className="size-4" />
                        )}
                        {exporting ? 'Preparing export…' : 'Download data export'}
                    </Button>
                </CardContent>
            </Card>

            {/* Retention policy */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Clock className="text-primary size-4" />
                        <CardTitle className="text-base">Data retention</CardTitle>
                    </div>
                    <CardDescription>
                        How long each category of data is kept and when it is removed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="divide-y">
                        {RETENTION_ITEMS.map((item) => (
                            <div key={item.category} className="py-3 first:pt-0 last:pb-0">
                                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-4">
                                    <span className="w-44 shrink-0 text-sm font-medium">
                                        {item.category}
                                    </span>
                                    <span className="text-muted-foreground flex-1 text-sm">
                                        {item.fields}
                                    </span>
                                    <span className="text-muted-foreground text-sm sm:text-right sm:w-52 shrink-0">
                                        {item.retention}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Security */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Shield className="text-primary size-4" />
                        <CardTitle className="text-base">Security & privacy</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
                    <p>
                        Passwords are never stored. Authentication uses OAuth 2.0 (Google /
                        GitHub) — only a hashed provider ID is persisted.
                    </p>
                    <p>
                        Refresh tokens and API token secrets are stored as SHA-256 hashes only.
                        A database breach cannot yield usable credentials.
                    </p>
                    <p>
                        Uploaded files are stored in Cloudflare R2 with private access —
                        no public URLs are issued. Downloads are proxied through the API with
                        per-request ownership checks.
                    </p>
                </CardContent>
            </Card>

            {/* Deletion */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Trash2 className="text-destructive size-4" />
                        <CardTitle className="text-base">Account deletion</CardTitle>
                    </div>
                    <CardDescription>
                        To permanently delete your account and all associated data, contact us
                        at{' '}
                        <a
                            href="mailto:privacy@dvop.io"
                            className="text-primary underline underline-offset-4"
                        >
                            privacy@dvop.io
                        </a>
                        . We will process your request within 30 days in accordance with GDPR
                        Article 17.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    )
}
