import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { insertEmailSettingsSchema, EmailSettings } from '@shared/schema';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Send, Settings } from 'lucide-react';
import { z } from 'zod';

const emailSettingsFormSchema = insertEmailSettingsSchema.extend({
  reminder30: z.boolean(),
  reminder15: z.boolean(),
  reminder7: z.boolean(),
  recipientCrew: z.boolean(),
  recipientCaptain: z.boolean(),
  recipientAdmin: z.boolean(),
});

type EmailSettingsFormData = z.infer<typeof emailSettingsFormSchema>;

interface EmailSettingsModalProps {
  settings?: EmailSettings;
  onClose: () => void;
}

export default function EmailSettingsModal({ settings, onClose }: EmailSettingsModalProps) {
  const { toast } = useToast();
  const [testEmailSent, setTestEmailSent] = useState(false);

  const form = useForm<EmailSettingsFormData>({
    resolver: zodResolver(emailSettingsFormSchema),
    defaultValues: {
      enabled: settings?.enabled ?? true,
      reminder30: (settings?.reminderDays as number[] | undefined)?.includes(30) ?? true,
      reminder15: (settings?.reminderDays as number[] | undefined)?.includes(15) ?? true,
      reminder7: (settings?.reminderDays as number[] | undefined)?.includes(7) ?? true,
      recipientCrew: (settings?.recipients as string[] | undefined)?.includes('crew') ?? true,
      recipientCaptain: (settings?.recipients as string[] | undefined)?.includes('captain') ?? true,
      recipientAdmin: (settings?.recipients as string[] | undefined)?.includes('admin') ?? true,
      emailTemplate: settings?.emailTemplate ?? '',
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: EmailSettingsFormData) => {
      const { reminder30, reminder15, reminder7, recipientCrew, recipientCaptain, recipientAdmin, ...settingsData } = data;

      const reminderDays = [];
      if (reminder30) reminderDays.push(30);
      if (reminder15) reminderDays.push(15);
      if (reminder7) reminderDays.push(7);

      const recipients = [];
      if (recipientCrew) recipients.push('crew');
      if (recipientCaptain) recipients.push('captain');
      if (recipientAdmin) recipients.push('admin');

      const payload = {
        ...settingsData,
        reminderDays,
        recipients,
      };

      return apiRequest('PUT', '/api/email-settings', payload);
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

  const testEmailMutation = useMutation({
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

  const onSubmit = (data: EmailSettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const handleTestEmail = () => {
    testEmailMutation.mutate();
  };

  const defaultTemplate = `Dear [Crew Member],

Your [Document Type] with document number [Document Number] is scheduled to expire on [Expiry Date]. 

Please contact your Fleet Administrator to discuss renewal arrangements or provide updated documentation.

For immediate assistance, please contact:
- Email: admin@crewtrack.com  
- Phone: +1-555-0123

Best regards,
CrewTrack Pro Team`;

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <Mail className="h-5 w-5 maritime-navy" />
          <span>Email Notification Settings</span>
        </DialogTitle>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Global Enable/Disable */}
          <div className="space-y-3">
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-y-0">
                  <div>
                    <FormLabel className="text-base font-medium">Email Notifications</FormLabel>
                    <p className="text-sm text-gray-500">Enable automated email alerts for document expiry</p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={!!field.value}
                      onCheckedChange={field.onChange}
                      data-testid="email-notifications-toggle"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {form.watch('enabled') && (
            <>
              {/* Reminder Schedule */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-medium text-gray-900 mb-3">Contract Expiry Reminders</h4>
                  <p className="text-sm text-gray-500 mb-4">Select when to send reminder emails before document expiry</p>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="reminder30"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                              data-testid="reminder-30-days"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium">30 Days</FormLabel>
                        </div>
                        <p className="text-xs text-gray-500">Early warning reminder</p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reminder15"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                              data-testid="reminder-15-days"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium">15 Days</FormLabel>
                        </div>
                        <p className="text-xs text-gray-500">Standard reminder</p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reminder7"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                              data-testid="reminder-7-days"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium">7 Days</FormLabel>
                        </div>
                        <p className="text-xs text-gray-500">Urgent reminder</p>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Notification Recipients */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-medium text-gray-900 mb-3">Notification Recipients</h4>
                  <p className="text-sm text-gray-500 mb-4">Select who should receive email notifications</p>
                </div>

                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="recipientCrew"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                            data-testid="recipient-crew"
                          />
                        </FormControl>
                        <div className="grid gap-1.5 leading-none">
                          <FormLabel className="text-sm font-medium">Crew Member</FormLabel>
                          <p className="text-xs text-gray-500">
                            Send notifications to the crew member whose document is expiring
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recipientCaptain"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                            data-testid="recipient-captain"
                          />
                        </FormControl>
                        <div className="grid gap-1.5 leading-none">
                          <FormLabel className="text-sm font-medium">Vessel Master</FormLabel>
                          <p className="text-xs text-gray-500">
                            Notify the captain of the vessel where the crew member is assigned
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recipientAdmin"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                            data-testid="recipient-admin"
                          />
                        </FormControl>
                        <div className="grid gap-1.5 leading-none">
                          <FormLabel className="text-sm font-medium">Fleet Administrator</FormLabel>
                          <p className="text-xs text-gray-500">
                            Send alerts to the head office administration team
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Email Template */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-medium text-gray-900 mb-3">Email Template</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Customize the email message template. Use placeholders like [Crew Member], [Document Type], [Expiry Date], etc.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="emailTemplate"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ''}
                          placeholder={defaultTemplate}
                          className="min-h-32"
                          data-testid="email-template-textarea"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Template Preview */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
                  <h5 className="font-medium text-gray-900 mb-2">Preview</h5>
                  <div className="text-gray-700 whitespace-pre-wrap">
                    {form.watch('emailTemplate') || defaultTemplate}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Test Email Section */}
          {testEmailSent && (
            <Alert className="border-compliance-green bg-green-50">
              <Mail className="h-4 w-4 compliance-green" />
              <AlertDescription className="text-green-700">
                Test email sent successfully! Check your inbox to verify the email format.
              </AlertDescription>
            </Alert>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestEmail}
              disabled={testEmailMutation.isPending || !form.watch('enabled')}
              data-testid="send-test-email-button"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Test Email
            </Button>

            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="cancel-settings-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-maritime-navy hover:bg-blue-800"
                disabled={updateSettingsMutation.isPending}
                data-testid="save-settings-button"
              >
                <Settings className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}
