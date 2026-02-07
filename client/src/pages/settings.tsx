import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Settings as SettingsIcon,
  Mail,
  Bell,
  Users,
  Shield,
  Database,
  Moon,
  Sun,
  Monitor,
  Save,
  TestTube,
  FileText,
  Download,
  Activity,
  Clock,
  User,
  MessageCircle,
  Trash2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTheme } from '@/contexts/theme-context';
import { queryClient, apiRequest } from '@/lib/queryClient';
import WhatsAppSettingsModal from '@/components/modals/whatsapp-settings-modal';

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState('general');
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [showClearCrewDialog, setShowClearCrewDialog] = useState(false);
  const [localRecipientEmail, setLocalRecipientEmail] = useState('');
  const [localEmailTemplate, setLocalEmailTemplate] = useState('');
  const [emailFieldsInitialized, setEmailFieldsInitialized] = useState(false);

  // Clear Crew Data Mutation
  const clearCrewDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/admin/clear-crew-data');
      return response.json();
    },
    onSuccess: (data) => {
      setShowClearCrewDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/crew-members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status-change-history'] });
      toast({
        title: 'Success',
        description: data.message || 'All crew data has been cleared successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to clear crew data',
        variant: 'destructive',
      });
    },
  });

  // Email Settings Query
  const { data: emailSettings, isLoading: emailLoading } = useQuery({
    queryKey: ['/api/email-settings'],
    queryFn: async () => {
      const response = await fetch('/api/email-settings', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch email settings');
      return response.json();
    },
  });

  // Initialize local email fields when settings load
  useEffect(() => {
    if (emailSettings && !emailFieldsInitialized) {
      setLocalRecipientEmail(emailSettings.recipientEmail || '');
      setLocalEmailTemplate(emailSettings.emailTemplate || '');
      setEmailFieldsInitialized(true);
    }
  }, [emailSettings, emailFieldsInitialized]);

  // System Stats Query
  const { data: systemStats } = useQuery({
    queryKey: ['/api/system/stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch system stats');
      return response.json();
    },
  });

  // Activity Report Query
  const { data: activityData, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['/api/system/activity-report'],
    queryFn: async () => {
      const response = await fetch('/api/system/activity-report', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch activity report');
      return response.json();
    },
    enabled: true, // Available for both admin and office staff
    staleTime: 0, // Always refetch for real-time data
    gcTime: 0, // Don't cache activity data
  });

  // Email Settings Mutation
  const updateEmailSettings = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest('PUT', '/api/email-settings', settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-settings'] });
      toast({
        title: 'Success',
        description: 'Email settings updated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update email settings',
        variant: 'destructive',
      });
    },
  });

  // Test Email Mutation
  const sendTestEmail = useMutation({
    mutationFn: async ({ recipientEmail }: { recipientEmail: string }) => {
      return apiRequest('POST', '/api/email/send-test', { recipientEmail });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Test email sent successfully! Check your inbox.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to send test email',
        variant: 'destructive',
      });
    },
  });

  // Export Activity Report
  const exportActivityReport = () => {
    try {
      if (!activityData || activityData.length === 0) {
        toast({
          title: 'No Data',
          description: 'No activity data found to export',
          variant: 'destructive',
        });
        return;
      }

      const headers = [
        'Timestamp',
        'User Name',
        'User Role',
        'Action Type',
        'Description',
        'Affected Resource',
        'IP Address',
        'Status'
      ];

      const rows = activityData.map((activity: any) => [
        format(new Date(activity.createdAt), 'yyyy-MM-dd HH:mm:ss'),
        activity.username,
        activity.userRole,
        activity.type,
        activity.description,
        activity.entityType || '---',
        '---', // IP address not tracked
        activity.severity
      ]);

      // Create CSV with proper formatting
      const csvRows = [];

      // Add title and metadata
      csvRows.push('"CREWTRACK PRO - SYSTEM ACTIVITY REPORT"');
      csvRows.push(`"Generated on: ${format(new Date(), 'MMMM dd, yyyy at HH:mm')}"`);
      csvRows.push(`"Total Activities: ${activityData.length}"`);
      csvRows.push(`"Report Period: ${format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'MMM dd')} - ${format(new Date(), 'MMM dd, yyyy')}"`);
      csvRows.push(''); // Empty row for spacing

      // Add headers
      csvRows.push(headers.map(header => `"${header}"`).join(','));

      // Add data rows
      rows.forEach((row: any[]) => {
        const formattedRow = row.map((cell: any) => {
          const cellValue = String(cell || '---');
          return `"${cellValue}"`;
        });
        csvRows.push(formattedRow.join(','));
      });

      // Add summary
      csvRows.push(''); // Empty row
      csvRows.push('"ACTIVITY SUMMARY"');
      csvRows.push(`"Admin Actions: ${rows.filter((row: any[]) => row[2] === 'admin').length}"`);
      csvRows.push(`"Office Staff Actions: ${rows.filter((row: any[]) => row[2] === 'office_staff').length}"`);
      csvRows.push(`"Total Users: ${new Set(rows.map((row: any[]) => row[1])).size}"`);

      const csvContent = csvRows.join('\n');
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `System-Activity-Report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: 'Export Successful',
        description: `Activity report exported with ${activityData.length} records`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Unable to export activity report. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEmailSettingsUpdate = (field: string, value: any) => {
    const updatedSettings = {
      ...emailSettings,
      [field]: value,
    };
    updateEmailSettings.mutate(updatedSettings);
  };

  const sections = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'email', label: 'Email Settings', icon: Mail },
    { id: 'whatsapp', label: 'WhatsApp Settings', icon: MessageCircle, adminOnly: true },
    { id: 'activity', label: 'Activity Report', icon: Activity },
    { id: 'users', label: 'User Management', icon: Users, adminOnly: true },
    { id: 'security', label: 'Security', icon: Shield, adminOnly: true },
    { id: 'system', label: 'System', icon: Database, adminOnly: true },
  ];

  const availableSections = sections.filter(section =>
    !section.adminOnly || user?.role === 'admin'
  );

  if (user?.role === 'crew') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <SettingsIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-6">
            Settings are only accessible to admin and office staff members.
          </p>
          <Button
            onClick={() => window.location.href = '/dashboard'}
            className="bg-maritime-navy hover:bg-blue-800"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2" data-testid="settings-title">
            System Settings
          </h2>
          <p className="text-muted-foreground">
            Manage application settings and configurations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Settings Categories</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <nav className="space-y-1">
              {availableSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center px-4 py-3 text-left text-sm font-medium rounded-none border-r-2 transition-colors ${activeSection === section.id
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'hover:bg-muted border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    data-testid={`settings-${section.id}-tab`}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {section.label}
                    {section.adminOnly && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Admin
                      </Badge>
                    )}
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {activeSection === 'general' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <SettingsIcon className="h-5 w-5 mr-2" />
                  General Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Theme Settings */}
                <div>
                  <Label className="text-base font-medium">Theme Preference</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Choose your preferred theme for the application
                  </p>
                  <div className="flex space-x-3">
                    <Button
                      variant={theme === 'light' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme('light')}
                      className="flex items-center"
                    >
                      <Sun className="h-4 w-4 mr-2" />
                      Light
                    </Button>
                    <Button
                      variant={theme === 'dark' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme('dark')}
                      className="flex items-center"
                    >
                      <Moon className="h-4 w-4 mr-2" />
                      Dark
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="flex items-center opacity-50"
                    >
                      <Monitor className="h-4 w-4 mr-2" />
                      System (Coming Soon)
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Application Info */}
                <div>
                  <Label className="text-base font-medium">Application Information</Label>
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Version</Label>
                      <p className="text-sm font-medium">CrewTrack Pro v2.1.0</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Build</Label>
                      <p className="text-sm font-medium">2025.08.14</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Environment</Label>
                      <Badge variant="secondary">Development</Badge>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Database</Label>
                      <Badge variant="outline" className="text-green-600">Connected</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="h-5 w-5 mr-2" />
                  Notification Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Browser Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Show desktop notifications for alerts
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Document Expiry Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Alert when documents are expiring
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Contract Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify about contract renewals
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'email' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2" />
                  Email Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {emailLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable email notifications for alerts
                        </p>
                      </div>
                      <Switch
                        checked={emailSettings?.enabled ?? true}
                        onCheckedChange={(checked) => handleEmailSettingsUpdate('enabled', checked)}
                      />
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-base font-medium mb-3 block">Reminder Settings</Label>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">30 days before expiry</Label>
                          <Switch
                            checked={emailSettings?.reminderDays?.includes(30) ?? true}
                            onCheckedChange={(checked) => {
                              const days = emailSettings?.reminderDays || [];
                              const newDays = checked
                                ? [...days.filter((d: number) => d !== 30), 30]
                                : days.filter((d: number) => d !== 30);
                              handleEmailSettingsUpdate('reminderDays', newDays);
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">15 days before expiry</Label>
                          <Switch
                            checked={emailSettings?.reminderDays?.includes(15) ?? true}
                            onCheckedChange={(checked) => {
                              const days = emailSettings?.reminderDays || [];
                              const newDays = checked
                                ? [...days.filter((d: number) => d !== 15), 15]
                                : days.filter((d: number) => d !== 15);
                              handleEmailSettingsUpdate('reminderDays', newDays);
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">7 days before expiry</Label>
                          <Switch
                            checked={emailSettings?.reminderDays?.includes(7) ?? true}
                            onCheckedChange={(checked) => {
                              const days = emailSettings?.reminderDays || [];
                              const newDays = checked
                                ? [...days.filter((d: number) => d !== 7), 7]
                                : days.filter((d: number) => d !== 7);
                              handleEmailSettingsUpdate('reminderDays', newDays);
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label htmlFor="recipient-email" className="text-base font-medium">
                        Recipient Email Address
                      </Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Email address to receive all notifications and alerts
                      </p>
                      <Input
                        id="recipient-email"
                        type="email"
                        placeholder="admin@company.com"
                        value={localRecipientEmail}
                        onChange={(e) => setLocalRecipientEmail(e.target.value)}
                        data-testid="input-recipient-email"
                      />
                    </div>

                    <Separator />

                    <div>
                      <Label htmlFor="email-template" className="text-base font-medium">
                        Email Template
                      </Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Customize the email notification template
                      </p>
                      <Textarea
                        id="email-template"
                        rows={6}
                        placeholder="Enter your email template here..."
                        value={localEmailTemplate}
                        onChange={(e) => setLocalEmailTemplate(e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="flex space-x-3">
                      <Button
                        onClick={() => {
                          const updatedSettings = {
                            ...emailSettings,
                            recipientEmail: localRecipientEmail,
                            emailTemplate: localEmailTemplate,
                          };
                          updateEmailSettings.mutate(updatedSettings);
                        }}
                        disabled={updateEmailSettings.isPending}
                        className="bg-maritime-navy hover:bg-blue-800"
                        size="sm"
                        data-testid="button-save-email-settings"
                      >
                        {updateEmailSettings.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Email Settings
                      </Button>
                      <Button
                        onClick={() => sendTestEmail.mutate({ recipientEmail: localRecipientEmail || 'admin@company.com' })}
                        disabled={sendTestEmail.isPending || !localRecipientEmail}
                        variant="outline"
                        size="sm"
                        data-testid="button-test-email"
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        Send Test Email
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === 'whatsapp' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  WhatsApp Group Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center py-8">
                  <MessageCircle className="h-16 w-16 mx-auto text-green-600 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Automated WhatsApp Alerts
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Send automatic notifications to your office WhatsApp group when contracts are expiring,
                    documents need renewal, or crew rotations are scheduled.
                  </p>
                  <Button
                    onClick={() => setIsWhatsAppModalOpen(true)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="configure-whatsapp-button"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Configure WhatsApp Notifications
                  </Button>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Supported Providers</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <MessageCircle className="h-6 w-6 mx-auto mb-1 text-green-600" />
                      <p className="text-xs font-medium">Wassenger</p>
                      <p className="text-xs text-muted-foreground">Group Support</p>
                    </div>
                    <div className="text-center">
                      <User className="h-6 w-6 mx-auto mb-1 text-blue-600" />
                      <p className="text-xs font-medium">WHAPI</p>
                      <p className="text-xs text-muted-foreground">Professional</p>
                    </div>
                    <div className="text-center">
                      <TestTube className="h-6 w-6 mx-auto mb-1 text-red-600" />
                      <p className="text-xs font-medium">Twilio</p>
                      <p className="text-xs text-muted-foreground">Individual SMS</p>
                    </div>
                    <div className="text-center">
                      <Database className="h-6 w-6 mx-auto mb-1 text-purple-600" />
                      <p className="text-xs font-medium">Custom</p>
                      <p className="text-xs text-muted-foreground">Webhook</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'activity' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    System Activity Report
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => refetchActivity()}
                      disabled={activityLoading}
                      variant="outline"
                      size="sm"
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Button
                      onClick={exportActivityReport}
                      disabled={!activityData || activityData.length === 0 || activityLoading}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Report
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {activityLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Loading activity data...</p>
                  </div>
                ) : activityData && activityData.length > 0 ? (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {activityData.filter((a: any) => a.userRole === 'admin').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Admin Actions</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {activityData.filter((a: any) => a.userRole === 'office_staff').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Office Staff Actions</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {new Set(activityData.map((a: any) => a.username)).size}
                        </div>
                        <div className="text-sm text-muted-foreground">Active Users</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-primary">{activityData.length}</div>
                        <div className="text-sm text-muted-foreground">Total Activities</div>
                      </div>
                    </div>

                    {/* Recent Activity Table */}
                    <div>
                      <h4 className="text-lg font-medium mb-4">Recent System Activities</h4>
                      <div className="border rounded-lg">
                        <div className="max-h-96 overflow-y-auto">
                          <table className="w-full">
                            <thead className="bg-muted sticky top-0">
                              <tr>
                                <th className="text-left p-3 text-sm font-medium">Time</th>
                                <th className="text-left p-3 text-sm font-medium">User</th>
                                <th className="text-left p-3 text-sm font-medium">Role</th>
                                <th className="text-left p-3 text-sm font-medium">Action</th>
                                <th className="text-left p-3 text-sm font-medium">Description</th>
                                <th className="text-left p-3 text-sm font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activityData.slice(0, 50).map((activity: any, index: number) => (
                                <tr key={index} className="border-t hover:bg-muted/50">
                                  <td className="p-3 text-sm">
                                    <div className="flex items-center">
                                      <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                                      {format(new Date(activity.createdAt), 'MMM dd, HH:mm')}
                                    </div>
                                  </td>
                                  <td className="p-3 text-sm">
                                    <div className="flex items-center">
                                      <User className="h-3 w-3 mr-1 text-muted-foreground" />
                                      {activity.username}
                                    </div>
                                  </td>
                                  <td className="p-3 text-sm">
                                    <Badge variant={activity.userRole === 'admin' ? 'default' : 'secondary'} className="text-xs">
                                      {activity.userRole === 'admin' ? 'Admin' : 'Office Staff'}
                                    </Badge>
                                  </td>
                                  <td className="p-3 text-sm font-medium">{activity.type}</td>
                                  <td className="p-3 text-sm text-muted-foreground">{activity.description}</td>
                                  <td className="p-3 text-sm">
                                    <Badge
                                      variant={activity.severity === 'success' || activity.severity === 'info' ? 'outline' : 'destructive'}
                                      className="text-xs"
                                    >
                                      {activity.severity}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {activityData.length > 50 && (
                        <p className="text-sm text-muted-foreground mt-2 text-center">
                          Showing 50 of {activityData.length} activities. Export for full report.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h4 className="text-lg font-medium mb-2">Fresh Start - No Activity Data</h4>
                    <p className="mb-2">The system is ready to track user activities.</p>
                    <p className="text-sm">Activities will be recorded when users:</p>
                    <ul className="text-sm mt-3 space-y-1 max-w-sm mx-auto text-left">
                      <li>• Login/Logout from the system</li>
                      <li>• Create, update, or delete crew members</li>
                      <li>• Manage documents and contracts</li>
                      <li>• Export reports and data</li>
                      <li>• Send notifications and emails</li>
                      <li>• Modify system settings</li>
                    </ul>
                    <p className="text-xs mt-6 text-muted-foreground">
                      All user actions will be logged here for admin review and system auditing.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === 'system' && user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {systemStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-primary">{systemStats.activeCrew}</div>
                      <div className="text-sm text-muted-foreground">Active Crew</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-primary">{systemStats.activeVessels}</div>
                      <div className="text-sm text-muted-foreground">Active Vessels</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-primary">{systemStats.totalContracts}</div>
                      <div className="text-sm text-muted-foreground">Total Contracts</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-primary">{systemStats.pendingActions}</div>
                      <div className="text-sm text-muted-foreground">Pending Actions</div>
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <Label className="text-base font-medium">Database Status</Label>
                  <div className="mt-3 flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Connected and operational</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-base font-medium text-red-600">Danger Zone</Label>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    These actions are destructive and cannot be undone.
                  </p>
                  <div className="border border-red-200 rounded-lg p-4 bg-red-50 dark:bg-red-950/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-red-700 dark:text-red-400">Clear All Crew Data</h4>
                        <p className="text-sm text-red-600/80 dark:text-red-400/80">
                          Delete all crew members, contracts, documents, and status history. Vessels will be preserved.
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        onClick={() => setShowClearCrewDialog(true)}
                        data-testid="button-clear-crew-data"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear Crew Data
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <AlertDialog open={showClearCrewDialog} onOpenChange={setShowClearCrewDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center text-red-600">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Clear All Crew Data
                </AlertDialogTitle>
                <AlertDialogDescription className="text-left space-y-3">
                  <p>This action will permanently delete:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>All crew members ({systemStats?.activeCrew || 0} records)</li>
                    <li>All contracts ({systemStats?.totalContracts || 0} records)</li>
                    <li>All crew documents</li>
                    <li>All status change history</li>
                    <li>All crew rotations</li>
                  </ul>
                  <p className="font-medium text-red-600">This action cannot be undone!</p>
                  <p>Vessels and system settings will be preserved.</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearCrewDataMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearCrewDataMutation.mutate()}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={clearCrewDataMutation.isPending}
                >
                  {clearCrewDataMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Yes, Clear All Crew Data
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {activeSection === 'users' && user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>User management features coming soon</p>
                  <p className="text-sm">This will include user roles, permissions, and account management.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'security' && user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Security settings coming soon</p>
                  <p className="text-sm">This will include password policies, session management, and security logs.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <WhatsAppSettingsModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
      />
    </div>
  );
}