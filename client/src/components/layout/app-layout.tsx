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
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-maritime-navy rounded-lg flex items-center justify-center wave-animation shrink-0">
                <span className="text-white text-xs sm:text-sm">⚓</span>
              </div>
              <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">
                <span className="hidden sm:inline">CrewTrack Pro</span>
                <span className="sm:hidden">CrewTrack</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Role Switcher for Demo */}
            <Select value={user.role} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-32 sm:w-48 text-xs sm:text-sm" data-testid="role-selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <span className="hidden sm:inline">Admin (Head Office)</span>
                  <span className="sm:hidden">Admin</span>
                </SelectItem>
                <SelectItem value="office_staff">
                  <span className="hidden sm:inline">Office Staff</span>
                  <span className="sm:hidden">Staff</span>
                </SelectItem>
              </SelectContent>
            </Select>

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

            <div className="flex items-center space-x-2 bg-muted rounded-lg px-2 sm:px-3 py-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-maritime-navy rounded-full flex items-center justify-center shrink-0">
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-white dark:text-white" />
              </div>
              <div className="hidden sm:block min-w-0">
                <p className="text-sm font-medium text-foreground truncate" data-testid="user-name">{user.name}</p>
                <p className="text-xs text-muted-foreground" data-testid="user-role">
                  {user.role === 'admin' ? 'Fleet Administrator' : 'Operations Staff'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Top Navigation */}
      <div className="pt-20">
        <TopNavigation />
      </div>

      {/* Main Content - Full Width */}
      <main className="mt-8 p-3 sm:p-4 lg:p-6 xl:p-8 max-w-full overflow-x-hidden">
        <div className="max-w-full w-full min-w-0 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
