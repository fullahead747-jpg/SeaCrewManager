import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, Ship, GraduationCap, FileText, Wrench, UserPlus, UserMinus, AlertTriangle, ExternalLink, Mail } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

interface UpcomingEvent {
  id: string;
  type: 'contract_expiry' | 'document_expiry' | 'crew_join' | 'crew_leave' | 'maintenance_completion';
  title: string;
  description: string;
  date: string;
  severity: 'success' | 'info' | 'warning' | 'high';
  crewMemberId?: string;
  vesselId?: string;
  contractId?: string;
  documentId?: string;
  documentType?: string;
  rotationId?: string;
}

const severityColors = {
  success: 'bg-compliance-green',
  info: 'bg-ocean-blue',
  warning: 'bg-warning-amber',
  high: 'bg-alert-red',
};

const eventIcons = {
  contract_expiry: User,
  document_expiry: FileText,
  crew_join: UserPlus,
  crew_leave: UserMinus,
  maintenance_completion: Wrench,
};

export default function UpcomingEvents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sendingEmail, setSendingEmail] = useState(false);

  const { data: events = [], isLoading } = useQuery<UpcomingEvent[]>({
    queryKey: ['/api/upcoming-events'],
    queryFn: async () => {
      const response = await fetch('/api/upcoming-events?days=30&limit=8', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch upcoming events');
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const response = await fetch('/api/email/send-upcoming-events', {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Failed to send email');

      const result = await response.json();
      toast({
        title: "Email Sent Successfully",
        description: result.message,
      });
    } catch (error) {
      let errorMessage = "An error occurred";

      // Try to parse server response for better error messages
      if (error instanceof Response) {
        try {
          const errorData = await error.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = error.statusText || errorMessage;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: "Failed to Send Email",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const getEventLink = (event: UpcomingEvent): string => {
    switch (event.type) {
      case 'contract_expiry':
        // Navigate to crew management with specific crew member highlighted
        return event.crewMemberId ? `/crew?highlight=${event.crewMemberId}` : '/crew';
      case 'document_expiry':
        // Navigate to dashboard crew overview with specific crew member highlighted
        return event.crewMemberId ? `/dashboard?highlight=${event.crewMemberId}` : '/dashboard';
      case 'crew_join':
      case 'crew_leave':
        // Navigate to scheduling page with specific rotation highlighted
        return event.rotationId ? `/scheduling?highlight=${event.rotationId}` : '/scheduling';
      case 'maintenance_completion':
        // Navigate to vessels page with specific vessel highlighted  
        return event.vesselId ? `/dashboard?vessel=${event.vesselId}` : '/dashboard';
      default:
        return '/dashboard';
    }
  };

  return (
    <Card data-testid="upcoming-events-card" className="border-slate-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
        <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span>Upcoming Events</span>
          </div>
          {!isLoading && events.length > 0 && (
            <Badge variant="outline" className="text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
              {events.length} {events.length === 1 ? 'event' : 'events'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 animate-pulse">
                <div className="w-2 h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-2" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
              <Calendar className="h-7 w-7 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No upcoming events</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">in the next 30 days</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => {
              const Icon = eventIcons[event.type] || AlertTriangle;
              const linkTo = getEventLink(event);
              return (
                <Link
                  key={event.id}
                  href={linkTo}
                  className="block"
                  data-testid={`event-link-${event.id}`}
                >
                  <div
                    className="group flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 cursor-pointer"
                    data-testid={`event-${event.id}`}
                    title={`Click to ${event.type === 'contract_expiry' ? 'renew contract' : event.type === 'document_expiry' ? 'renew document' : event.type.includes('crew') ? 'manage rotation' : 'manage'}: ${event.description}`}
                  >
                    <div className={`w-2 h-2 ${severityColors[event.severity]} rounded-full mt-2 flex-shrink-0 shadow-sm`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" data-testid="event-title">
                          {event.title}
                        </p>
                        {event.severity === 'high' && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-semibold">
                            Urgent
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed" data-testid="event-description">
                        {event.description}
                      </p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity mt-2 flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {events.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-500 dark:text-slate-500 font-medium">
                Auto-refreshes every 5 min • Next 30 days
              </p>
              {user?.role === 'admin' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  data-testid="send-events-email-btn"
                  className="h-7 px-3 text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                >
                  <Mail className="h-3 w-3 mr-1.5" />
                  {sendingEmail ? 'Sending...' : 'Send Email'}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
