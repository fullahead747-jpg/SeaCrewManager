import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getAuthHeaders } from '@/lib/auth';
import { MessageCircle, Settings, Phone, Globe, Zap, AlertCircle, CheckCircle } from 'lucide-react';

const whatsappSettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['twilio', 'wassenger', 'whapi', 'custom']),
  apiKey: z.string().optional(),
  groupId: z.string().optional(),
  webhookUrl: z.string().url().optional().or(z.literal('')),
  notificationTypes: z.array(z.string()).default(['contract_expiry', 'document_expiry', 'crew_rotation']),
  reminderDays: z.array(z.number()).default([7, 3, 1]),
  messageTemplate: z.string().optional(),
});

type WhatsAppSettingsFormData = z.infer<typeof whatsappSettingsSchema>;

interface WhatsAppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatsAppSettingsModal({ isOpen, onClose }: WhatsAppSettingsModalProps) {
  const { toast } = useToast();
  const [testMessageSent, setTestMessageSent] = useState(false);

  // Fetch current settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/whatsapp-settings'],
    queryFn: async () => {
      const response = await fetch('/api/whatsapp-settings', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch WhatsApp settings');
      return response.json();
    },
    enabled: isOpen,
  });

  const form = useForm<WhatsAppSettingsFormData>({
    resolver: zodResolver(whatsappSettingsSchema),
    defaultValues: {
      enabled: false,
      provider: 'whapi',
      apiKey: '',
      groupId: '',
      webhookUrl: '',
      notificationTypes: ['contract_expiry', 'document_expiry', 'crew_rotation'],
      reminderDays: [7, 3, 1],
      messageTemplate: '📋 *Crew Management Alert*\n\n{{title}}\n{{description}}\n\nDate: {{date}}\nSeverity: {{severity}}',
    },
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings) {
      const formData = {
        enabled: settings.enabled ?? false,
        provider: settings.provider || 'wassenger',
        apiKey: settings.apiKey === '***REDACTED***' ? '' : settings.apiKey || '',
        groupId: settings.groupId || '',
        webhookUrl: settings.webhookUrl === '***REDACTED***' ? '' : settings.webhookUrl || '',
        notificationTypes: settings.notificationTypes || ['contract_expiry', 'document_expiry', 'crew_rotation'],
        reminderDays: settings.reminderDays || [7, 3, 1],
        messageTemplate: settings.messageTemplate || '📋 *Crew Management Alert*\n\n{{title}}\n{{description}}\n\nDate: {{date}}\nSeverity: {{severity}}',
      };
      form.reset(formData);
    }
  }, [settings, form]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: WhatsAppSettingsFormData) => {
      const response = await apiRequest('PUT', '/api/whatsapp-settings', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save settings');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-settings'] });
      toast({
        title: 'Success',
        description: 'WhatsApp settings saved successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save WhatsApp settings',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: WhatsAppSettingsFormData) => {
    // Filter out empty optional fields
    const cleanData = {
      ...data,
      apiKey: data.apiKey || undefined,
      groupId: data.groupId || undefined,
      webhookUrl: data.webhookUrl || undefined,
    };
    saveSettingsMutation.mutate(cleanData);
  };

  const extractGroupIdFromLink = (link: string): string => {
    // WhatsApp group links format: https://chat.whatsapp.com/GROUPID
    const match = link.match(/https:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
    return match ? match[1] : link;
  };

  const handleGroupLinkChange = (link: string) => {
    const groupId = extractGroupIdFromLink(link);
    form.setValue('groupId', groupId);
  };

  const getProviderInfo = (provider: string) => {
    switch (provider) {
      case 'wassenger':
        return {
          name: 'Wassenger (7 Days FREE)',
          icon: MessageCircle,
          color: 'text-green-600',
          description: '✅ 7-day free trial - Professional group management',
          apiKeyLabel: 'API Token',
          groupIdLabel: 'Group ID',
          webhookRequired: false,
        };
      case 'whapi':
        return {
          name: 'WHAPI Cloud (5 Days FREE)',
          icon: Globe,
          color: 'text-blue-600',
          description: '✅ 5 days completely free - No credit card required',
          apiKeyLabel: 'API Token',
          groupIdLabel: 'Group ID',
          webhookRequired: false,
        };
      case 'twilio':
        return {
          name: 'Twilio (FREE Credits)',
          icon: Phone,
          color: 'text-red-600',
          description: '✅ Free sandbox + credits - Test WhatsApp messaging',
          apiKeyLabel: 'Auth Token',
          groupIdLabel: 'Phone Numbers',
          webhookRequired: false,
        };
      case 'custom':
        return {
          name: 'Custom/Zixflow (FREE Plan)',
          icon: Zap,
          color: 'text-purple-600',
          description: '✅ Permanent free plans available - Custom integration',
          apiKeyLabel: 'API Key (optional)',
          groupIdLabel: 'Group/Chat ID',
          webhookRequired: true,
        };
      default:
        return {
          name: 'Unknown',
          icon: Settings,
          color: 'text-gray-600',
          description: '',
          apiKeyLabel: 'API Key',
          groupIdLabel: 'Group ID',
          webhookRequired: false,
        };
    }
  };

  const selectedProvider = form.watch('provider');
  const providerInfo = getProviderInfo(selectedProvider);
  const ProviderIcon = providerInfo.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageCircle className="h-6 w-6 text-green-600" />
            WhatsApp Group Notifications
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Enable/Disable Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Notification Status</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Enable WhatsApp Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically send contract and document alerts to your office WhatsApp group
                </p>
              </div>
              <Switch
                checked={form.watch('enabled')}
                onCheckedChange={(checked) => form.setValue('enabled', checked)}
                data-testid="whatsapp-enabled-switch"
              />
            </CardContent>
          </Card>

          {/* Provider Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">WhatsApp Provider</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Provider</Label>
                <Select
                  value={selectedProvider}
                  onValueChange={(value) => form.setValue('provider', value as any)}
                  data-testid="provider-select"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whapi">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-blue-600" />
                        <span>WHAPI Cloud (5 Days FREE)</span>
                        <Badge variant="secondary" className="ml-1 text-xs">FREE</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="wassenger">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-green-600" />
                        <span>Wassenger (7 Days FREE)</span>
                        <Badge variant="secondary" className="ml-1 text-xs">TRIAL</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="twilio">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-red-600" />
                        <span>Twilio (FREE Credits)</span>
                        <Badge variant="secondary" className="ml-1 text-xs">FREE</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-purple-600" />
                        <span>Custom/Zixflow (FREE Plan)</span>
                        <Badge variant="secondary" className="ml-1 text-xs">FREE</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={`flex items-center gap-3 p-3 rounded-lg border bg-muted/50`}>
                <ProviderIcon className={`h-5 w-5 ${providerInfo.color}`} />
                <div>
                  <div className="font-medium">{providerInfo.name}</div>
                  <div className="text-sm text-muted-foreground">{providerInfo.description}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Group Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Group Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>WhatsApp Group Link</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="https://chat.whatsapp.com/YOUR_GROUP_ID"
                    onChange={(e) => handleGroupLinkChange(e.target.value)}
                    data-testid="group-link-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste your WhatsApp group invite link here. We'll automatically extract the group ID.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{providerInfo.groupIdLabel}</Label>
                <Input
                  {...form.register('groupId')}
                  placeholder={selectedProvider === 'twilio' ? '+1234567890,+1234567891' : 'Group ID will appear here'}
                  data-testid="group-id-input"
                />
                <p className="text-xs text-muted-foreground">
                  {selectedProvider === 'twilio' 
                    ? 'Comma-separated phone numbers (with country code)' 
                    : 'The unique identifier for your WhatsApp group'
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* API Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">API Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{providerInfo.apiKeyLabel}</Label>
                <Input
                  type="password"
                  {...form.register('apiKey')}
                  placeholder={`Enter your ${providerInfo.name} ${providerInfo.apiKeyLabel.toLowerCase()}`}
                  data-testid="api-key-input"
                />
              </div>

              {providerInfo.webhookRequired && (
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input
                    {...form.register('webhookUrl')}
                    placeholder="https://your-service.com/webhook"
                    data-testid="webhook-url-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your custom webhook endpoint for receiving notifications
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Notification Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Reminder Days</Label>
                <div className="flex gap-2">
                  {[1, 3, 7, 15, 30].map(day => (
                    <Badge
                      key={day}
                      variant={form.watch('reminderDays').includes(day) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        const current = form.watch('reminderDays');
                        const updated = current.includes(day)
                          ? current.filter(d => d !== day)
                          : [...current, day].sort((a, b) => b - a);
                        form.setValue('reminderDays', updated);
                      }}
                      data-testid={`reminder-day-${day}`}
                    >
                      {day} day{day !== 1 ? 's' : ''}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Send notifications X days before contract/document expiry
                </p>
              </div>

              <div className="space-y-2">
                <Label>Message Template</Label>
                <Textarea
                  {...form.register('messageTemplate')}
                  rows={4}
                  placeholder="📋 *Crew Management Alert*\n\n{{title}}\n{{description}}\n\nDate: {{date}}\nSeverity: {{severity}}"
                  data-testid="message-template-input"
                />
                <p className="text-xs text-muted-foreground">
                  Use {'{{title}}'}, {'{{description}}'}, {'{{date}}'}, {'{{severity}}'} as placeholders
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              {form.watch('enabled') && (
                <div className="flex items-center gap-1 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">Notifications Active</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saveSettingsMutation.isPending}
                data-testid="save-settings-button"
              >
                {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}