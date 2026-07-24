import { storage } from '../storage';
import { smtpEmailService } from './smtp-email-service';
import { db } from '../db';
import { dailyComplianceTransitions, contracts, crewMembers, vessels, type CrewMember, type Vessel, type Contract } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export type ComplianceCategory = 'overdue' | 'critical' | 'upcoming' | 'attention' | 'notDue';

export interface TransitionRecord {
  id: string;
  crewMemberId: string;
  crewName: string;
  crewRank: string;
  vesselName: string;
  previousCategory: ComplianceCategory;
  newCategory: ComplianceCategory;
  endDate: Date | null;
  daysRemaining: number | null;
}

export class ComplianceDigestService {
  private static instance: ComplianceDigestService;

  private constructor() {}

  public static getInstance(): ComplianceDigestService {
    if (!ComplianceDigestService.instance) {
      ComplianceDigestService.instance = new ComplianceDigestService();
    }
    return ComplianceDigestService.instance;
  }

  /**
   * Compute compliance health category based on contract end date
   */
  public calculateCategory(endDateStr: Date | string | null): ComplianceCategory {
    if (!endDateStr) return 'overdue';
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const endDate = new Date(endDateStr);
    endDate.setHours(0, 0, 0, 0);

    const diffInMs = endDate.getTime() - now.getTime();
    const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays < 0) return 'overdue';
    if (diffInDays <= 15) return 'critical';
    if (diffInDays <= 30) return 'upcoming';
    if (diffInDays <= 45) return 'attention';
    return 'notDue';
  }

  /**
   * Category display helper
   */
  public getCategoryLabel(category: ComplianceCategory): string {
    const labels: Record<ComplianceCategory, string> = {
      overdue: 'Overdue (Expired / No Contract)',
      critical: 'Critical (≤ 15 Days Left)',
      upcoming: 'Upcoming (16 - 30 Days Left)',
      attention: 'Attention (31 - 45 Days Left)',
      notDue: 'Not Due (> 45 Days Left)',
    };
    return labels[category] || category;
  }

  /**
   * Run baseline initialization on deployment (stamps lastHealthCategory on contracts if null)
   */
  public async initializeBaselineToday(): Promise<void> {
    try {
      const allContracts = await storage.getContracts();
      const activeContracts = allContracts.filter(c => c.status === 'active');

      let updatedCount = 0;
      for (const contract of activeContracts) {
        if (!contract.lastHealthCategory) {
          const category = this.calculateCategory(contract.endDate);
          await storage.updateContract(contract.id, { lastHealthCategory: category });
          updatedCount++;
        }
      }
      console.log(`✅ Compliance baseline initialized today. Updated ${updatedCount} contract baseline categories.`);
    } catch (err) {
      console.error('❌ Failed to initialize compliance baseline:', err);
    }
  }

  /**
   * 12:00 AM Midnight Job: Evaluate current status against stored lastHealthCategory
   * Records changes to daily_compliance_transitions table
   */
  public async evaluateMidnightTransitions(dateStr: string): Promise<number> {
    console.log(`🌙 [12:00 AM Midnight Update] Evaluating compliance status transitions for date: ${dateStr}...`);

    try {
      const [allCrew, allContracts, allVessels] = await Promise.all([
        storage.getCrewMembers(),
        storage.getContracts(),
        storage.getVessels(),
      ]);

      const vesselMap = new Map(allVessels.map(v => [v.id, v]));

      // Latest active contract per crew member
      const activeContractMap = new Map<string, Contract>();
      allContracts
        .filter(c => c.status === 'active')
        .sort((a, b) => (new Date(a.createdAt || 0).getTime()) - (new Date(b.createdAt || 0).getTime()))
        .forEach(c => activeContractMap.set(c.crewMemberId, c));

      // On-board crew members
      const onBoardCrew = allCrew.filter(c => c.status === 'onBoard');
      let transitionCount = 0;

      for (const crew of onBoardCrew) {
        const contract = activeContractMap.get(crew.id);
        const vessel = vesselMap.get(crew.currentVesselId || '');

        const currentCategory = this.calculateCategory(contract?.endDate || null);
        const previousCategory = (contract?.lastHealthCategory as ComplianceCategory) || 'notDue';

        // Detect transition
        if (currentCategory !== previousCategory) {
          console.log(`🔄 Compliance status change detected for ${crew.firstName} ${crew.lastName}: ${previousCategory} -> ${currentCategory}`);

          // Record transition in DB
          await db.insert(dailyComplianceTransitions).values({
            crewMemberId: crew.id,
            contractId: contract?.id || null,
            vesselId: vessel?.id || null,
            previousCategory,
            newCategory: currentCategory,
            transitionDate: dateStr,
          });

          // Update stored lastHealthCategory on active contract
          if (contract) {
            await storage.updateContract(contract.id, { lastHealthCategory: currentCategory });
          }

          transitionCount++;
        }
      }

      console.log(`✅ [12:00 AM Midnight Update] Finished transition evaluation. Logged ${transitionCount} status changes for ${dateStr}.`);
      return transitionCount;
    } catch (err) {
      console.error('❌ Error evaluating midnight compliance transitions:', err);
      return 0;
    }
  }

  /**
   * 10:00 AM Morning Job: Send ONE consolidated digest email containing all status changes
   * Grouped by new category. Skipped if no changes.
   */
  public async sendDailyDigestEmail(dateStr: string): Promise<boolean> {
    console.log(`☀️ [10:00 AM Morning Check] Checking daily compliance email digest for date: ${dateStr}...`);

    try {
      // 1. DO NOT START TODAY (July 22). Start from tomorrow (July 23, 2026).
      if (dateStr < '2026-07-23') {
        console.log(`ℹ️ Scheduled daily compliance email is set to start tomorrow (2026-07-23). Today (${dateStr}) skipped per configuration.`);
        return false;
      }

      // 2. Check if digest email already sent today
      const alreadySent = await storage.hasNotificationBeenSentToday(
        'daily-compliance-digest',
        'managed_report',
        'email',
        dateStr
      );

      if (alreadySent) {
        console.log(`ℹ️ Daily compliance digest email has already been sent for date: ${dateStr}`);
        return false;
      }

      // 3. Query transitions for today's date
      const rawTransitions = await db
        .select()
        .from(dailyComplianceTransitions)
        .where(eq(dailyComplianceTransitions.transitionDate, dateStr));

      if (!rawTransitions || rawTransitions.length === 0) {
        console.log(`ℹ️ No crew compliance status changes recorded for ${dateStr}. No email will be sent.`);
        return false;
      }

      // 4. Enrich transition records with crew, contract, vessel details
      const [allCrew, allContracts, allVessels] = await Promise.all([
        storage.getCrewMembers(),
        storage.getContracts(),
        storage.getVessels(),
      ]);

      const crewMap = new Map(allCrew.map(c => [c.id, c]));
      const vesselMap = new Map(allVessels.map(v => [v.id, v]));
      const contractMap = new Map(allContracts.map(c => [c.id, c]));

      const enrichedRecords: TransitionRecord[] = [];
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      for (const t of rawTransitions) {
        const crew = crewMap.get(t.crewMemberId);
        if (!crew) continue;

        const vessel = t.vesselId ? vesselMap.get(t.vesselId) : (crew.currentVesselId ? vesselMap.get(crew.currentVesselId) : undefined);
        const contract = t.contractId ? contractMap.get(t.contractId) : undefined;

        const endDate = contract?.endDate ? new Date(contract.endDate) : null;
        let daysRemaining: number | null = null;

        if (endDate) {
          endDate.setHours(0, 0, 0, 0);
          daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }

        enrichedRecords.push({
          id: t.id,
          crewMemberId: crew.id,
          crewName: `${crew.firstName} ${crew.lastName}`,
          crewRank: crew.rank || '—',
          vesselName: vessel?.name || 'Unassigned',
          previousCategory: t.previousCategory as ComplianceCategory,
          newCategory: t.newCategory as ComplianceCategory,
          endDate,
          daysRemaining,
        });
      }

      if (enrichedRecords.length === 0) {
        console.log(`ℹ️ No active crew transitions found for ${dateStr}. Email skipped.`);
        return false;
      }

      // 5. Group transitions by NEW compliance category
      const categoriesOrder: ComplianceCategory[] = ['overdue', 'critical', 'upcoming', 'attention', 'notDue'];
      const grouped: Record<ComplianceCategory, TransitionRecord[]> = {
        overdue: [],
        critical: [],
        upcoming: [],
        attention: [],
        notDue: [],
      };

      enrichedRecords.forEach(rec => {
        if (grouped[rec.newCategory]) {
          grouped[rec.newCategory].push(rec);
        }
      });

      // 6. Build sleek consolidated HTML email template
      const htmlBody = this.generateConsolidatedEmailHTML(grouped, dateStr, enrichedRecords.length);

      // 7. Get recipient email settings
      const settings = await storage.getEmailSettings();
      const recipientEmail = settings?.recipientEmail || 'admin@offing.biz, management@fullahead.in';

      const subject = `🔔 Daily Crew Compliance Digest: ${enrichedRecords.length} Status Change(s) (${dateStr})`;

      // 8. Dispatch email
      console.log(`📧 Sending daily compliance digest email for ${dateStr} to ${recipientEmail}...`);
      await smtpEmailService.sendEmail({
        to: recipientEmail,
        subject,
        html: htmlBody,
      });

      // 9. Log notification sent in database to enforce idempotency
      await storage.logNotification({
        eventId: 'daily-compliance-digest',
        eventType: 'managed_report',
        eventDate: new Date(),
        notificationDate: new Date(),
        daysBeforeEvent: 0,
        provider: 'email',
        success: true,
        metadata: {
          dateStr,
          totalChanges: enrichedRecords.length,
          groupedCounts: {
            overdue: grouped.overdue.length,
            critical: grouped.critical.length,
            upcoming: grouped.upcoming.length,
            attention: grouped.attention.length,
            notDue: grouped.notDue.length,
          }
        }
      });

      console.log(`✅ Daily compliance digest email sent successfully for ${dateStr}!`);
      return true;
    } catch (err) {
      console.error(`❌ Error sending daily compliance digest email for ${dateStr}:`, err);
      return false;
    }
  }

  /**
   * Helper to format category header styles
   */
  private getCategoryHeaderBadge(category: ComplianceCategory): { title: string; color: string; bg: string; border: string } {
    switch (category) {
      case 'overdue':
        return { title: '🔴 OVERDUE (Expired / No Active Contract)', color: '#991b1b', bg: '#fef2f2', border: '#fca5a5' };
      case 'critical':
        return { title: '🟠 CRITICAL (≤ 15 Days Left)', color: '#9a3412', bg: '#fff7ed', border: '#fdba74' };
      case 'upcoming':
        return { title: '🟡 UPCOMING (16 - 30 Days Left)', color: '#854d0e', bg: '#fefce8', border: '#fde047' };
      case 'attention':
        return { title: '🔵 ATTENTION (31 - 45 Days Left)', color: '#1e40af', bg: '#eff6ff', border: '#93c5fd' };
      case 'notDue':
        return { title: '🟢 NOT DUE / RENEWED (> 45 Days Left)', color: '#065f46', bg: '#ecfdf5', border: '#6ee7b7' };
    }
  }

  /**
   * Render HTML email document with grouped tables
   */
  private generateConsolidatedEmailHTML(
    grouped: Record<ComplianceCategory, TransitionRecord[]>,
    dateStr: string,
    totalCount: number
  ): string {
    const categoriesOrder: ComplianceCategory[] = ['overdue', 'critical', 'upcoming', 'attention', 'notDue'];

    let sectionsHTML = '';

    for (const cat of categoriesOrder) {
      const records = grouped[cat];
      if (!records || records.length === 0) continue;

      const badge = this.getCategoryHeaderBadge(cat);

      const rowsHTML = records.map(r => {
        const prevLabel = this.getCategoryLabel(r.previousCategory).split(' (')[0];
        const newLabel = this.getCategoryLabel(r.newCategory).split(' (')[0];
        const expiryFormatted = r.endDate ? r.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Contract';
        const daysText = r.daysRemaining !== null ? (r.daysRemaining < 0 ? `(${Math.abs(r.daysRemaining)} days overdue)` : `(${r.daysRemaining} days left)`) : '';

        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-weight: bold; color: #1e293b;">${r.crewName}</td>
            <td style="padding: 10px 12px; color: #475569;">${r.crewRank}</td>
            <td style="padding: 10px 12px; color: #475569;">${r.vesselName}</td>
            <td style="padding: 10px 12px; font-size: 12px; color: #64748b;">
              <span style="text-decoration: line-through;">${prevLabel}</span> → <strong style="color: ${badge.color};">${newLabel}</strong>
            </td>
            <td style="padding: 10px 12px; font-size: 12px; color: #334155;">
              ${expiryFormatted} <span style="color: #64748b; font-size: 11px;">${daysText}</span>
            </td>
          </tr>
        `;
      }).join('');

      sectionsHTML += `
        <div style="margin-bottom: 25px; border: 1px solid ${badge.border}; border-radius: 8px; overflow: hidden;">
          <div style="background-color: ${badge.bg}; color: ${badge.color}; padding: 12px 16px; font-weight: bold; font-size: 14px; border-bottom: 1px solid ${badge.border};">
            ${badge.title} (${records.length})
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; background: white;">
            <thead>
              <tr style="background-color: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 8px 12px;">Crew Member</th>
                <th style="padding: 8px 12px;">Rank</th>
                <th style="padding: 8px 12px;">Vessel</th>
                <th style="padding: 8px 12px;">Status Change</th>
                <th style="padding: 8px 12px;">Contract Expiry</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
          .container { max-width: 720px; margin: 0 auto; background: white; border-radius: 12px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 24px; }
          .title { color: #1e3a8a; font-size: 22px; margin: 0; font-weight: bold; }
          .subtitle { color: #64748b; font-size: 13px; margin-top: 6px; }
          .badge-count { background: #dbeafe; color: #1e40af; font-size: 12px; font-weight: bold; padding: 4px 12px; border-radius: 9999px; display: inline-block; margin-top: 8px; }
          .footer { text-align: center; margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">📋 Daily Crew Compliance Digest</h1>
            <div class="subtitle">SeaCrewManager Compliance Status Update — ${dateStr}</div>
            <div class="badge-count">${totalCount} Crew Member Status Change(s) Detected</div>
          </div>

          <p style="font-size: 13px; color: #475569; margin-bottom: 20px; line-height: 1.5;">
            The following crew members experienced a <strong>Compliance Status category change</strong> following the midnight system update. Crew members whose status remained unchanged are not listed.
          </p>

          ${sectionsHTML}

          <div class="footer">
            Automated notification generated by <strong>SeaCrewManager</strong>. Log in to the management dashboard to view detailed crew documentation.
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const complianceDigestService = ComplianceDigestService.getInstance();
