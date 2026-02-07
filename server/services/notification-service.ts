import { WhatsAppNotificationService, type WhatsAppMessage } from './whatsapp-notification';
import { smtpEmailService, sendCDCExpiryAlert, sendPassportExpiryAlert, sendCOCExpiryAlert, sendMedicalExpiryAlert, type CDCExpiryAlertData, type PassportExpiryAlertData, type COCExpiryAlertData, type MedicalExpiryAlertData } from './smtp-email-service';
import { documentAccessService } from './document-access-service';
import { storage } from '../storage';
import { whatsappSettings } from '@shared/schema';

// Alerts are sent at 90, 60, 30, 15, 7, and 0 days before/at expiry
const DOCUMENT_REMINDER_DAYS = [90, 60, 30, 15, 7, 0];
const DAILY_REMINDER_THRESHOLD = 7; // Start daily reminders when <= 7 days remaining (reduced from 15 for weekly summaries)

type WhatsappSettings = typeof whatsappSettings.$inferSelect;

export interface UpcomingEvent {
  id: string;
  type: 'contract_expiry' | 'document_expiry' | 'crew_join' | 'crew_leave' | 'maintenance_completion';
  title: string;
  description: string;
  date: Date;
  severity: 'success' | 'info' | 'warning' | 'high';
  crewMemberId?: string;
  vesselId?: string;
  contractId?: string;
  documentId?: string;
  documentType?: string;
  documentNumber?: string;
  issuingAuthority?: string;
  rotationId?: string;
  crewMemberName?: string;
  crewMemberRank?: string;
  crewMemberNationality?: string;
  vesselName?: string;
}

export class NotificationService {
  private whatsappService: WhatsAppNotificationService | null = null;
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 5000; // 5 seconds
  private defaultFromEmail = 'noreply@crewtrack.com'; // You can customize this

  async initialize() {
    try {
      console.log('🔄 Initializing notification service...');
      const settings = await storage.getWhatsappSettings();

      if (settings) {
        this.whatsappService = new WhatsAppNotificationService(settings);

        if (this.whatsappService.isConfigured()) {
          console.log(`✅ WhatsApp notification service initialized with provider: ${settings.provider}`);
        } else {
          console.log('⚠️  WhatsApp service initialized but not properly configured');
        }
      } else {
        console.log('ℹ️  No WhatsApp settings found - notifications disabled');
        this.whatsappService = null;
      }
    } catch (error) {
      console.error('❌ Failed to initialize notification service:', error);
      this.whatsappService = null;

      // Log the initialization error
      try {
        await storage.logNotification({
          eventId: 'system-init',
          eventType: 'system_error',
          eventDate: new Date(),
          notificationDate: new Date(),
          daysBeforeEvent: 0,
          provider: 'system',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown initialization error',
          retryCount: 0,
          metadata: {
            action: 'service_initialization',
            error: error instanceof Error ? error.stack : String(error),
          }
        });
      } catch (logError) {
        console.error('❌ Failed to log initialization error:', logError);
      }
    }
  }

