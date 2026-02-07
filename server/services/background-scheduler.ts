import { notificationService } from './notification-service';
import { storage } from '../storage';
import { SMTPEmailService } from './smtp-email-service';
import { pdfGeneratorService } from './pdf-generator';
import { weeklySummaryEmailService } from './weekly-summary-email-service';
import { documentMonitoringService } from './document-monitoring-service';

interface ContractEvent {
  id: string;
  type: 'contract_due' | 'contract_expired';
  date: Date;
  crewMemberId: string;
  crewMemberName: string;
  vesselId: string;
  vesselName: string;
  contractId: string;
  contractEndDate: Date;
  daysUntilExpiry: number;
}

export class BackgroundScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly HOUR_IN_MS = 60 * 60 * 1000; // 1 hour in milliseconds

  constructor() {
    console.log('🕐 Background scheduler initialized');
  }

  /**
   * Start the background scheduler to run every hour
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️  Background scheduler is already running');
      return;
    }

    console.log('🚀 Starting background notification scheduler...');

    // Run immediately on startup
    this.runNotificationCheck().catch(error => {
      console.error('❌ Error in initial notification check:', error);
    });

    // Then schedule to run every hour
    this.intervalId = setInterval(() => {
      this.runNotificationCheck().catch(error => {
        console.error('❌ Error in scheduled notification check:', error);
      });
    }, this.HOUR_IN_MS);

    this.isRunning = true;
    console.log('✅ Background scheduler started - will check for notifications every hour');
  }

  /**
   * Stop the background scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️  Background scheduler is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('🛑 Background scheduler stopped');
  }

  /**
   * Check if the scheduler is currently running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Run the notification check process
   */
  private async runNotificationCheck(): Promise<void> {
    const startTime = Date.now();
    console.log('🔍 Running scheduled notification check...');

    try {
      // Initialize the notification service to pick up any settings changes
      await notificationService.initialize();

      // Check and send notifications for upcoming events
      await notificationService.checkAndNotifyUpcomingEvents();

      // Run specialized document monitoring for onboard crew (Phase 2)
      await documentMonitoringService.monitorOnboardCrewCompliance();

      // Check if weekly summary email should be sent (Mondays at 9 AM)
      await this.checkAndSendWeeklySummaryEmail();

      // Check if monthly calendar email should be sent (1st of month at 9 AM or 6 PM)
      await this.checkAndSendMonthlyCalendarEmail();

      // Check if daily compliance digest should be sent (Phase 2 - 8 AM daily)
      await this.checkAndSendDailyComplianceDigest();

      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`✅ Notification check completed successfully in ${duration}ms`);
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.error(`❌ Notification check failed after ${duration}ms:`, error);

      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      }
    }
  }

  /**
   * Check if it's Monday at 9 AM and send the weekly summary email
   */
  private async checkAndSendWeeklySummaryEmail(): Promise<void> {
    if (process.env.DISABLE_EMAIL_NOTIFICATIONS === 'true') {
      console.log('📧 Email notifications disabled via DISABLE_EMAIL_NOTIFICATIONS flag - skipping weekly summary');
      return;
    }

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentHour = now.getHours();

    if (dayOfWeek !== 1 || currentHour !== 9) {
      return;
    }

    const weekNumber = this.getWeekNumber(now);
    const currentWeekKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-W${String(weekNumber).padStart(2, '0')}`;

    try {
      const settings = await storage.getEmailSettings();
      if (!settings?.enabled || !settings?.recipientEmail) {
        console.log('📧 Email not configured or disabled - skipping weekly summary email');
        return;
      }

      if (settings.lastWeeklySummaryMonth === currentWeekKey) {
        console.log(`📅 Weekly summary already sent for ${currentWeekKey}`);
        return;
      }

      console.log(`📅 Monday morning - sending weekly summary email...`);
      const success = await weeklySummaryEmailService.sendWeeklySummary(settings.recipientEmail);

      if (success) {
        await storage.updateEmailSettings({
          lastWeeklySummaryMonth: currentWeekKey,
          lastWeeklySummarySent: now,
        } as any);
        console.log(`✅ Weekly summary email sent successfully for ${currentWeekKey}`);
      }
    } catch (error) {
      console.error('❌ Failed to send weekly summary email:', error);
    }
  }

  /**
   * Check if it's 8 AM and send the daily compliance digest email
   */
  private async checkAndSendDailyComplianceDigest(): Promise<void> {
    if (process.env.DISABLE_EMAIL_NOTIFICATIONS === 'true') {
      console.log('📧 Email notifications disabled - skipping daily compliance digest');
      return;
    }

    const now = new Date();
    if (now.getHours() !== 8) {
      return;
    }

    const todayStr = now.toISOString().split('T')[0];

    try {
      const alreadySentToday = await storage.hasNotificationBeenSentToday(
        'daily_compliance_digest',
        'system_report',
        'email',
        todayStr
      );

      if (alreadySentToday) {
        return;
      }

      console.log('📊 It is 8 AM - triggering daily compliance digest...');
      await documentMonitoringService.generateDailyComplianceDigest();

      await storage.logNotification({
        eventId: 'daily_compliance_digest',
        eventType: 'system_report',
        eventDate: now,
        notificationDate: now,
        daysBeforeEvent: 0,
        provider: 'email',
        success: true,
        metadata: { date: todayStr }
      });
    } catch (error) {
      console.error('❌ Failed to send daily compliance digest:', error);
    }
  }

  /**
   * Check if it's the 1st of the month at 9 AM or 6 PM and send the monthly calendar summary email
   */
  private async checkAndSendMonthlyCalendarEmail(): Promise<void> {
    if (process.env.DISABLE_EMAIL_NOTIFICATIONS === 'true') {
      console.log('📧 Email notifications disabled - skipping monthly calendar');
      return;
    }

    const now = new Date();
    const dayOfMonth = now.getDate();
    const currentHour = now.getHours();

    if (dayOfMonth !== 1 || (currentHour !== 9 && currentHour !== 18)) {
      return;
    }

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
      const settings = await storage.getEmailSettings();
      if (!settings?.enabled || !settings?.recipientEmail) {
        return;
      }

      const emailType = currentHour === 9 ? 'morning' : 'evening';
      const lastSentTimestamp = emailType === 'morning'
        ? settings.lastMonthlyEmailMorningSent
        : settings.lastMonthlyEmailEveningSent;

      if (lastSentTimestamp && settings.lastMonthlyEmailMonth === currentMonthKey) {
        return;
      }

      console.log(`📅 Sending ${emailType} calendar email...`);
      const monthEvents = await this.generateMonthlyContractEvents();
      const monthStr = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      await this.sendMonthlyCalendarEmail(monthStr, monthEvents, settings.recipientEmail);

      const updateData: any = { lastMonthlyEmailMonth: currentMonthKey };
      if (emailType === 'morning') {
        updateData.lastMonthlyEmailMorningSent = now;
      } else {
        updateData.lastMonthlyEmailEveningSent = now;
      }
      await storage.updateEmailSettings(updateData);
    } catch (error) {
      console.error('❌ Failed to send monthly calendar email:', error);
    }
  }

  private async generateMonthlyContractEvents(): Promise<ContractEvent[]> {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const [contracts, crewMembers, vessels] = await Promise.all([
      storage.getContracts(),
      storage.getCrewMembers(),
      storage.getVessels()
    ]);

    const crewMap = new Map(crewMembers.map(c => [c.id, c]));
    const vesselMap = new Map(vessels.map(v => [v.id, v]));

    const events: ContractEvent[] = [];

    for (const contract of contracts) {
      if (!contract.endDate) continue;

      const endDate = new Date(contract.endDate);
      const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Contract Due date (45 days before end date)
      const dueDate = new Date(endDate);
      dueDate.setDate(dueDate.getDate() - 45);

      const crewMember = crewMap.get(contract.crewMemberId);
      const vessel = contract.vesselId ? vesselMap.get(contract.vesselId) : undefined;
      const crewMemberName = crewMember ? `${crewMember.firstName} ${crewMember.lastName}` : 'Unknown';
      const vesselName = vessel?.name || 'Unassigned';

      if (dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear) {
        events.push({
          id: `${contract.id}-due`,
          type: 'contract_due',
          date: dueDate,
          crewMemberId: contract.crewMemberId,
          crewMemberName,
          vesselId: contract.vesselId || '',
          vesselName,
          contractId: contract.id,
          contractEndDate: endDate,
          daysUntilExpiry,
        });
      }

      if (endDate.getMonth() === currentMonth && endDate.getFullYear() === currentYear) {
        events.push({
          id: `${contract.id}-expired`,
          type: 'contract_expired',
          date: endDate,
          crewMemberId: contract.crewMemberId,
          crewMemberName,
          vesselId: contract.vesselId || '',
          vesselName,
          contractId: contract.id,
          contractEndDate: endDate,
          daysUntilExpiry,
        });
      }
    }

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private async sendMonthlyCalendarEmail(
    month: string,
    events: ContractEvent[],
    recipientEmail: string
  ): Promise<void> {
    const smtpService = new SMTPEmailService();
    if (!smtpService.isReady()) return;

    const dueEvents = events.filter(e => e.type === 'contract_due');
    const expiredEvents = events.filter(e => e.type === 'contract_expired');

    const formatEventRow = (event: ContractEvent, type: string) => {
      const dateStr = event.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      const bgColor = type === 'expired' ? '#fee2e2' : '#fef3c7';
      const textColor = type === 'expired' ? '#dc2626' : '#d97706';

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; font-weight: 500;">${event.crewMemberName}</td>
          <td style="padding: 12px;">${event.vesselName}</td>
          <td style="padding: 12px;">${dateStr}</td>
          <td style="padding: 12px;">
            <span style="background: ${bgColor}; color: ${textColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">
              ${event.daysUntilExpiry} days
            </span>
          </td>
        </tr>`;
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0066cc; padding-bottom: 20px;">
            <h1 style="color: #0066cc; margin: 0; font-size: 24px;">📅 Monthly Contract Calendar Summary</h1>
            <p style="color: #6c757d; margin: 10px 0 0 0;">${month}</p>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 30px;">
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #d97706;">${dueEvents.length}</div>
              <div style="font-size: 12px; color: #92400e;">Contracts Due</div>
            </div>
            <div style="background: #fee2e2; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #dc2626;">${expiredEvents.length}</div>
              <div style="font-size: 12px; color: #991b1b;">Contracts Expiring</div>
            </div>
            <div style="background: #dbeafe; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #2563eb;">${events.length}</div>
              <div style="font-size: 12px; color: #1e40af;">Total Events</div>
            </div>
          </div>
          ${dueEvents.length > 0 ? `
            <h2 style="color: #d97706; margin: 0 0 15px 0; font-size: 16px;">⏰ Contracts Due Soon</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
              <thead>
                <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                  <th style="padding: 12px; text-align: left; font-size: 12px;">Crew Member</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px;">Vessel</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px;">Due Date</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px;">Days Left</th>
                </tr>
              </thead>
              <tbody>${dueEvents.map(e => formatEventRow(e, 'due')).join('')}</tbody>
            </table>` : ''}
          ${expiredEvents.length > 0 ? `
            <h2 style="color: #dc2626; margin: 0 0 15px 0; font-size: 16px;">⚠️ Contracts Expiring</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
              <thead>
                <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                  <th style="padding: 12px; text-align: left; font-size: 12px;">Crew Member</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px;">Vessel</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px;">Expiry Date</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px;">Days Left</th>
                </tr>
              </thead>
              <tbody>${expiredEvents.map(e => formatEventRow(e, 'expired')).join('')}</tbody>
            </table>` : ''}
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6c757d; font-size: 12px;">
            This is an automated monthly report for crew planning.
          </div>
        </div>
      </div>`;

    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await pdfGeneratorService.generateCalendarPDF(month, events);
    } catch (error) {
      console.error('⚠️ Failed to generate PDF:', error);
    }

    if (pdfBuffer) {
      await smtpService.sendEmailWithAttachment({
        to: recipientEmail,
        subject: `📅 Monthly Contract Calendar - ${month}`,
        html,
        attachments: [{
          filename: `Contract-Calendar-${month.replace(/\s+/g, '-')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }],
      });
    } else {
      await smtpService.sendEmail({ to: recipientEmail, subject: `📅 Monthly Contract Calendar - ${month}`, html });
    }
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  async triggerManualCheck(): Promise<void> {
    await this.runNotificationCheck();
  }

  getStatus(): { isRunning: boolean; lastCheck: Date | null; nextCheck: Date | null } {
    return {
      isRunning: this.isRunning,
      lastCheck: this.isRunning ? new Date() : null,
      nextCheck: this.isRunning ? new Date(Date.now() + this.HOUR_IN_MS) : null,
    };
  }
}

export const backgroundScheduler = new BackgroundScheduler();