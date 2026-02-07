import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import { DocumentAlert } from '@shared/schema';

interface ExpiryAlertCardProps {
  alerts: DocumentAlert[];
}

const severityConfig = {
  critical: {
    color: 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30',
    dotColor: 'bg-red-500',
    icon: AlertTriangle,
    iconColor: 'text-red-500 dark:text-red-400',
    textColor: 'text-red-700 dark:text-red-400',
  },
  warning: {
    color: 'bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/30',
    dotColor: 'bg-yellow-500',
    icon: Clock,
    iconColor: 'text-yellow-500 dark:text-yellow-400',
    textColor: 'text-yellow-700 dark:text-yellow-400',
  },
  info: {
    color: 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30',
    dotColor: 'bg-blue-500',
    icon: Clock,
    iconColor: 'text-blue-500 dark:text-blue-400',
    textColor: 'text-blue-700 dark:text-blue-400',
  },
};

export default function ExpiryAlertCard({ alerts }: ExpiryAlertCardProps) {
  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
  const warningAlerts = alerts.filter(alert => alert.severity === 'warning');
  const infoAlerts = alerts.filter(alert => alert.severity === 'info');

  const displayAlerts = [...criticalAlerts, ...warningAlerts, ...infoAlerts].slice(0, 3);

  return (
    <Card data-testid="expiry-alerts-card" className="border-slate-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <span>Crew Documents</span>
          </CardTitle>
          {alerts.length > 0 && (
            <Badge variant="destructive" data-testid="alerts-count" className="text-xs font-semibold">
              {alerts.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
              <Clock className="h-7 w-7 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No expiring documents</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">All certificates are valid</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayAlerts.map((alert) => {
              const config = severityConfig[alert.severity];
              const Icon = config.icon;

              return (
                <Link
                  key={alert.document.id}
                  href={`/documents?highlight=${alert.crewMember.id}`}
                  className="block"
                  data-testid={`alert-link-${alert.document.id}`}
                >
                  <div
                    className={`group flex items-start gap-3 p-3 rounded-lg ${config.color} border hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 cursor-pointer`}
                    data-testid={`alert-${alert.document.id}`}
                    title={`Click to renew ${alert.document.type.toUpperCase()} certificate for ${alert.crewMember.firstName} ${alert.crewMember.lastName}`}
                  >
                    <div className={`w-2 h-2 ${config.dotColor} rounded-full mt-2 flex-shrink-0 shadow-sm`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`h-4 w-4 ${config.iconColor} flex-shrink-0`} />
                        <p className={`text-sm font-medium ${config.textColor} truncate group-hover:underline`} data-testid="alert-document-type">
                          {alert.document.type.toUpperCase()} Certificate
                        </p>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed" data-testid="alert-crew-info">
                        {alert.crewMember.firstName} {alert.crewMember.lastName} • {alert.daysUntilExpiry} days remaining
                      </p>
                    </div>
                    <ExternalLink className={`h-3.5 w-3.5 ${config.iconColor} opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-2`} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
