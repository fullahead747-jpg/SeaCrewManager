import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    AlertTriangle,
    Clock,
    ShieldAlert,
    Info,
    ChevronRight,
    Calendar,
    ArrowRight,
    Search,
    RefreshCw,
    User
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { getAuthHeaders } from '@/lib/auth';
import { DocumentAlert } from '@shared/schema';
import { Link } from 'wouter';
import { DocumentActionWorkflows } from '@/components/workflows/document-action-workflows';
import { useState } from 'react';

export default function ExpiringDocumentsWidget() {
    const { data: alerts, isLoading } = useQuery<DocumentAlert[]>({
        queryKey: ['/api/alerts/expiring-documents', { days: 90 }],
        queryFn: async () => {
            const response = await fetch('/api/alerts/expiring-documents?days=90', {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch alerts');
            return response.json();
        },
        refetchInterval: 60000,
    });

    if (isLoading) {
        return (
            <Card className="animate-pulse">
                <CardHeader className="h-14 bg-muted/50" />
                <CardContent className="h-48" />
            </Card>
        );
    }

    const categorizedAlerts = {
        critical: (alerts || []).filter(a => a.daysUntilExpiry <= 15),
        urgent: (alerts || []).filter(a => a.daysUntilExpiry > 15 && a.daysUntilExpiry <= 30),
        planning: (alerts || []).filter(a => a.daysUntilExpiry > 30 && a.daysUntilExpiry <= 60),
        early: (alerts || []).filter(a => a.daysUntilExpiry > 60 && a.daysUntilExpiry <= 90),
    };

    const hasAlerts = (alerts?.length || 0) > 0;

    return (
        <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-secondary/10 border-b border-border">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-primary" />
                        Compliance Monitoring
                    </CardTitle>
                    {hasAlerts && (
                        <Badge variant="outline" className="bg-background">
                            {alerts?.length} Total
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {!hasAlerts ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <div className="w-12 h-12 rounded-full bg-compliance-green/10 flex items-center justify-center mb-3">
                            <Clock className="h-6 w-6 text-compliance-green" />
                        </div>
                        <p className="text-sm font-medium">All crew documents are compliant</p>
                        <p className="text-xs">No expiries within the next 90 days</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {/* Critical Section */}
                        {categorizedAlerts.critical.length > 0 && (
                            <AlertSection
                                title="Critical"
                                alerts={categorizedAlerts.critical}
                                type="critical"
                            />
                        )}
                        {/* Urgent Section */}
                        {categorizedAlerts.urgent.length > 0 && (
                            <AlertSection
                                title="Urgent Action"
                                alerts={categorizedAlerts.urgent}
                                type="urgent"
                            />
                        )}
                        {/* Planning Section */}
                        {categorizedAlerts.planning.length > 0 && (
                            <AlertSection
                                title="Planning Required"
                                alerts={categorizedAlerts.planning}
                                type="planning"
                            />
                        )}
                        {/* Early Warning Section */}
                        {categorizedAlerts.early.length > 0 && (
                            <AlertSection
                                title="Early Warning"
                                alerts={categorizedAlerts.early}
                                type="early"
                            />
                        )}
                    </div>
                )}

                <WorkflowHandler alerts={alerts || []} />

                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-border">
                    <Button variant="ghost" size="sm" className="w-full justify-between group" asChild>
                        <Link href="/documents">
                            <span>View All Documents</span>
                            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function AlertSection({ title, alerts, type }: { title: string, alerts: DocumentAlert[], type: 'critical' | 'urgent' | 'planning' | 'early' }) {
    const config = {
        critical: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20', badge: 'destructive' },
        urgent: { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/20', badge: 'warning' },
        planning: { icon: Info, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20', badge: 'secondary' },
        early: { icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20', badge: 'outline' },
    }[type];

    const Icon = config.icon;

    return (
        <div className="px-4 py-3">
            <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${config.color}`}>
                <Icon className="h-3 w-3" />
                {title} ({alerts.length})
            </h4>
            <div className="space-y-1.5">
                {alerts.slice(0, 3).map((alert) => (
                    <div key={alert.document.id} className={`p-2 rounded-lg ${config.bg} border border-transparent hover:border-border transition-all cursor-pointer group`}>
                        <div className="flex items-start justify-between">
                            <div className="min-w-0 pr-2">
                                <Link href={`/documents?crew=${alert.crewMember.id}`}>
                                    <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors">
                                        {alert.crewMember.firstName} {alert.crewMember.lastName}
                                    </p>
                                </Link>
                                <p className="text-[10px] text-muted-foreground truncate italic">
                                    {alert.document.type.toUpperCase()} • {alert.daysUntilExpiry} days remaining
                                </p>
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground whitespace-nowrap bg-background/50 px-1.5 py-0.5 rounded border border-border">
                                {format(new Date(alert.document.expiryDate), 'MMM d')}
                            </div>
                        </div>

                        <div className="mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[9px] px-2 bg-background"
                                onClick={() => {
                                    const event = new CustomEvent('open-compliance-workflow', {
                                        detail: { alert, tab: 'renewal' }
                                    });
                                    window.dispatchEvent(event);
                                }}
                            >
                                <RefreshCw className="h-2.5 w-2.5 mr-1" />
                                Plan Renewal
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[9px] px-2 bg-background"
                                onClick={() => {
                                    const event = new CustomEvent('open-compliance-workflow', {
                                        detail: { alert, tab: 'replacement' }
                                    });
                                    window.dispatchEvent(event);
                                }}
                            >
                                <User className="h-2.5 w-2.5 mr-1" />
                                Schedule Change
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Internal helper component to handle the dialog state without re-rendering the whole widget unnecessarily
import { useEffect } from 'react';
import { User as UserIcon } from 'lucide-react';

function WorkflowHandler({ alerts }: { alerts: DocumentAlert[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<DocumentAlert | null>(null);
    const [activeTab, setActiveTab] = useState<'renewal' | 'replacement' | 'extension'>('renewal');

    useEffect(() => {
        const handleOpen = (e: any) => {
            setSelectedAlert(e.detail.alert);
            setActiveTab(e.detail.tab);
            setIsOpen(true);
        };

        window.addEventListener('open-compliance-workflow', handleOpen);
        return () => window.removeEventListener('open-compliance-workflow', handleOpen);
    }, []);

    if (!selectedAlert) return null;

    return (
        <DocumentActionWorkflows
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            crewMember={selectedAlert.crewMember as any}
            document={selectedAlert.document as any}
            initialTab={activeTab}
        />
    );
}
