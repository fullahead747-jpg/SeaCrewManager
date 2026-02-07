import { useState } from 'react';
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
  Mail, 
  Bell, 
  Send,
  TestTube,
  Clock,
  User,
  AlertTriangle
} from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';

export default function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [testEmailSent, setTestEmailSent] = useState(false);

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
    mutationFn: async () => {
      return apiRequest('POST', '/api/email/send-test', {});
    },
    onSuccess: () => {
      setTestEmailSent(true);
      toast({
        title: 'Success',
        description: 'Test email sent successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send test email',
        variant: 'destructive',
      });
    },
  });

  const handleEmailSettingsUpdate = (field: string, value: any) => {
    const updatedSettings = {
      ...emailSettings,
      [field]: value,
    };
    updateEmailSettings.mutate(updatedSettings);
  };

  if (user?.role === 'crew') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Bell className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-6">
            Email notifications are only accessible to admin and office staff members.
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
          <h2 className="text-3xl font-bold text-foreground mb-2" data-testid="notifications-title">
            Email Notifications
          </h2>
          <p className="text-muted-foreground">
            Configure email notification settings and preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="h-5 w-5 mr-2" />
              Email Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {emailLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading settings...</p>
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
                  <Label className="text-base font-medium mb-3 block">Notification Recipients</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Crew Members</Label>
                      <Switch 
                        checked={emailSettings?.recipients?.includes('crew') ?? true}
                        onCheckedChange={(checked) => {
                          const recipients = emailSettings?.recipients || [];
                          const newRecipients = checked 
                            ? [...recipients.filter((r: string) => r !== 'crew'), 'crew']
                            : recipients.filter((r: string) => r !== 'crew');
                          handleEmailSettingsUpdate('recipients', newRecipients);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Ship Captains</Label>
                      <Switch 
                        checked={emailSettings?.recipients?.includes('captain') ?? true}
                        onCheckedChange={(checked) => {
                          const recipients = emailSettings?.recipients || [];
                          const newRecipients = checked 
                            ? [...recipients.filter((r: string) => r !== 'captain'), 'captain']
                            : recipients.filter((r: string) => r !== 'captain');
                          handleEmailSettingsUpdate('recipients', newRecipients);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Admin Staff</Label>
                      <Switch 
                        checked={emailSettings?.recipients?.includes('admin') ?? true}
                        onCheckedChange={(checked) => {
                          const recipients = emailSettings?.recipients || [];
                          const newRecipients = checked 
                            ? [...recipients.filter((r: string) => r !== 'admin'), 'admin']
                            : recipients.filter((r: string) => r !== 'admin');
                          handleEmailSettingsUpdate('recipients', newRecipients);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Reminder Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Reminder Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {emailLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-base font-medium mb-3 block">Document Expiry Reminders</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">30 days before expiry</Label>
                        <p className="text-xs text-muted-foreground">Early warning for renewals</p>
                      </div>
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
                      <div>
                        <Label className="text-sm font-medium">15 days before expiry</Label>
                        <p className="text-xs text-muted-foreground">Standard reminder</p>
                      </div>
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
                      <div>
                        <Label className="text-sm font-medium">7 days before expiry</Label>
                        <p className="text-xs text-muted-foreground">Urgent reminder</p>
                      </div>
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

                <div className="flex space-x-3">
                  <Button
                    onClick={() => sendTestEmail.mutate()}
                    disabled={sendTestEmail.isPending}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    {sendTestEmail.isPending ? 'Sending...' : 'Send Test Email'}
                  </Button>
                </div>

                {testEmailSent && (
                  <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <Bell className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-sm text-green-800 dark:text-green-200">
                      Test email sent successfully
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Email Template */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Send className="h-5 w-5 mr-2" />
              Email Template
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {emailLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="email-template" className="text-base font-medium">
                    Notification Email Template
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Customize the email notification template. Use variables like {'{crewName}'}, {'{documentType}'}, and {'{expiryDate}'}.
                  </p>
                  <Textarea
                    id="email-template"
                    rows={8}
                    placeholder={`Subject: Document Expiring Soon - {documentType}

Dear {crewName},

This is a reminder that your {documentType} is expiring on {expiryDate}.

Please ensure you renew this document before the expiry date to maintain compliance.

If you have any questions, please contact the office.

Best regards,
CrewTrack Pro Team`}
                    value={emailSettings?.emailTemplate || ''}
                    onChange={(e) => handleEmailSettingsUpdate('emailTemplate', e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Template Variables
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                        Use these variables in your template:
                      </p>
                      <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                        <li>• <code>{'{crewName}'}</code> - Crew member's full name</li>
                        <li>• <code>{'{documentType}'}</code> - Type of document (Passport, CDC, etc.)</li>
                        <li>• <code>{'{expiryDate}'}</code> - Document expiry date</li>
                        <li>• <code>{'{daysRemaining}'}</code> - Number of days until expiry</li>
                        <li>• <code>{'{vesselName}'}</code> - Current vessel assignment</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}