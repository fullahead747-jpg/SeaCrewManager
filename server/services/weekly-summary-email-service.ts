import { storage } from '../storage';
import { SMTPEmailService } from './smtp-email-service';
import { pdfGeneratorService } from './pdf-generator';

interface ExpiringItem {
    id: string;
    type: 'contract' | 'document';
    crewMemberName: string;
    crewMemberRank?: string;
    vesselName?: string;
    documentType?: string;
    documentNumber?: string;
    expiryDate: Date;
    daysUntilExpiry: number;
    severity: 'critical' | 'warning' | 'due_soon' | 'upcoming';
}

export class WeeklySummaryEmailService {
    private smtpService: SMTPEmailService;

    constructor() {
        this.smtpService = new SMTPEmailService();
    }

    /**
     * Generate and send weekly summary email
     */
    async sendWeeklySummary(recipientEmail: string): Promise<boolean> {
        try {
            if (!this.smtpService.isReady()) {
                console.log('⚠️ SMTP service not ready - cannot send weekly summary');
                return false;
            }

            console.log('📧 Generating weekly summary email...');

            // Get all expiring items for the next 60 days
            const items = await this.getExpiringItems(60);

            // Group items by severity
            const grouped = this.groupItemsBySeverity(items);

            // Generate week range
            const now = new Date();
            const weekEnd = new Date(now);
            weekEnd.setDate(now.getDate() + 6);
            const weekRange = `${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

            // Generate HTML email
            const html = this.generateEmailHTML(weekRange, grouped, items.length);

            // Generate PDF attachment
            let pdfBuffer: Buffer | null = null;
            try {
                pdfBuffer = await this.generateWeeklySummaryPDF(weekRange, items);
                console.log(`📄 PDF generated successfully (${pdfBuffer.length} bytes)`);
            } catch (pdfError) {
                console.error('⚠️ Failed to generate PDF, sending email without attachment:', pdfError);
            }

            // Send email
            if (pdfBuffer) {
                await this.smtpService.sendEmailWithAttachment({
                    to: recipientEmail,
                    subject: `📅 Weekly Crew Management Summary - ${weekRange}`,
                    html,
                    attachments: [{
                        filename: `Weekly-Summary-${now.toISOString().split('T')[0]}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                    }],
                });
            } else {
                await this.smtpService.sendEmail({
                    to: recipientEmail,
                    subject: `📅 Weekly Crew Management Summary - ${weekRange}`,
                    html,
                });
            }

            console.log(`✅ Weekly summary email sent to ${recipientEmail}`);
            return true;

        } catch (error) {
            console.error('❌ Failed to send weekly summary email:', error);
            return false;
        }
    }

    /**
     * Get all contracts and documents expiring within specified days
     */
    private async getExpiringItems(days: number): Promise<ExpiringItem[]> {
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(now.getDate() + days);

        const items: ExpiringItem[] = [];

        // Get contracts
        const contracts = await storage.getContracts();
        const crewMembers = await storage.getCrewMembers();
        const vessels = await storage.getVessels();

        // Create lookup maps
        const crewMap = new Map(crewMembers.map(c => [c.id, c]));
        const vesselMap = new Map(vessels.map(v => [v.id, v]));

        // Add active contracts
        for (const contract of contracts) {
            if (contract.status === 'active' && contract.endDate >= now && contract.endDate <= futureDate) {
                const crew = crewMap.get(contract.crewMemberId);
                const vessel = vesselMap.get(contract.vesselId);
                const daysUntilExpiry = Math.ceil((contract.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                items.push({
                    id: contract.id,
                    type: 'contract',
                    crewMemberName: crew ? `${crew.firstName} ${crew.lastName}` : 'Unknown',
                    crewMemberRank: crew?.rank,
                    vesselName: vessel?.name,
                    expiryDate: contract.endDate,
                    daysUntilExpiry,
                    severity: this.calculateSeverity(daysUntilExpiry),
                });
            }
        }

        // Add documents
        const documents = await storage.getDocuments();
        for (const document of documents) {
            if (document.expiryDate >= now && document.expiryDate <= futureDate) {
                const crew = crewMap.get(document.crewMemberId);
                const activeContract = contracts.find(c => c.crewMemberId === document.crewMemberId && c.status === 'active');
                const vessel = activeContract ? vesselMap.get(activeContract.vesselId) : undefined;
                const daysUntilExpiry = Math.ceil((document.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                items.push({
                    id: document.id,
                    type: 'document',
                    crewMemberName: crew ? `${crew.firstName} ${crew.lastName}` : 'Unknown',
                    crewMemberRank: crew?.rank,
                    vesselName: vessel?.name,
                    documentType: document.type,
                    documentNumber: document.documentNumber,
                    expiryDate: document.expiryDate,
                    daysUntilExpiry,
                    severity: this.calculateSeverity(daysUntilExpiry),
                });
            }
        }

        // Sort by days until expiry
        items.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

        return items;
    }

    /**
     * Calculate severity based on days until expiry
     */
    private calculateSeverity(days: number): 'critical' | 'warning' | 'due_soon' | 'upcoming' {
        if (days <= 7) return 'critical';
        if (days <= 15) return 'warning';
        if (days <= 30) return 'due_soon';
        return 'upcoming';
    }

    /**
     * Group items by severity
     */
    private groupItemsBySeverity(items: ExpiringItem[]) {
        return {
            critical: items.filter(i => i.severity === 'critical'),
            warning: items.filter(i => i.severity === 'warning'),
            dueSoon: items.filter(i => i.severity === 'due_soon'),
            upcoming: items.filter(i => i.severity === 'upcoming'),
        };
    }

    /**
     * Generate HTML email content
     */
    private generateEmailHTML(weekRange: string, grouped: any, totalItems: number): string {
        const formatItemRow = (item: ExpiringItem, bgColor: string, textColor: string) => {
            const dateStr = item.expiryDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            const itemType = item.type === 'contract' ? 'Contract' : item.documentType?.toUpperCase() || 'Document';

            return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; font-weight: 500;">${item.crewMemberName}</td>
          <td style="padding: 12px;">${item.crewMemberRank || '-'}</td>
          <td style="padding: 12px;">${item.vesselName || 'Unassigned'}</td>
          <td style="padding: 12px;">${itemType}</td>
          <td style="padding: 12px;">${dateStr}</td>
          <td style="padding: 12px;">
            <span style="background: ${bgColor}; color: ${textColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">
              ${item.daysUntilExpiry} days
            </span>
          </td>
        </tr>
      `;
        };

        const renderSection = (title: string, items: ExpiringItem[], icon: string, bgColor: string, textColor: string) => {
            if (items.length === 0) return '';

            return `
        <div style="margin-bottom: 30px;">
          <h2 style="color: ${textColor}; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
            ${icon} ${title} (${items.length})
          </h2>
          <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-radius: 8px;">
            <thead>
              <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Crew Member</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Rank</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Vessel</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Type</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Expiry Date</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Days Left</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => formatItemRow(item, bgColor, textColor)).join('')}
            </tbody>
          </table>
        </div>
      `;
        };

        return `
      <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0066cc; padding-bottom: 20px;">
            <h1 style="color: #0066cc; margin: 0; font-size: 28px;">📅 Weekly Crew Management Summary</h1>
            <p style="color: #6c757d; margin: 10px 0 0 0; font-size: 16px;">${weekRange}</p>
            <p style="color: #28a745; margin: 5px 0 0 0; font-size: 12px;">🤖 Automatically sent every Monday at 9:00 AM</p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
            <div style="background: #fee2e2; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #dc2626;">${grouped.critical.length}</div>
              <div style="font-size: 12px; color: #991b1b; margin-top: 5px;">Critical (≤7 days)</div>
            </div>
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #d97706;">${grouped.warning.length}</div>
              <div style="font-size: 12px; color: #92400e; margin-top: 5px;">Warning (8-15 days)</div>
            </div>
            <div style="background: #fed7aa; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #ea580c;">${grouped.dueSoon.length}</div>
              <div style="font-size: 12px; color: #7c2d12; margin-top: 5px;">Due Soon (16-30 days)</div>
            </div>
            <div style="background: #dbeafe; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #2563eb;">${grouped.upcoming.length}</div>
              <div style="font-size: 12px; color: #1e40af; margin-top: 5px;">Upcoming (31-60 days)</div>
            </div>
          </div>

          ${renderSection('Critical - Immediate Action Required', grouped.critical, '🔴', '#fee2e2', '#dc2626')}
          ${renderSection('Warning - Action Needed Soon', grouped.warning, '🟡', '#fef3c7', '#d97706')}
          ${renderSection('Due Soon - Plan for Renewal', grouped.dueSoon, '🟠', '#fed7aa', '#ea580c')}
          ${renderSection('Upcoming - Awareness & Planning', grouped.upcoming, '🟢', '#dbeafe', '#2563eb')}

          ${totalItems === 0 ? `
          <div style="background: #f0fdf4; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
            <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
            <h3 style="color: #166534; margin: 0 0 10px 0;">No Items Expiring in Next 60 Days</h3>
            <p style="color: #15803d; margin: 0; font-size: 14px;">
              All contracts and documents are current. Great work!
            </p>
          </div>
          ` : ''}

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #6c757d; font-size: 12px; margin: 0;">
              This weekly summary is sent every Monday to provide a comprehensive overview of all upcoming expirations.
              Daily critical alerts (≤7 days) are sent separately for urgent items.
            </p>
          </div>
        </div>
      </div>
    `;
    }

    /**
     * Generate PDF attachment for weekly summary
     */
    private async generateWeeklySummaryPDF(weekRange: string, items: ExpiringItem[]): Promise<Buffer> {
        // Use the existing PDF generator service
        // Convert items to the format expected by the PDF generator
        const events = items.map(item => ({
            id: item.id,
            type: item.type === 'contract' ? 'contract_expired' as const : 'contract_due' as const,
            date: item.expiryDate,
            crewMemberName: item.crewMemberName,
            vesselName: item.vesselName || 'Unassigned',
            contractEndDate: item.expiryDate,
            daysUntilExpiry: item.daysUntilExpiry,
            crewMemberId: '',
            vesselId: '',
            contractId: '',
        }));

        return await pdfGeneratorService.generateCalendarPDF(`Weekly Summary - ${weekRange}`, events);
    }
}

export const weeklySummaryEmailService = new WeeklySummaryEmailService();
