import { db } from '../db';
import { documents, crewMembers, vessels } from '@shared/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { differenceInDays } from 'date-fns';
import { notificationService, UpcomingEvent } from './notification-service';
import { storage } from '../storage';
import { smtpEmailService } from './smtp-email-service';

export enum ComplianceStage {
    EARLY_WARNING = 'early_warning',    // 90 days
    PLANNING = 'planning',             // 60 days
    URGENT = 'urgent',                 // 30 days
    CRITICAL = 'critical',             // 15 days
    NON_COMPLIANT = 'non_compliant'    // 0 days
}

export class DocumentMonitoringService {
    /**
     * Scan all onboard crew for document compliance and trigger alerts
     */
    async monitorOnboardCrewCompliance(): Promise<void> {
        try {
            console.log('🔍 Running document compliance monitoring for onboard crew...');

            const now = new Date();
            now.setHours(0, 0, 0, 0);

            // Fetch all onboard crew members
            const onboardCrew = await db
                .select()
                .from(crewMembers)
                .where(eq(crewMembers.status, 'onBoard'));

            if (onboardCrew.length === 0) {
                console.log('ℹ️ No crew members currently onboard.');
                return;
            }

            const crewIds = onboardCrew.map(c => c.id);

            // Fetch their documents
            const crewDocs = await db
                .select()
                .from(documents)
                .where(
                    inArray(documents.crewMemberId, crewIds)
                );

            // Fetch vessels for notification context
            const allVessels = await db.select().from(vessels);
            const vesselMap = new Map(allVessels.map(v => [v.id, v.name]));

            const events: UpcomingEvent[] = [];

            for (const crew of onboardCrew) {
                const docs = crewDocs.filter(d => d.crewMemberId === crew.id);
                const criticalTypes = ['passport', 'cdc', 'medical'];
                if (this.isOfficer(crew.rank)) {
                    criticalTypes.push('coc');
                }

                for (const type of criticalTypes) {
                    const doc = docs.find(d => d.type === type);
                    if (!doc || !doc.expiryDate) continue;

                    const expiry = new Date(doc.expiryDate);
                    const daysUntilExpiry = differenceInDays(expiry, now);
                    const vesselName = crew.currentVesselId ? vesselMap.get(crew.currentVesselId) : 'Unknown';

                    const stage = this.getComplianceStage(daysUntilExpiry);
                    if (!stage) continue;

                    events.push({
                        id: `onboard-monitor-${doc.id}-${stage}`,
                        type: 'document_expiry',
                        title: `${type.toUpperCase()} ${this.getStageLabel(stage)}`,
                        description: `${crew.firstName} ${crew.lastName}'s ${type.toUpperCase()} expires in ${daysUntilExpiry} days (${expiry.toLocaleDateString()}). Vessel: ${vesselName}. Stage: ${this.getStageLabel(stage)}.`,
                        date: expiry,
                        severity: this.getSeverity(stage),
                        crewMemberId: crew.id,
                        crewMemberName: `${crew.firstName} ${crew.lastName}`,
                        crewMemberRank: crew.rank || undefined,
                        vesselId: crew.currentVesselId || undefined,
                        vesselName,
                        documentId: doc.id,
                        documentType: type,
                        documentNumber: doc.documentNumber || undefined,
                    });
                }
            }

            if (events.length > 0) {
                console.log(`📢 Triggering alerts for ${events.length} compliance events...`);
                await notificationService.sendEventNotifications(events);
            } else {
                console.log('✅ No urgent document compliance issues found for onboard crew.');
            }
            console.log(`✅ Document monitoring completed. ${events.length} events processed.`);
        } catch (error) {
            console.error('❌ Error during document monitoring:', error);
        }
    }

    async generateDailyComplianceDigest(): Promise<void> {
        try {
            console.log('📊 Generating daily compliance digest...');

            const emailSettings = await storage.getEmailSettings();
            if (!emailSettings?.enabled || !smtpEmailService.isReady()) {
                console.log('ℹ️ Email notifications not enabled, skipping digest.');
                return;
            }

            const recipientEmail = emailSettings.recipientEmail || 'admin@offing.biz';
            const alerts = await storage.getExpiringDocuments(90);

            if (alerts.length === 0) {
                console.log('✅ No expiring documents found, skipping digest.');
                return;
            }

            // Add vessel names to alerts for the digest
            const alertsWithVessel = await Promise.all(alerts.map(async (alert) => {
                const vessel = alert.crewMember.currentVesselId
                    ? await storage.getVessel(alert.crewMember.currentVesselId)
                    : undefined;
                return {
                    ...alert,
                    vesselName: vessel?.name
                };
            }));

            const result = await smtpEmailService.sendComplianceDigest(recipientEmail, alertsWithVessel);

            if (result.success) {
                console.log('✅ Daily compliance digest sent successfully.');
            } else {
                console.error('❌ Failed to send daily compliance digest:', result.error);
            }
        } catch (error) {
            console.error('❌ Error generating daily compliance digest:', error);
        }
    }

    private getComplianceStage(days: number): ComplianceStage | null {
        if (days <= 0) return ComplianceStage.NON_COMPLIANT;
        if (days <= 15) return ComplianceStage.CRITICAL;
        if (days <= 30) return ComplianceStage.URGENT;
        if (days <= 60) return ComplianceStage.PLANNING;
        if (days <= 90) return ComplianceStage.EARLY_WARNING;
        return null;
    }

    private getStageLabel(stage: ComplianceStage): string {
        switch (stage) {
            case ComplianceStage.EARLY_WARNING: return 'Early Warning (90 days)';
            case ComplianceStage.PLANNING: return 'Planning Required (60 days)';
            case ComplianceStage.URGENT: return 'Urgent Action (30 days)';
            case ComplianceStage.CRITICAL: return 'Critical (15 days)';
            case ComplianceStage.NON_COMPLIANT: return 'Non-Compliant (Expired)';
            default: return '';
        }
    }

    private getSeverity(stage: ComplianceStage): 'info' | 'warning' | 'high' {
        switch (stage) {
            case ComplianceStage.EARLY_WARNING: return 'info';
            case ComplianceStage.PLANNING: return 'warning';
            case ComplianceStage.URGENT: return 'warning';
            case ComplianceStage.CRITICAL: return 'high';
            case ComplianceStage.NON_COMPLIANT: return 'high';
            default: return 'info';
        }
    }

    private isOfficer(rank: string | null | undefined): boolean {
        if (!rank) return false;
        const officerRanks = [
            'captain', 'master', 'chief officer', 'second officer', 'third officer',
            'chief engineer', 'second engineer', 'third engineer', 'fourth engineer',
            'officer', 'mate'
        ];
        const normalizedRank = rank.toLowerCase();
        return officerRanks.some(r => normalizedRank.includes(r));
    }
}

export const documentMonitoringService = new DocumentMonitoringService();
