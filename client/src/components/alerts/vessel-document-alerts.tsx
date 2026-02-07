import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, ExternalLink, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';

interface VesselDocumentAlert {
  document: {
    id: string;
    name: string;
    type: string;
    expiryDate: Date;
  };
  vessel: {
    id: string;
    name: string;
  };
  daysUntilExpiry: number;
  severity: 'critical' | 'warning' | 'info';
}

const severityConfig = {
  critical: {
    color: 'bg-red-50 border-l-red-500',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
    textColor: 'text-red-700',
  },
  warning: {
    color: 'bg-yellow-50 border-l-yellow-500',
    icon: Clock,
    iconColor: 'text-yellow-500',
    textColor: 'text-yellow-700',
  },
  info: {
    color: 'bg-blue-50 border-l-blue-500',
    icon: Clock,
    iconColor: 'text-blue-500',
    textColor: 'text-blue-700',
  },
};

export default function VesselDocumentAlerts() {
  const { data: vesselAlerts = [], isLoading } = useQuery<VesselDocumentAlert[]>({
    queryKey: ['/api/alerts/expiring-vessel-documents'],
    queryFn: async () => {
      const response = await fetch('/api/alerts/expiring-vessel-documents?days=30', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessel document alerts');
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const criticalAlerts = vesselAlerts.filter(alert => alert.severity === 'critical');
  const warningAlerts = vesselAlerts.filter(alert => alert.severity === 'warning');
  const infoAlerts = vesselAlerts.filter(alert => alert.severity === 'info');

  const displayAlerts = [...criticalAlerts, ...warningAlerts, ...infoAlerts].slice(0, 3);

  if (isLoading) {
    return (
      <Card data-testid="vessel-document-alerts-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold maritime-navy">Vessel Documents</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300 animate-spin" />
            <p className="text-sm">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="vessel-document-alerts-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold maritime-navy">Vessel Documents</CardTitle>
          {vesselAlerts.length > 0 && (
            <Badge variant="destructive" data-testid="vessel-alerts-count">
              {vesselAlerts.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {vesselAlerts.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No expiring vessel documents</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayAlerts.map((alert) => {
              const config = severityConfig[alert.severity];
              const Icon = config.icon;
              
              return (
                <Link
                  key={alert.document.id}
                  href={`/fleet-management?highlight=${alert.vessel.id}`}
                  className="block"
                  data-testid={`vessel-alert-link-${alert.document.id}`}
                >
                  <div
                    className={`flex items-center justify-between p-3 border-l-4 rounded-r ${config.color} hover:bg-opacity-80 transition-colors cursor-pointer group`}
                    data-testid={`vessel-alert-${alert.document.id}`}
                    title={`Click to manage ${alert.document.type.toUpperCase()} document for ${alert.vessel.name}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Icon className={`h-4 w-4 ${config.iconColor}`} />
                        <p className={`text-sm font-medium ${config.textColor} group-hover:underline`} data-testid="vessel-alert-document-type">
                          {alert.document.type.toUpperCase()} Document
                        </p>
                        <Badge variant="secondary" className="text-xs px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          Click to manage
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1" data-testid="vessel-alert-info">
                        {alert.vessel.name} - {alert.daysUntilExpiry} days
                      </p>
                    </div>
                    <ExternalLink className={`h-3 w-3 ${config.iconColor} opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0`} />
                  </div>
                </Link>
              );
            })}
            
            <Link href="/fleet-management" className="block">
              <Button 
                className="w-full mt-4 bg-maritime-navy hover:bg-blue-800" 
                size="sm"
                data-testid="view-all-vessel-alerts-button"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Fleet Documents
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}