  async sendEventNotifications(events: UpcomingEvent[]): Promise<void> {
    const [whatsappSettings, emailSettings] = await Promise.all([
      storage.getWhatsappSettings(),
      storage.getEmailSettings()
    ]);

    const now = new Date();

    // Determine which notification methods are available
    const whatsappEnabled = whatsappSettings?.enabled && this.whatsappService?.isConfigured();
    // Use Gmail SMTP instead of SendGrid
    const emailEnabled = emailSettings?.enabled && smtpEmailService.isReady();

    if (!whatsappEnabled && !emailEnabled) {
      console.log('No notification methods configured (WhatsApp and Email both disabled)');
      return;
    }

    console.log(`📧 Notification methods available: WhatsApp: ${whatsappEnabled ? '✅' : '❌'}, Email: ${emailEnabled ? '✅' : '❌'}`);

    // Default reminder days for general events
    const defaultReminderDays = (emailSettings?.reminderDays || whatsappSettings?.reminderDays || [7, 15, 30]) as number[];

    for (const event of events) {
      // Check if this event should trigger a notification
      const daysUntilEvent = Math.ceil((event.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check if this is a document or contract expiry that needs special handling
      const isCDC = event.type === 'document_expiry' && event.documentType?.toLowerCase() === 'cdc';
      const isPassport = event.type === 'document_expiry' && event.documentType?.toLowerCase() === 'passport';
      const isCOC = event.type === 'document_expiry' && (event.documentType?.toLowerCase() === 'coc');
      const docTypeLower = event.documentType?.toLowerCase() || '';
      const isMedical = event.type === 'document_expiry' && (docTypeLower === 'medical' || docTypeLower === 'medical certificate' || docTypeLower.includes('medical'));
      const isContract = event.type === 'contract_expiry';
      const isImportantDocument = isCDC || isPassport || isCOC || isMedical || isContract;

      const reminderDays = isImportantDocument ? DOCUMENT_REMINDER_DAYS : defaultReminderDays;

      // Check if we should send a notification
      let shouldSendNotification = false;
      let notificationType = 'standard'; // 'standard' or 'daily_reminder'

      if (reminderDays.includes(daysUntilEvent)) {
        // Standard milestone notification (60, 30, 15, or 7 days)
        shouldSendNotification = true;
        notificationType = 'standard';
        console.log(`📋 Processing milestone notification for ${event.crewMemberName} - ${daysUntilEvent} days`);
      } else if (isImportantDocument && daysUntilEvent <= DAILY_REMINDER_THRESHOLD) {
        // Daily reminder for documents/contracts with <= 7 days remaining or already expired
        // Check if we already sent a daily reminder today
        const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        const alreadySentToday = await storage.hasNotificationBeenSentToday(
          event.id,
          event.type,
          'email',
          todayStr
        );

        if (!alreadySentToday) {
          shouldSendNotification = true;
          notificationType = 'daily_reminder';
          console.log(`📋 Processing daily reminder for ${event.crewMemberName} - ${daysUntilEvent} days remaining`);
        } else {
          console.log(`🔄 Skipping daily reminder for ${event.crewMemberName} - already sent today`);
        }
      }

      if (shouldSendNotification) {
        // Send WhatsApp notification if enabled
        if (whatsappEnabled) {
          await this.sendWhatsAppNotification(event, daysUntilEvent, now);
        }

        // Send Email notification if enabled
        if (emailEnabled && emailSettings) {
          await this.sendEmailNotification(event, daysUntilEvent, now, emailSettings);
        }
      }
    }
  }

  private async sendWhatsAppNotification(event: UpcomingEvent, daysUntilEvent: number, now: Date): Promise<void> {
    // Check if WhatsApp notifications are disabled via environment variable
    if (process.env.DISABLE_WHATSAPP_NOTIFICATIONS === 'true') {
      console.log('📱 WhatsApp notifications disabled via DISABLE_WHATSAPP_NOTIFICATIONS flag - skipping');
      return;
    }

    const provider = 'whatsapp';

    // Check if notification has already been sent for this event and reminder period
    const alreadySent = await storage.hasNotificationBeenSent(
      event.id,
      event.type,
      daysUntilEvent,
      provider
    );

    if (alreadySent) {
      console.log(`🔄 Skipping duplicate WhatsApp notification for event: ${event.title} (${daysUntilEvent} days before)`);
      return;
    }

    const message: WhatsAppMessage = {
      title: event.title,
      description: event.description,
      date: event.date.toLocaleDateString(),
      severity: event.severity,
      eventType: event.type,
      crewMemberName: event.crewMemberName,
      vesselName: event.vesselName,
    };

    let notificationId: string | null = null;

    try {
      // Log the notification attempt before sending
      const notificationRecord = await storage.logNotification({
        eventId: event.id,
        eventType: event.type,
        eventDate: event.date,
        notificationDate: now,
        daysBeforeEvent: daysUntilEvent,
        provider: provider,
        success: false, // Will update to true if successful
        retryCount: 0,
        metadata: {
          eventTitle: event.title,
          crewMemberName: event.crewMemberName,
          vesselName: event.vesselName,
          severity: event.severity,
        }
      });

      notificationId = notificationRecord.id;

      // Attempt to send the notification
      const success = await this.whatsappService!.sendEventNotification(message);

      if (success) {
        // Update notification record as successful
        await storage.updateNotificationStatus(notificationId, true);
        console.log(`✅ WhatsApp notification sent for event: ${event.title} (${daysUntilEvent} days before)`);
      } else {
        // Update notification record with failure
        await storage.updateNotificationStatus(
          notificationId,
          false,
          'Failed to send notification - provider returned false',
          1
        );
        console.error(`❌ Failed to send WhatsApp notification for event: ${event.title}`);
      }
    } catch (error) {
      console.error(`❌ Error sending WhatsApp notification for event: ${event.title}:`, error);

      // Update notification record with error
      if (notificationId) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        await storage.updateNotificationStatus(
          notificationId,
          false,
          errorMessage,
          1
        );
      }
    }
  }

  private async sendEmailNotification(event: UpcomingEvent, daysUntilEvent: number, now: Date, emailSettings: any): Promise<void> {
    // Check if email notifications are disabled via environment variable
    if (process.env.DISABLE_EMAIL_NOTIFICATIONS === 'true') {
      console.log('📧 Email notifications disabled via DISABLE_EMAIL_NOTIFICATIONS flag - skipping');
      return;
    }

    const provider = 'email';

    // Check if notification has already been sent for this event and reminder period
    const alreadySent = await storage.hasNotificationBeenSent(
      event.id,
      event.type,
      daysUntilEvent,
      provider
    );

    if (alreadySent) {
      console.log(`🔄 Skipping duplicate email notification for event: ${event.title} (${daysUntilEvent} days before)`);
      return;
    }

    let notificationId: string | null = null;

    try {
      // Log the notification attempt before sending
      const notificationRecord = await storage.logNotification({
        eventId: event.id,
        eventType: event.type,
        eventDate: event.date,
        notificationDate: now,
        daysBeforeEvent: daysUntilEvent,
        provider: provider,
        success: false, // Will update to true if successful
        retryCount: 0,
        metadata: {
          eventTitle: event.title,
          crewMemberName: event.crewMemberName,
          vesselName: event.vesselName,
          severity: event.severity,
          documentType: event.documentType,
        }
      });

      notificationId = notificationRecord.id;
      let success = false;

      const recipientEmail = emailSettings.recipientEmail || 'admin@offing.biz, management@fullahead.in';

      // Generate secure document view link if documentId is available
      let documentViewUrl: string | undefined;
      if (event.documentId) {
        try {
          const token = await documentAccessService.generateAccessToken(
            event.documentId,
            48, // 48 hours expiry
            'email_notification'
          );
          documentViewUrl = documentAccessService.generateViewUrl(token);
          console.log(`🔗 Generated secure document link for ${event.documentType} - expires in 48h`);
        } catch (error) {
          console.error('❌ Failed to generate document access token:', error);
        }
      }

      // Handle CDC document expiry with special template
      if (event.type === 'document_expiry' && event.documentType?.toLowerCase() === 'cdc') {
        // Use CDC-specific email template
        const cdcData: CDCExpiryAlertData = {
          crewMemberName: event.crewMemberName || 'Unknown',
          vesselName: event.vesselName,
          cdcNumber: event.documentNumber || 'N/A',
          issuingAuthority: event.issuingAuthority || 'N/A',
          expiryDate: event.date,
          daysUntilExpiry: daysUntilEvent,
          crewMemberRank: event.crewMemberRank,
          crewMemberNationality: event.crewMemberNationality,
          documentViewUrl, // Add secure link
        };
        success = (await sendCDCExpiryAlert(recipientEmail, cdcData)).success;
      } else if (event.type === 'document_expiry' && event.documentType?.toLowerCase() === 'passport') {
        // Use Passport-specific email template
        const passportData: PassportExpiryAlertData = {
          crewMemberName: event.crewMemberName || 'Unknown',
          vesselName: event.vesselName,
          passportNumber: event.documentNumber || 'N/A',
          issuingAuthority: event.issuingAuthority || 'N/A',
          expiryDate: event.date,
          daysUntilExpiry: daysUntilEvent,
          crewMemberRank: event.crewMemberRank,
          crewMemberNationality: event.crewMemberNationality,
          documentViewUrl, // Add secure link
        };
        success = (await sendPassportExpiryAlert(recipientEmail, passportData)).success;
      } else if (event.type === 'document_expiry' && (event.documentType?.toLowerCase() === 'coc')) {
        // Use COC-specific email template
        const cocData: COCExpiryAlertData = {
          crewMemberName: event.crewMemberName || 'Unknown',
          vesselName: event.vesselName,
          cocNumber: event.documentNumber || 'N/A',
          issuingAuthority: event.issuingAuthority || 'N/A',
          expiryDate: event.date,
          daysUntilExpiry: daysUntilEvent,
          crewMemberRank: event.crewMemberRank,
          crewMemberNationality: event.crewMemberNationality,
          documentViewUrl, // Add secure link
        };
        success = (await sendCOCExpiryAlert(recipientEmail, cocData)).success;
      } else if (event.type === 'document_expiry' && (event.documentType?.toLowerCase() === 'medical' || event.documentType?.toLowerCase() === 'medical certificate' || event.documentType?.toLowerCase().includes('medical'))) {
        // Use Medical Certificate-specific email template
        const medicalData: MedicalExpiryAlertData = {
          crewMemberName: event.crewMemberName || 'Unknown',
          vesselName: event.vesselName,
          medicalNumber: event.documentNumber || 'N/A',
          issuingAuthority: event.issuingAuthority || 'N/A',
          expiryDate: event.date,
          daysUntilExpiry: daysUntilEvent,
          crewMemberRank: event.crewMemberRank,
          crewMemberNationality: event.crewMemberNationality,
          documentViewUrl, // Add secure link
        };
        success = (await sendMedicalExpiryAlert(recipientEmail, medicalData)).success;
      } else {
        // Generic email template for other event types
        const emailContent = {
          subject: `🔔 ${event.title} - ${daysUntilEvent} days`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
              <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="color: #1e3a5f; margin: 0 0 20px 0;">${event.title}</h2>
                <p style="color: #374151; line-height: 1.6;"><strong>Description:</strong> ${event.description}</p>
                <p style="color: #374151; line-height: 1.6;"><strong>Date:</strong> ${event.date.toLocaleDateString()}</p>
                <p style="color: #374151; line-height: 1.6;"><strong>Days Remaining:</strong> ${daysUntilEvent} days</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #6b7280; font-size: 12px;">This is an automated notification from your Crew Management System</p>
              </div>
            </div>
          `,
        };
        success = (await smtpEmailService.sendEmail({
          to: recipientEmail,
          subject: emailContent.subject,
          html: emailContent.html,
        })).success;
      }

      if (success) {
        // Update notification record as successful
        await storage.updateNotificationStatus(notificationId, true);
        console.log(`✅ Email notification sent for event: ${event.title} (${daysUntilEvent} days before)`);
      } else {
        // Update notification record with failure
        await storage.updateNotificationStatus(
          notificationId,
          false,
          'Failed to send email notification via Gmail SMTP',
          1
        );
        console.error(`❌ Failed to send email notification for event: ${event.title}`);
      }
    } catch (error) {
      console.error(`❌ Error sending email notification for event: ${event.title}:`, error);

      // Update notification record with error
      if (notificationId) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        await storage.updateNotificationStatus(
          notificationId,
          false,
          errorMessage,
          1
        );
      }
    }
  }

  /**
   * Send immediate document expiry alert when a document is created/updated with expiry within 30 days
   * This bypasses the standard scheduler for urgent notifications
   */
  async sendImmediateDocumentAlert(
    document: { id: string; type: string; expiryDate: Date | null; documentNumber?: string | null; issuingAuthority?: string | null },
    crewMember: { id: string; name: string; rank?: string | null; nationality?: string | null },
    vesselName?: string
  ): Promise<boolean> {
    try {
      // Check if email notifications are disabled via environment variable
      if (process.env.DISABLE_EMAIL_NOTIFICATIONS === 'true') {
        console.log('📧 Email notifications disabled via DISABLE_EMAIL_NOTIFICATIONS flag - skipping immediate document alert');
        return false;
      }

      if (!document.expiryDate) return false;

      const now = new Date();
      const daysUntilExpiry = Math.ceil((new Date(document.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Only send immediate alert if expiry is within 30 days but not expired
      if (daysUntilExpiry > 30 || daysUntilExpiry <= 0) {
        return false;
      }

      console.log(`🚨 Immediate alert triggered: ${crewMember.name}'s ${document.type} expires in ${daysUntilExpiry} days`);

      const emailSettings = await storage.getEmailSettings();
      if (!emailSettings?.enabled || !smtpEmailService.isReady()) {
        console.log('⚠️ Email notifications not enabled - skipping immediate document alert');
        return false;
      }
      const recipientEmail = emailSettings.recipientEmail || 'admin@offing.biz, management@fullahead.in';
      const docType = document.type.toLowerCase();
      let success = false;

      if (docType === 'cdc') {
        const cdcData: CDCExpiryAlertData = {
          crewMemberName: crewMember.name,
          vesselName,
          cdcNumber: document.documentNumber || 'N/A',
          issuingAuthority: document.issuingAuthority || 'N/A',
          expiryDate: document.expiryDate,
          daysUntilExpiry,
          crewMemberRank: crewMember.rank || undefined,
          crewMemberNationality: crewMember.nationality || undefined,
        };
        const result = await sendCDCExpiryAlert(recipientEmail, cdcData);
        success = result.success;
      } else if (docType === 'passport') {
        const passportData: PassportExpiryAlertData = {
          crewMemberName: crewMember.name || 'Unknown',
          vesselName,
          passportNumber: document.documentNumber || 'N/A',
          issuingAuthority: document.issuingAuthority || 'N/A',
          expiryDate: document.expiryDate,
          daysUntilExpiry,
          crewMemberRank: crewMember.rank || undefined,
          crewMemberNationality: crewMember.nationality || undefined,
        };
        const result = await sendPassportExpiryAlert(recipientEmail, passportData);
        success = result.success;
      } else if (docType === 'coc') {
        const cocData: COCExpiryAlertData = {
          crewMemberName: crewMember.name,
          vesselName,
          cocNumber: document.documentNumber || 'N/A',
          issuingAuthority: document.issuingAuthority || 'N/A',
          expiryDate: document.expiryDate,
          daysUntilExpiry,
          crewMemberRank: crewMember.rank || undefined,
          crewMemberNationality: crewMember.nationality || undefined,
        };
        const result = await sendCOCExpiryAlert(recipientEmail, cocData);
        success = result.success;
      } else if (docType === 'medical' || docType === 'medical certificate' || docType.includes('medical')) {
        const medicalData: MedicalExpiryAlertData = {
          crewMemberName: crewMember.name,
          vesselName,
          medicalNumber: document.documentNumber || 'N/A',
          issuingAuthority: document.issuingAuthority || 'N/A',
          expiryDate: document.expiryDate,
          daysUntilExpiry,
          crewMemberRank: crewMember.rank || undefined,
          crewMemberNationality: crewMember.nationality || undefined,
        };
        const result = await sendMedicalExpiryAlert(recipientEmail, medicalData);
        success = result.success;
      } else {
        // Generic document alert
        const emailContent = {
          subject: `🚨 URGENT: ${crewMember.name}'s ${document.type} expires in ${daysUntilExpiry} days`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
              <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="color: #dc2626; margin: 0 0 20px 0;">🚨 Urgent Document Expiry Alert</h2>
                <p style="color: #374151; line-height: 1.6;"><strong>Crew Member:</strong> ${crewMember.name}</p>
                <p style="color: #374151; line-height: 1.6;"><strong>Document Type:</strong> ${document.type}</p>
                <p style="color: #374151; line-height: 1.6;"><strong>Document Number:</strong> ${document.documentNumber || 'N/A'}</p>
                <p style="color: #374151; line-height: 1.6;"><strong>Expiry Date:</strong> ${document.expiryDate.toLocaleDateString()}</p>
                <p style="color: #dc2626; line-height: 1.6; font-weight: bold;"><strong>Days Remaining:</strong> ${daysUntilExpiry} days</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #6b7280; font-size: 12px;">This document was just uploaded/updated and requires immediate attention.</p>
              </div>
            </div>
          `,
        };
        const result = await smtpEmailService.sendEmail({
          to: recipientEmail,
          subject: emailContent.subject,
          html: emailContent.html,
        });
        success = result.success;
      }

      // Log the immediate notification
      await storage.logNotification({
        eventId: `immediate-doc-${document.id}`,
        eventType: 'document_expiry',
        eventDate: document.expiryDate,
        notificationDate: now,
        daysBeforeEvent: daysUntilExpiry,
        provider: 'email',
        success,
        errorMessage: success ? undefined : 'Failed to send immediate document alert',
        retryCount: 0,
        metadata: {
          documentType: document.type,
          crewMemberName: crewMember.name,
          vesselName,
          immediate: true,
        }
      });

      if (success) {
        console.log(`✅ Immediate document alert sent for ${crewMember.name}'s ${document.type}`);
      } else {
        console.error(`❌ Failed to send immediate document alert for ${crewMember.name}'s ${document.type}`);
      }

      return success;
    } catch (error) {
      console.error('❌ Error sending immediate document alert:', error);
      return false;
    }
  }

  /**
   * Send immediate contract expiry alert when a contract is created/updated with end date within 30 days
   * This bypasses the standard scheduler for urgent notifications
   */
  async sendImmediateContractAlert(
    contract: { id: string; endDate: Date | null; status?: string | null },
    crewMember: { id: string; name: string; rank?: string | null; nationality?: string | null },
    vesselName?: string
  ): Promise<boolean> {
    try {
      // Check if email notifications are disabled via environment variable
      if (process.env.DISABLE_EMAIL_NOTIFICATIONS === 'true') {
        console.log('📧 Email notifications disabled via DISABLE_EMAIL_NOTIFICATIONS flag - skipping immediate contract alert');
        return false;
      }

      if (!contract.endDate) return false;

      const now = new Date();
      const daysUntilExpiry = Math.ceil((new Date(contract.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Only send immediate alert if expiry is within 30 days but not expired
      if (daysUntilExpiry > 30 || daysUntilExpiry <= 0) {
        return false;
      }

      console.log(`🚨 Immediate alert triggered: ${crewMember.name}'s contract expires in ${daysUntilExpiry} days`);

      const emailSettings = await storage.getEmailSettings();
      if (!emailSettings?.enabled || !smtpEmailService.isReady()) {
        console.log('⚠️ Email notifications not enabled - skipping immediate contract alert');
        return false;
      }
      const recipientEmail = emailSettings.recipientEmail || 'admin@offing.biz, management@fullahead.in';

      const emailContent = {
        subject: `🚨 URGENT: ${crewMember.name}'s Contract expires in ${daysUntilExpiry} days`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
            <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #dc2626; margin: 0 0 20px 0;">🚨 Urgent Contract Due Alert</h2>
              <p style="color: #374151; line-height: 1.6;"><strong>Crew Member:</strong> ${crewMember.name}</p>
              ${crewMember.rank ? `<p style="color: #374151; line-height: 1.6;"><strong>Rank:</strong> ${crewMember.rank}</p>` : ''}
              ${vesselName ? `<p style="color: #374151; line-height: 1.6;"><strong>Vessel:</strong> ${vesselName}</p>` : ''}
              <p style="color: #374151; line-height: 1.6;"><strong>Contract Status:</strong> ${contract.status || 'Active'}</p>
              <p style="color: #374151; line-height: 1.6;"><strong>Contract End Date:</strong> ${contract.endDate.toLocaleDateString()}</p>
              <p style="color: #dc2626; line-height: 1.6; font-weight: bold;"><strong>Days Remaining:</strong> ${daysUntilExpiry} days</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="color: #6b7280; font-size: 12px;">This contract was just created/updated and requires immediate attention for renewal planning.</p>
            </div>
          </div>
        `,
      };

      const result = await smtpEmailService.sendEmail({
        to: recipientEmail,
        subject: emailContent.subject,
        html: emailContent.html,
      });
      const success = result.success;

      // Log the immediate notification
      await storage.logNotification({
        eventId: `immediate-contract-${contract.id}`,
        eventType: 'contract_expiry',
        eventDate: contract.endDate,
        notificationDate: now,
        daysBeforeEvent: daysUntilExpiry,
        provider: 'email',
        success,
        errorMessage: success ? undefined : 'Failed to send immediate contract alert',
        retryCount: 0,
        metadata: {
          crewMemberName: crewMember.name,
          vesselName,
          immediate: true,
        }
      });

      if (success) {
        console.log(`✅ Immediate contract alert sent for ${crewMember.name}'s contract`);
      } else {
        console.error(`❌ Failed to send immediate contract alert for ${crewMember.name}'s contract`);
      }

      return success;
    } catch (error) {
      console.error('❌ Error sending immediate contract alert:', error);
      return false;
    }
  }

  /**
   * Retry failed notifications with exponential backoff
   */
  async retryFailedNotifications(): Promise<void> {
    try {
      console.log('🔄 Checking for failed notifications to retry...');
      const failedNotifications = await storage.getFailedNotifications(this.maxRetries);

      if (failedNotifications.length === 0) {
        console.log('✅ No failed notifications to retry');
        return;
      }

      console.log(`📋 Found ${failedNotifications.length} failed notifications to retry`);

      for (const notification of failedNotifications) {
        try {
          // Wait before retrying (simple exponential backoff)
          const retryDelay = this.retryDelayMs * Math.pow(2, notification.retryCount || 0);
          await new Promise(resolve => setTimeout(resolve, Math.min(retryDelay, 30000))); // Max 30 seconds

          // Reconstruct the event message
          const metadata = notification.metadata as any;
          const message: WhatsAppMessage = {
            title: metadata?.eventTitle || 'Event Notification',
            description: `Retry notification for ${notification.eventType}`,
            date: notification.eventDate.toLocaleDateString(),
            severity: metadata?.severity || 'info',
            eventType: notification.eventType,
            crewMemberName: metadata?.crewMemberName,
            vesselName: metadata?.vesselName,
          };

          if (this.whatsappService && this.whatsappService.isConfigured()) {
            const success = await this.whatsappService.sendEventNotification(message);

            if (success) {
              await storage.updateNotificationStatus(notification.id, true);
              console.log(`✅ Retry successful for notification: ${notification.eventId}`);
            } else {
              const newRetryCount = (notification.retryCount || 0) + 1;
              await storage.updateNotificationStatus(
                notification.id,
                false,
                `Retry ${newRetryCount} failed - provider returned false`,
                newRetryCount
              );
              console.log(`❌ Retry ${newRetryCount} failed for notification: ${notification.eventId}`);
            }
          }
        } catch (error) {
          const newRetryCount = (notification.retryCount || 0) + 1;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error during retry';

          await storage.updateNotificationStatus(
            notification.id,
            false,
            errorMessage,
            newRetryCount
          );

          console.error(`❌ Error during retry ${newRetryCount} for notification ${notification.eventId}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Failed to process notification retries:', error);
    }
  }

  async checkAndNotifyUpcomingEvents(): Promise<void> {
    const startTime = Date.now();
    let eventsProcessed = 0;
    let notificationsSent = 0;
    let notificationsFailed = 0;
    let duplicatesSkipped = 0;

    try {
      console.log('🔍 Starting notification check for upcoming events...');

      // Re-initialize to pick up any settings changes
      await this.initialize();

      // Retry any failed notifications first
      await this.retryFailedNotifications();

      const [whatsappSettings, emailSettings] = await Promise.all([
        storage.getWhatsappSettings(),
        storage.getEmailSettings()
      ]);

      const whatsappEnabled = whatsappSettings?.enabled && this.whatsappService?.isConfigured();
      const emailEnabled = emailSettings?.enabled && smtpEmailService.isReady();

      if (!whatsappEnabled && !emailEnabled) {
        console.log('⚠️  Both WhatsApp and Email notifications are disabled');
        return;
      }

      console.log(`📧 Email notifications: ${emailEnabled ? 'ENABLED' : 'disabled'}`);
      console.log(`📱 WhatsApp notifications: ${whatsappEnabled ? 'ENABLED' : 'disabled'}`);

      // Use email reminder days if available, otherwise whatsapp, otherwise default
      const reminderDays = (emailSettings?.reminderDays || whatsappSettings?.reminderDays || [7, 15, 30, 60]) as number[];
      const maxDays = Math.max(...reminderDays);
      const currentDate = new Date();
      const futureDate = new Date();
      futureDate.setDate(currentDate.getDate() + maxDays);

      console.log(`📅 Checking for events between ${currentDate.toLocaleDateString()} and ${futureDate.toLocaleDateString()}`);

      const events: UpcomingEvent[] = [];

      const [vessels, crewMembers, contracts, documents, crewRotations] = await Promise.all([
        storage.getVessels(),
        storage.getCrewMembers(),
        storage.getContracts(),
        storage.getDocuments(),
        storage.getCrewRotations()
      ]);

      // Contract renewals/expirations
      contracts.forEach(contract => {
        if (contract.status === 'active' && contract.endDate >= currentDate && contract.endDate <= futureDate) {
          const crewMember = crewMembers.find(c => c.id === contract.crewMemberId);
          const vessel = vessels.find(v => v.id === contract.vesselId);

          const daysUntil = Math.ceil((contract.endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
          let severity: 'success' | 'info' | 'warning' | 'high' = 'info';

          if (daysUntil <= 3) severity = 'high';
          else if (daysUntil <= 7) severity = 'warning';

          events.push({
            id: `contract-${contract.id}`,
            type: 'contract_expiry',
            title: `Contract Renewal Required`,
            description: `Contract for ${crewMember?.firstName} ${crewMember?.lastName} on vessel ${vessel?.name} expires soon`,
            date: contract.endDate,
            severity,
            crewMemberId: contract.crewMemberId,
            vesselId: contract.vesselId,
            contractId: contract.id,
            crewMemberName: crewMember ? `${crewMember.firstName} ${crewMember.lastName}` : undefined,
            vesselName: vessel?.name,
          });
        }
      });

      // Document expirations (with special handling for CDC documents)
      documents.forEach(document => {
        if (document.expiryDate >= currentDate && document.expiryDate <= futureDate) {
          const crewMember = crewMembers.find(c => c.id === document.crewMemberId);

          // Find the crew member's current vessel via active contract
          const activeContract = contracts.find(c => c.crewMemberId === document.crewMemberId && c.status === 'active');
          const vessel = activeContract ? vessels.find(v => v.id === activeContract.vesselId) : undefined;

          const daysUntil = Math.ceil((document.expiryDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

          // For CDC, Passport, COC, and Medical documents, use specific severity based on document reminder days
          const docType = document.type.toLowerCase();
          const isCDC = docType === 'cdc';
          const isPassport = docType === 'passport';
          const isCOC = docType === 'coc';
          const isMedical = docType === 'medical' || docType === 'medical certificate' || docType.includes('medical');
          let severity: 'success' | 'info' | 'warning' | 'high' = 'info';

          if (isCDC || isPassport || isCOC || isMedical) {
            // Document-specific severity: 10 days = high, 30 days = warning, 45/60 = info
            if (daysUntil <= 10) severity = 'high';
            else if (daysUntil <= 30) severity = 'warning';
          } else {
            // Standard severity for other documents
            if (daysUntil <= 3) severity = 'high';
            else if (daysUntil <= 7) severity = 'warning';
          }

          events.push({
            id: `document-${document.id}`,
            type: 'document_expiry',
            title: isCDC ? 'CDC Renewal Required' : 'Document Renewal Required',
            description: `${document.type.toUpperCase()} (${document.documentNumber}) for ${crewMember?.firstName} ${crewMember?.lastName} expires soon`,
            date: document.expiryDate,
            severity,
            crewMemberId: document.crewMemberId,
            documentId: document.id,
            documentType: document.type,
            documentNumber: document.documentNumber,
            issuingAuthority: document.issuingAuthority,
            crewMemberName: crewMember ? `${crewMember.firstName} ${crewMember.lastName}` : undefined,
            crewMemberRank: crewMember?.rank,
            crewMemberNationality: crewMember?.nationality,
            vesselName: vessel?.name,
          });
        }
      });

      // Crew rotations
      crewRotations.forEach(rotation => {
        if (rotation.joinDate && rotation.joinDate >= currentDate && rotation.joinDate <= futureDate) {
          const crewMember = crewMembers.find(c => c.id === rotation.crewMemberId);
          const vessel = vessels.find(v => v.id === rotation.vesselId);

          events.push({
            id: `rotation-join-${rotation.id}`,
            type: 'crew_join',
            title: `Crew Join Scheduled`,
            description: `${crewMember?.firstName} ${crewMember?.lastName} scheduled to join ${vessel?.name}`,
            date: rotation.joinDate,
            severity: 'info',
            crewMemberId: rotation.crewMemberId,
            vesselId: rotation.vesselId,
            rotationId: rotation.id,
            crewMemberName: crewMember ? `${crewMember.firstName} ${crewMember.lastName}` : undefined,
            vesselName: vessel?.name,
          });
        }

        if (rotation.leaveDate && rotation.leaveDate >= currentDate && rotation.leaveDate <= futureDate) {
          const crewMember = crewMembers.find(c => c.id === rotation.crewMemberId);
          const vessel = vessels.find(v => v.id === rotation.vesselId);

          events.push({
            id: `rotation-leave-${rotation.id}`,
            type: 'crew_leave',
            title: `Crew Leave Scheduled`,
            description: `${crewMember?.firstName} ${crewMember?.lastName} scheduled to leave ${vessel?.name}`,
            date: rotation.leaveDate,
            severity: 'warning',
            crewMemberId: rotation.crewMemberId,
            vesselId: rotation.vesselId,
            rotationId: rotation.id,
            crewMemberName: crewMember ? `${crewMember.firstName} ${crewMember.lastName}` : undefined,
            vesselName: vessel?.name,
          });
        }
      });

      // Sort events by date
      events.sort((a, b) => a.date.getTime() - b.date.getTime());
      eventsProcessed = events.length;

      console.log(`📋 Found ${eventsProcessed} upcoming events to process`);

      // Track notification results during sending
      const originalSendMethod = this.sendEventNotifications.bind(this);

      // Send notifications and track results
      if (eventsProcessed > 0) {
        await this.sendEventNotifications(events);

        // We don't have direct access to the individual results here, 
        // but we can check the logs for success/failure patterns
        console.log(`📤 Processed ${eventsProcessed} events for notifications`);
      } else {
        console.log('✅ No upcoming events found requiring notifications');
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Log final statistics
      console.log(`📊 Notification check completed in ${processingTime}ms:`, {
        eventsProcessed,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.error(`❌ Error during notification check (${processingTime}ms):`, error);

      // Log the error to notification history for monitoring
      try {
        await storage.logNotification({
          eventId: 'system-check',
          eventType: 'system_error',
          eventDate: new Date(),
          notificationDate: new Date(),
          daysBeforeEvent: 0,
          provider: 'system',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error during event check',
          retryCount: 0,
          metadata: {
            action: 'check_upcoming_events',
            processingTimeMs: processingTime,
            eventsProcessed,
            error: error instanceof Error ? error.stack : String(error),
          }
        });
      } catch (logError) {
        console.error('❌ Failed to log system error:', logError);
      }

      // Re-throw the error so background scheduler can handle it appropriately
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
