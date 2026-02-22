import { storage } from '../storage';
import { smtpEmailService } from './smtp-email-service';
import { type Contract, type CrewMember, type Vessel } from '@shared/schema';

export type HealthCategory = 'overdue' | 'critical' | 'upcoming' | 'attention' | 'notDue';

export class ContractHealthAlertService {
    private static instance: ContractHealthAlertService;

    private constructor() { }

    public static getInstance(): ContractHealthAlertService {
        if (!ContractHealthAlertService.instance) {
            ContractHealthAlertService.instance = new ContractHealthAlertService();
        }
        return ContractHealthAlertService.instance;
    }

    /**
     * Calculate health category based on days until expiry
     */
    public getHealthCategory(endDate: Date): HealthCategory {
        const now = new Date();
        // Reset hours to midnight for consistent comparison
        now.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);

        const diffInMs = end.getTime() - now.getTime();
        const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInDays < 0) return 'overdue';
        if (diffInDays <= 15) return 'critical';
        if (diffInDays <= 30) return 'upcoming';
        if (diffInDays <= 45) return 'attention';
        return 'notDue';
    }

    /**
     * Get display name for category
     */
    private getCategoryDisplayName(category: HealthCategory): string {
        const map: Record<HealthCategory, string> = {
            overdue: 'Overdue',
            critical: 'Critical (≤ 15 Days)',
            upcoming: 'Upcoming (16-30 Days)',
            attention: 'Attention (31-45 Days)',
            notDue: 'Not Due (> 45 Days)'
        };
        return map[category];
    }

    /**
     * Check all active contracts for health category transitions
     */
    public async checkTransitions(): Promise<void> {
        console.log('🔍 Checking contract health transitions...');

        try {
            const [contracts, crewMembers, vessels] = await Promise.all([
                storage.getContracts(),
                storage.getCrewMembers(),
                storage.getVessels()
            ]);

            const crewMap = new Map(crewMembers.map(c => [c.id, c]));
            const vesselMap = new Map(vessels.map(v => [v.id, v]));

            const activeContracts = contracts.filter(c => c.status === 'active');
            let alertCount = 0;

            for (const contract of activeContracts) {
                if (!contract.endDate) continue;

                const currentCategory = this.getHealthCategory(contract.endDate);
                const lastCategory = contract.lastHealthCategory as HealthCategory | null;

                // Determine if alert should be sent
                // Alert if: 
                // 1. It's the first time we're tracking (lastCategory is null) AND it's not 'notDue'
                // 2. The category has changed to a more urgent state (moving towards overdue)

                const severityOrder: HealthCategory[] = ['notDue', 'attention', 'upcoming', 'critical', 'overdue'];
                const currentIndex = severityOrder.indexOf(currentCategory);
                const lastIndex = lastCategory ? severityOrder.indexOf(lastCategory) : -1;

                const shouldAlert = lastCategory === null
                    ? currentCategory !== 'notDue'
                    : currentIndex > lastIndex;

                if (shouldAlert) {
                    const crew = crewMap.get(contract.crewMemberId);
                    const vessel = vesselMap.get(contract.vesselId);

                    if (crew) {
                        console.log(`🚨 Alert: ${crew.firstName} ${crew.lastName} transitioned ${lastCategory || 'None'} -> ${currentCategory}`);

                        await this.sendTransitionAlert(contract, crew, vessel, lastCategory, currentCategory);
                        alertCount++;
                    }
                }

                // Always update lastHealthCategory if it changed (even if moving to less urgent state, e.g. after extension)
                if (currentCategory !== lastCategory) {
                    await storage.updateContract(contract.id, { lastHealthCategory: currentCategory });
                }
            }

            console.log(`✅ Contract health transition check completed. Alerts sent: ${alertCount}`);
        } catch (error) {
            console.error('❌ Error checking contract health transitions:', error);
        }
    }

    /**
     * Send the email alert for a transition
     */
    private async sendTransitionAlert(
        contract: Contract,
        crew: CrewMember,
        vessel: Vessel | undefined,
        previousCategory: HealthCategory | null,
        currentCategory: HealthCategory
    ): Promise<void> {
        const settings = await storage.getEmailSettings();
        const recipientEmail = settings?.recipientEmail || 'admin@offing.biz, management@fullahead.in';

        const crewName = `${crew.firstName} ${crew.lastName}`;
        const vesselName = vessel?.name || 'Unassigned';

        const prevDisplay = previousCategory ? this.getCategoryDisplayName(previousCategory) : 'Initial State';
        const currDisplay = this.getCategoryDisplayName(currentCategory);

        const subject = `🔔 Contract Health Alert: ${crewName} (${vesselName})`;

        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #1e3a5f; margin: 0 0 20px 0;">📋 Contract Health Transition</h2>
          
          <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 25px;">
            <p style="margin: 0; color: #92400e; font-weight: bold;">
              Status Change Detected
            </p>
            <p style="margin: 5px 0 0 0; color: #b45309;">
              ${prevDisplay} → <span style="text-decoration: underline;">${currDisplay}</span>
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 150px;">Crew Member:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${crewName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Rank:</td>
              <td style="padding: 8px 0; color: #111827;">${crew.rank}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Vessel:</td>
              <td style="padding: 8px 0; color: #111827;">${vesselName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">End Date:</td>
              <td style="padding: 8px 0; color: #dc2626; font-weight: bold;">${contract.endDate.toLocaleDateString()}</td>
            </tr>
          </table>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          
          <p style="color: #374151; font-size: 14px; line-height: 1.6;">
            Please take proactive measures for crew rotation or contract extension as required.
          </p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 25px;">
            This is an automated notification from your Crew Management System.
          </p>
        </div>
      </div>
    `;

        await smtpEmailService.sendEmail({
            to: recipientEmail,
            subject,
            html
        });

        // Log notification
        await storage.logNotification({
            eventId: `transition-${contract.id}-${currentCategory}`,
            eventType: 'contract_expiry',
            eventDate: contract.endDate,
            notificationDate: new Date(),
            daysBeforeEvent: 0, // Not applicable
            provider: 'email',
            success: true,
            metadata: {
                crewName,
                vesselName,
                previousCategory,
                currentCategory,
                transition: true
            }
        });
    }
}

export const contractHealthAlertService = ContractHealthAlertService.getInstance();
