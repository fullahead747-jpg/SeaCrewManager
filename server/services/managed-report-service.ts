import { storage } from '../storage';
import { smtpEmailService } from './smtp-email-service';
import { pdfGeneratorService } from './pdf-generator';
import { format } from 'date-fns';
import { generateFleetPDFBuffer } from '../utils/vessel-pdf-generator';

export class ManagedReportService {
  async generateAndSendReports(): Promise<{ success: boolean; sent: string[]; error?: string }> {
    try {
      const now = new Date();
      const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const fortyFiveDaysFromNow = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

      const allCrew = await storage.getCrewMembers();

      const categories = {
        overdue: [] as any[],
        critical: [] as any[],
        upcoming: [] as any[],
        attention: [] as any[]
      };

      for (const member of allCrew) {
        const contract = member.activeContract;
        const vesselName = member.currentVessel?.name || 'Unassigned';

        const rowData = {
          name: `${member.firstName} ${member.lastName}`,
          rank: member.rank || '---',
          vessel: vesselName,
          joiningDate: contract?.startDate ? format(new Date(contract.startDate), 'dd-MMM-yyyy') : '---',
          expiryDate: contract?.endDate ? format(new Date(contract.endDate), 'dd-MMM-yyyy') : '---',
          daysRemaining: contract?.endDate ? Math.ceil((new Date(contract.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
        };

        if (!contract) {
          categories.attention.push(rowData);
          continue;
        }

        const endDate = new Date(contract.endDate);

        if (endDate < now) {
          categories.overdue.push(rowData);
        } else if (endDate <= fifteenDaysFromNow) {
          categories.critical.push(rowData);
        } else if (endDate <= thirtyDaysFromNow) {
          categories.upcoming.push(rowData);
        } else if (endDate <= fortyFiveDaysFromNow) {
          categories.attention.push(rowData);
        }
      }

      const results = {
        success: true,
        sent: [] as string[]
      };

      await storage.logActivity({
        type: 'System',
        entityType: 'System',
        action: 'execute',
        description: 'Generating automated managed reports...',
        username: 'system',
        userRole: 'admin',
        severity: 'info'
      });

      const settings = await storage.getEmailSettings();
      const recipientEmail = settings?.recipientEmail || process.env.REPORT_RECIPIENT_EMAIL || process.env.GMAIL_USER || 'management@fullahead.in';

      // Generate Consolidated PDF for all flagged categories
      const allFlaggedEvents = [
        ...categories.overdue.map(c => ({ ...c, status: 'overdue' })),
        ...categories.critical.map(c => ({ ...c, status: 'critical' })),
        ...categories.upcoming.map(c => ({ ...c, status: 'upcoming' })),
        ...categories.attention.map(c => ({ ...c, status: 'attention' }))
      ].map(item => ({
        id: Math.random().toString(36).substr(2, 9),
        status: item.status as any,
        date: new Date(item.expiryDate),
        crewMemberId: '', // IDs not strictly needed for PDF generation table
        crewMemberName: item.name,
        vesselId: '',
        vesselName: item.vessel,
        contractId: '',
        contractEndDate: new Date(item.expiryDate),
        daysUntilExpiry: item.daysRemaining || 0
      }));

      let pdfBuffer: Buffer | null = null;
      if (allFlaggedEvents.length > 0) {
        try {
          pdfBuffer = await pdfGeneratorService.generateCalendarPDF(
            format(now, 'MMMM yyyy'),
            allFlaggedEvents
          );
          console.log(`✅ Consolidated PDF generated for managed report (${pdfBuffer.length} bytes)`);
        } catch (pdfError) {
          console.error('❌ Failed to generate consolidated PDF:', pdfError);
        }
      }

      // Send Overdue Report
      if (categories.overdue.length > 0 && (settings?.overdueEnabled ?? true)) {
        await this.sendCategoryEmail(recipientEmail, 'Overdue', '#dc2626', categories.overdue, pdfBuffer);
        results.sent.push('Overdue');

        await storage.logActivity({
          type: 'Notification',
          entityType: 'Notification',
          action: 'send',
          description: `Overdue Crew Report sent to ${recipientEmail} (${categories.overdue.length} members)`,
          username: 'system',
          userRole: 'admin',
          severity: 'info'
        });

        await storage.logNotification({
          eventId: 'managed-report-overdue',
          eventType: 'managed_report',
          eventDate: now,
          notificationDate: now,
          daysBeforeEvent: 0,
          provider: 'email',
          success: true,
          metadata: { category: 'Overdue', count: categories.overdue.length, recipient: recipientEmail }
        });
      }

      // Send Critical Report
      if (categories.critical.length > 0 && (settings?.criticalEnabled ?? true)) {
        await this.sendCategoryEmail(recipientEmail, 'Critical', '#ef4444', categories.critical, pdfBuffer);
        results.sent.push('Critical');

        await storage.logActivity({
          type: 'Notification',
          entityType: 'Notification',
          action: 'send',
          description: `Critical Crew Report sent to ${recipientEmail} (${categories.critical.length} members)`,
          username: 'system',
          userRole: 'admin',
          severity: 'info'
        });

        await storage.logNotification({
          eventId: 'managed-report-critical',
          eventType: 'managed_report',
          eventDate: now,
          notificationDate: now,
          daysBeforeEvent: 0,
          provider: 'email',
          success: true,
          metadata: { category: 'Critical', count: categories.critical.length, recipient: recipientEmail }
        });
      }

      // Send Upcoming Report
      if (categories.upcoming.length > 0 && (settings?.upcomingEnabled ?? true)) {
        await this.sendCategoryEmail(recipientEmail, 'Upcoming', '#f97316', categories.upcoming, pdfBuffer);
        results.sent.push('Upcoming');

        await storage.logActivity({
          type: 'Notification',
          entityType: 'Notification',
          action: 'send',
          description: `Upcoming Crew Report sent to ${recipientEmail} (${categories.upcoming.length} members)`,
          username: 'system',
          userRole: 'admin',
          severity: 'info'
        });

        await storage.logNotification({
          eventId: 'managed-report-upcoming',
          eventType: 'managed_report',
          eventDate: now,
          notificationDate: now,
          daysBeforeEvent: 0,
          provider: 'email',
          success: true,
          metadata: { category: 'Upcoming', count: categories.upcoming.length, recipient: recipientEmail }
        });
      }

      // Send Attention Report
      if (categories.attention.length > 0 && (settings?.attentionEnabled ?? true)) {
        await this.sendCategoryEmail(recipientEmail, 'Attention', '#eab308', categories.attention, pdfBuffer);
        results.sent.push('Attention');

        await storage.logActivity({
          type: 'Notification',
          entityType: 'Notification',
          action: 'send',
          description: `Attention Crew Report sent to ${recipientEmail} (${categories.attention.length} members)`,
          username: 'system',
          userRole: 'admin',
          severity: 'info'
        });

        await storage.logNotification({
          eventId: 'managed-report-attention',
          eventType: 'managed_report',
          eventDate: now,
          notificationDate: now,
          daysBeforeEvent: 0,
          provider: 'email',
          success: true,
          metadata: { category: 'Attention', count: categories.attention.length, recipient: recipientEmail }
        });
      }

      if (results.sent.length === 0) {
        await storage.logActivity({
          type: 'System',
          entityType: 'System',
          action: 'execute',
          description: 'Managed reports processed: No reports needed (no matches or disabled).',
          username: 'system',
          userRole: 'admin',
          severity: 'info'
        });
      }

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error generating managed reports:', error);

      await storage.logActivity({
        type: 'System',
        entityType: 'System',
        action: 'error',
        description: `Failed to generate managed reports: ${errorMessage}`,
        username: 'system',
        userRole: 'admin',
        severity: 'error'
      });

      return { success: false, sent: [], error: errorMessage };
    }
  }

  async sendConsolidatedFullReport(): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date();
      const settings = await storage.getEmailSettings();
      const recipientEmail = settings?.recipientEmail || process.env.REPORT_RECIPIENT_EMAIL || process.env.GMAIL_USER || 'management@fullahead.in';

      console.log(`📊 Generating "Complete Fleet Report" PDF...`);
      const { buffer: pdfBuffer, fileName } = await generateFleetPDFBuffer(storage);

      if (!pdfBuffer || pdfBuffer.length === 0) {
        console.error('❌ Failed to generate Fleet Report PDF');
        return { success: false, error: 'PDF generation failed' };
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; line-height: 1.5; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1e3a5f; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background-color: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">Complete Fleet Report</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Crew Management System - Automated Consolidated Report</p>
            </div>
            <div class="content">
              <p>Please find attached the <strong>Complete Fleet Report</strong> as requested.</p>
              <p>This report contains a comprehensive overview of the entire fleet, including vessel-wise crew lists and active crew status as of today.</p>
              <div style="margin-top: 30px; text-align: center;">
                <a href="${process.env.APP_URL || ''}/dashboard" 
                   style="background-color: #1e293b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Access Fleet Dashboard
                </a>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated report generated on ${format(new Date(), 'dd MMMM yyyy HH:mm')}</p>
              <p>&copy; ${new Date().getFullYear()} Crew Management Pro. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await smtpEmailService.sendEmailWithAttachment({
        to: recipientEmail,
        subject: `📋 Full DOWNLOAD - Export PDF: Complete Fleet Report - ${format(now, 'dd MMM yyyy')}`,
        html,
        attachments: [{
          filename: `Complete-Fleet-Report-${format(now, 'dd-MMM-yyyy')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });

      await storage.logActivity({
        type: 'Notification',
        entityType: 'Notification',
        action: 'send',
        description: `Complete Fleet Report PDF sent to ${recipientEmail}`,
        username: 'system',
        userRole: 'admin',
        severity: 'info'
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error sending consolidated report:', error);
      return { success: false, error: errorMessage };
    }
  }

  private async sendCategoryEmail(to: string, category: string, color: string, data: any[], attachment?: Buffer | null) {

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; line-height: 1.5; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background-color: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
          th { background-color: #f8fafc; color: #64748b; text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em; }
          td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
          tr:hover { background-color: #f8fafc; }
          .footer { text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px; }
          .badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
          .badge-critical { background-color: #fee2e2; color: #ef4444; }
          .badge-upcoming { background-color: #ffedd5; color: #f97316; }
          .badge-attention { background-color: #fef9c3; color: #eab308; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">${category} Crew Report</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Crew Management System - Automated Notification</p>
          </div>
          <div class="content">
            <p>The following crew members fall under the <strong>${category}</strong> category based on their contract status.</p>
            <table>
              <thead>
                <tr>
                  <th>Crew Member</th>
                  <th>Rank</th>
                  <th>Vessel</th>
                  <th>Joining Date</th>
                  <th>Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                ${data.map(item => `
                  <tr>
                    <td style="font-weight: 600; color: #1e293b;">${item.name}</td>
                    <td>${item.rank}</td>
                    <td>${item.vessel}</td>
                    <td>${item.joiningDate}</td>
                    <td style="color: ${color}; font-weight: 600;">${item.expiryDate}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div style="margin-top: 30px; text-align: center;">
              <a href="${process.env.APP_URL ? (process.env.APP_URL.endsWith('/') ? process.env.APP_URL.slice(0, -1) : process.env.APP_URL) : ''}/dashboard" 
                 style="background-color: #1e293b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Access Fleet Dashboard
              </a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated report generated on ${format(new Date(), 'dd MMMM yyyy HH:mm')}</p>
            <p>&copy; ${new Date().getFullYear()} Crew Management Pro. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (attachment) {
      await smtpEmailService.sendEmailWithAttachment({
        to,
        subject: `🚨 ${category} Crew Report - ${format(new Date(), 'dd MMM yyyy')}`,
        html,
        attachments: [{
          filename: `Crew-Status-Report-${format(new Date(), 'dd-MMM-yyyy')}.pdf`,
          content: attachment,
          contentType: 'application/pdf'
        }]
      });
    } else {
      await smtpEmailService.sendEmail({
        to,
        subject: `🚨 ${category} Crew Report - ${format(new Date(), 'dd MMM yyyy')}`,
        html
      });
    }
  }
}

export const managedReportService = new ManagedReportService();
