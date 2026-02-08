import { whatsappSettings } from '@shared/schema';
import { WAHAWebhookProvider } from './whatsapp-waha-provider.js';

type WhatsappSettings = typeof whatsappSettings.$inferSelect;


export interface WhatsAppMessage {
  title: string;
  description: string;
  date: string;
  severity: string;
  eventType: string;
  crewMemberName?: string;
  vesselName?: string;
}

export interface WhatsAppProvider {
  sendGroupMessage(groupId: string, message: string): Promise<boolean>;
  formatMessage(template: string, data: WhatsAppMessage): string;
}

// Twilio WhatsApp implementation
export class TwilioWhatsAppProvider implements WhatsAppProvider {
  constructor(
    private accountSid: string,
    private authToken: string,
    private fromNumber: string
  ) { }

  async sendGroupMessage(groupId: string, message: string): Promise<boolean> {
    try {
      // Note: Twilio doesn't support direct group messaging
      // This would send to individual numbers in the group
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: `whatsapp:${this.fromNumber}`,
          To: `whatsapp:${groupId}`, // This would be individual numbers
          Body: message,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Twilio WhatsApp error:', error);
      return false;
    }
  }

  formatMessage(template: string, data: WhatsAppMessage): string {
    return template
      .replace('{{title}}', data.title)
      .replace('{{description}}', data.description)
      .replace('{{date}}', data.date)
      .replace('{{severity}}', data.severity);
  }
}

// Wassenger API implementation
export class WassenterWhatsAppProvider implements WhatsAppProvider {
  constructor(private apiKey: string, private apiUrl: string = 'https://api.wassenger.com/v1') { }

  async sendGroupMessage(groupId: string, message: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/messages`, {
        method: 'POST',
        headers: {
          'Token': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          group: groupId,
          message: message,
          type: 'text',
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Wassenger WhatsApp error:', error);
      return false;
    }
  }

  formatMessage(template: string, data: WhatsAppMessage): string {
    return template
      .replace('{{title}}', data.title)
      .replace('{{description}}', data.description)
      .replace('{{date}}', data.date)
      .replace('{{severity}}', this.getSeverityEmoji(data.severity));
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'high': return '🚨 HIGH';
      case 'warning': return '⚠️ WARNING';
      case 'info': return 'ℹ️ INFO';
      default: return '📋 ' + severity.toUpperCase();
    }
  }
}

// Generic webhook provider for custom integrations
export class WebhookWhatsAppProvider implements WhatsAppProvider {
  constructor(private webhookUrl: string, private apiKey?: string) { }

  async sendGroupMessage(groupId: string, message: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          groupId,
          message,
          timestamp: new Date().toISOString(),
          source: 'crew-management-system',
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Webhook WhatsApp error:', error);
      return false;
    }
  }

  formatMessage(template: string, data: WhatsAppMessage): string {
    return template
      .replace('{{title}}', data.title)
      .replace('{{description}}', data.description)
      .replace('{{date}}', data.date)
      .replace('{{severity}}', data.severity);
  }
}

export class WhatsAppNotificationService {
  private provider: WhatsAppProvider | null = null;

  constructor(private settings: WhatsappSettings) {
    if (!settings.enabled || !settings.groupId) {
      return;
    }

    switch (settings.provider) {
      case 'baileys':
        // Baileys provider - use the global instance from baileys-init
        import('../baileys-init').then(({ getBaileysProvider }) => {
          const baileysProvider = getBaileysProvider();
          if (baileysProvider) {
            this.provider = baileysProvider;
            console.log('✅ Baileys WhatsApp provider initialized for notifications');
          } else {
            console.error('Baileys provider not initialized yet');
          }
        });
        break;
      case 'twilio':
        // For Twilio, we need the account SID, auth token, and from number
        // We'll parse these from the settings or use environment variables
        const accountSid = process.env.TWILIO_ACCOUNT_SID || settings.apiKey?.split(':')[0];
        const authToken = process.env.TWILIO_AUTH_TOKEN || settings.apiKey?.split(':')[1];
        const fromNumber = process.env.TWILIO_FROM_NUMBER || settings.groupId;

        if (accountSid && authToken && fromNumber) {
          this.provider = new TwilioWhatsAppProvider(accountSid, authToken, fromNumber);
        } else {
          console.error('Twilio provider requires account SID, auth token, and from number');
        }
        break;
      case 'wassenger':
        if (settings.apiKey) {
          this.provider = new WassenterWhatsAppProvider(settings.apiKey);
        }
        break;
      case 'waha':
        // WAHA provider - works perfectly on Replit!
        if (settings.webhookUrl && settings.apiKey) {
          this.provider = new WAHAWebhookProvider(
            settings.webhookUrl,
            settings.apiKey,
            'default' // session name
          );
          console.log('✅ WAHA WhatsApp provider initialized');
        } else {
          console.error('WAHA provider requires webhook URL (WAHA instance URL)');
        }
        break;
      case 'whapi':
      case 'custom':
        if (settings.webhookUrl) {
          this.provider = new WebhookWhatsAppProvider(settings.webhookUrl, settings.apiKey || undefined);
        } else {
          console.error('Custom/WHAPI provider requires webhook URL');
        }
        break;
      default:
        console.error(`Unsupported WhatsApp provider: ${settings.provider}`);
        break;
    }
  }

  async sendEventNotification(event: WhatsAppMessage): Promise<boolean> {
    if (!this.provider || !this.settings.enabled) {
      console.log('WhatsApp notifications disabled or not configured');
      return false;
    }

    if (!this.shouldSendNotification(event.eventType)) {
      return false;
    }

    const message = this.provider.formatMessage(
      this.settings.messageTemplate || '📋 *Crew Management Alert*\n\n{{title}}\n{{description}}\n\nDate: {{date}}\nSeverity: {{severity}}',
      event
    );

    return await this.provider.sendGroupMessage(this.settings.groupId!, message);
  }

  private shouldSendNotification(eventType: string): boolean {
    const notificationTypes = this.settings.notificationTypes as string[];
    return notificationTypes.includes(eventType);
  }

  isConfigured(): boolean {
    return this.provider !== null && (this.settings.enabled ?? false);
  }
}