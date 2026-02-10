import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import TopNavigation from './top-navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Bell, User, Ship } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { getAuthHeaders } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { motion } from 'framer-motion';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, switchRole } = useAuth();
  const [notificationPopoverOpen, setNotificationPopoverOpen] = useState(false);
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();

  // Get notification count from expiring documents
  const { data: expiringDocuments } = useQuery({
    queryKey: ['/api/alerts/expiring-documents'],
    queryFn: async () => {
      const response = await fetch('/api/alerts/expiring-documents', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const notificationCount = expiringDocuments?.length || 0;

  const handleRoleChange = (newRole: string) => {
    switchRole(newRole);
  };

  const handleNotificationsClick = () => {
    if (notificationCount > 0) {
      // If there are notifications, show popover first
      setNotificationPopoverOpen(!notificationPopoverOpen);
    } else {
      // If no notifications, go directly to notifications page
      setLocation('/notifications');
    }
  };

  const handleViewAllNotifications = () => {
    setNotificationPopoverOpen(false);
    setLocation('/documents');
  };

  const handleDocumentClick = (crewMemberId: string, documentType: string) => {
    setNotificationPopoverOpen(false);
    setLocation(`/documents?crew=${crewMemberId}&type=${documentType}`);
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-card border-b border-border shadow-sm fixed w-full top-0 z-50"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-2">
          <div className="flex-1">
            <TopNavigation />
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">

            <Popover open={notificationPopoverOpen} onOpenChange={setNotificationPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative"
                  data-testid="notifications-button"
                  onClick={handleNotificationsClick}
                >
                  <Bell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs">
                      {notificationCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-80">
                <div className="space-y-3">
                  {notificationCount > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">Documents Expiring Soon</h4>
                        <Badge variant="secondary" className="text-xs">{notificationCount}</Badge>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {expiringDocuments?.slice(0, 8).map((alert: any, index: number) => (
                          <div
                            key={index}
                            className="p-2 rounded border bg-card hover:bg-accent cursor-pointer transition-colors"
                            onClick={() => handleDocumentClick(alert.crewMember?.id, alert.document.documentType)}
                            data-testid={`notification-item-${index}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{alert.crewMember?.firstName} {alert.crewMember?.lastName}</p>
                                <p className="text-xs text-muted-foreground">{alert.document.documentType}</p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Click to manage →</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-medium text-destructive">
                                  Expires {formatDate(alert.document.expiryDate)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {notificationCount > 8 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            ...and {notificationCount - 8} more documents
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setNotificationPopoverOpen(false)}
                        >
                          Close
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={handleViewAllNotifications}
                          data-testid="view-all-notifications"
                        >
                          View Documents
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">No notifications</p>
                      <p className="text-xs text-muted-foreground">All documents are up to date</p>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

          </div>
        </div>
      </motion.header>

      {/* Main Content - Full Width */}
      <main className="mt-16 p-3 sm:p-4 lg:p-6 xl:p-8 max-w-full overflow-x-hidden">
        <div className="max-w-full w-full min-w-0 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
