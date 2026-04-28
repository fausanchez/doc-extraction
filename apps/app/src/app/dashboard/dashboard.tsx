import { useLoaderData } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card.tsx'
import { Badge } from '@repo/ui/components/ui/badge.tsx'
import { FileText, LayoutTemplate, Cpu, CheckCircle } from 'lucide-react'
import type { route } from './route'

export function Dashboard() {
    const { stats } = useLoaderData<typeof route.loader>()

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Dashboard</h1>
                <p className="text-muted-foreground text-sm">Overview of your activity</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Documents</CardTitle>
                        <FileText className="text-muted-foreground size-4" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.documents}</div>
                        <p className="text-muted-foreground text-xs">files uploaded</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Templates</CardTitle>
                        <LayoutTemplate className="text-muted-foreground size-4" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.templates}</div>
                        <p className="text-muted-foreground text-xs">schemas defined</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Extractions</CardTitle>
                        <Cpu className="text-muted-foreground size-4" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.extractions}</div>
                        <p className="text-muted-foreground text-xs">jobs run</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        <CheckCircle className="text-muted-foreground size-4" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.done}</div>
                        <p className="text-muted-foreground text-xs">successful extractions</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent activity</CardTitle>
                </CardHeader>
                <CardContent>
                    {stats.recentExtractions.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No extractions yet. Upload a document and apply a template to get started.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {stats.recentExtractions.map((ext) => (
                                <div key={ext.id} className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-sm font-medium">Extraction #{ext.id}</span>
                                        <span className="text-muted-foreground text-xs">
                                            Document #{ext.documentId} · Template #{ext.templateId}
                                        </span>
                                    </div>
                                    <Badge
                                        variant={
                                            ext.status === 'done'
                                                ? 'default'
                                                : ext.status === 'error'
                                                  ? 'destructive'
                                                  : 'secondary'
                                        }
                                    >
                                        {ext.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
