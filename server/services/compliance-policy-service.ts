import { db } from '../db';
import { documents, crewMembers, contracts, type Document, type Contract, type CrewMember } from '@shared/schema';
import { eq, and, gt, lt, lte, gte } from 'drizzle-orm';
import { differenceInDays, addDays, isWithinInterval } from 'date-fns';
import { storage } from '../storage';

export interface PolicyValidationResult {
    allowed: boolean;
    reason?: string;
    actionRequired?: string;
    severity?: 'warning' | 'error';
    gracePeriodAvailable?: boolean;
}

export class CompliancePolicyService {
    /**
     * Check if a contract extension is allowed based on document validity
     */
    async validateContractExtension(contractId: string, newEndDate: Date): Promise<PolicyValidationResult> {
        try {
            const contract = await storage.getContract(contractId);
            if (!contract) return { allowed: false, reason: 'Contract not found' };

            const crewMember = await storage.getCrewMember(contract.crewMemberId);
            if (!crewMember) return { allowed: false, reason: 'Crew member not found' };

            const crewDocs = await storage.getDocumentsByCrewMember(crewMember.id);
            const criticalTypes = ['passport', 'cdc', 'medical'];

            // coc is critical for officers, unless marked as Not Applicable
            if (this.isOfficer(crewMember.rank) && !crewMember.cocNotApplicable) {
                criticalTypes.push('coc');
            }

            for (const type of criticalTypes) {
                const doc = crewDocs.find(d => d.type === type);
                if (!doc || !doc.expiryDate) {
                    return {
                        allowed: false,
                        reason: `Mandatory document ${type.toUpperCase()} is missing or has no expiry date`,
                        severity: 'error'
                    };
                }

                const expiry = new Date(doc.expiryDate);
                const bufferDate = addDays(newEndDate, 30); // 30-day buffer after contract end

                if (expiry < bufferDate) {
                    const diffDays = differenceInDays(expiry, newEndDate);
                    const isError = diffDays < 0;

                    // Log the policy event
                    await storage.logActivity({
                        type: 'Compliance Policy',
                        action: isError ? 'block_extension' : 'warn_extension',
                        entityType: 'contract',
                        entityId: contractId,
                        username: 'System',
                        userRole: 'admin',
                        description: `${isError ? 'BLOCKED' : 'WARNING'}: Contract extension for ${crewMember.firstName} ${crewMember.lastName} due to ${type.toUpperCase()} expiry (${expiry.toLocaleDateString()}).`,
                        severity: isError ? 'error' : 'warning',
                        metadata: {
                            crewMemberId: crewMember.id,
                            documentType: type,
                            documentExpiry: expiry.toISOString(),
                            contractEndDate: newEndDate.toISOString(),
                            bufferDate: bufferDate.toISOString()
                        }
                    });

                    if (isError) {
                        return {
                            allowed: false,
                            reason: `${type.toUpperCase()} expires on ${expiry.toLocaleDateString()} which is before the new contract end date.`,
                            actionRequired: 'Document must be renewed before extension.',
                            severity: 'error'
                        };
                    } else {
                        return {
                            allowed: false,
                            reason: `${type.toUpperCase()} expires on ${expiry.toLocaleDateString()} which is within 30 days after the contract end date.`,
                            actionRequired: 'Warning: Insufficient buffer for extension.',
                            severity: 'warning'
                        };
                    }
                }
            }

            return { allowed: true };
        } catch (error) {
            console.error('Error validating contract extension:', error);
            return { allowed: false, reason: 'Internal error during policy validation' };
        }
    }

    /**
     * Check if a crew member must sign off due to expired documents
     */
    async checkMandatorySignOff(crewMemberId: string): Promise<PolicyValidationResult> {
        try {
            const crewMember = await storage.getCrewMember(crewMemberId);
            if (!crewMember || crewMember.status !== 'onBoard') {
                return { allowed: true };
            }

            const crewDocs = await storage.getDocumentsByCrewMember(crewMemberId);
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            for (const doc of crewDocs) {
                if (!doc.expiryDate) continue;

                const expiry = new Date(doc.expiryDate);
                if (expiry < now) {
                    // Check if at sea (this would typically come from a vessel movement service)
                    // For now, we'll assume there's a 7-day grace period if "at sea"
                    // In a real app, we'd check the last port call vs current date
                    const isAtSea = true; // Placeholder for real logic

                    if (isAtSea) {
                        const graceExpiry = addDays(expiry, 7);
                        if (now <= graceExpiry) {
                            // Log the grace period incident
                            await storage.logActivity({
                                type: 'Compliance Policy',
                                action: 'grace_period_active',
                                entityType: 'crew',
                                entityId: crewMemberId,
                                username: 'System',
                                userRole: 'admin',
                                description: `Grace period (7 days) active for ${crewMember.firstName} ${crewMember.lastName} due to expired ${doc.type.toUpperCase()} while at sea.`,
                                severity: 'warning',
                                metadata: { docType: doc.type, expiryDate: expiry.toISOString() }
                            });

                            return {
                                allowed: false,
                                reason: `${doc.type.toUpperCase()} has expired.`,
                                actionRequired: 'Mandatory sign-off at NEXT PORT required. 7-day grace period active.',
                                severity: 'warning',
                                gracePeriodAvailable: true
                            };
                        }
                    }

                    // Log the critical compliance incident
                    await storage.logActivity({
                        type: 'Compliance Policy',
                        action: 'compliance_incident',
                        entityType: 'crew',
                        entityId: crewMemberId,
                        username: 'System',
                        userRole: 'admin',
                        description: `CRITICAL: Mandatory sign-off required for ${crewMember.firstName} ${crewMember.lastName} due to expired ${doc.type.toUpperCase()} on ${expiry.toLocaleDateString()}.`,
                        severity: 'error',
                        metadata: { docType: doc.type, expiryDate: expiry.toISOString() }
                    });

                    return {
                        allowed: false,
                        reason: `${doc.type.toUpperCase()} has expired.`,
                        actionRequired: 'CRITICAL: Mandatory sign-off required immediately at current port.',
                        severity: 'error',
                        gracePeriodAvailable: false
                    };
                }
            }

            return { allowed: true };
        } catch (error) {
            console.error('Error checking mandatory sign-off:', error);
            return { allowed: true };
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

export const compliancePolicyService = new CompliancePolicyService();
