import { db } from '../db';
import { documents, crewMembers } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { differenceInDays, addDays } from 'date-fns';
import { documentStatusService, DocumentStatus } from './document-status-service';

export interface ValidationResult {
    isValid: boolean;
    blockers: Array<{
        type: string;
        message: string;
        expiryDate: Date | null;
    }>;
    warnings: Array<{
        type: string;
        message: string;
        expiryDate: Date | null;
    }>;
}

export class DocumentValidationService {
    private readonly MINIMUM_VALIDITY_DAYS = 30;
    private readonly CONTRACT_BUFFER_DAYS = 30;

    /**
     * Validate crew documents for sign-on
     */
    async validateForSignOn(
        crewId: string,
        contractStartDate: Date | string,
        durationDays: number
    ): Promise<ValidationResult> {
        const startDate = typeof contractStartDate === 'string' ? new Date(contractStartDate) : contractStartDate;
        const endDate = addDays(startDate, durationDays);
        const requiredUntilDate = addDays(endDate, this.CONTRACT_BUFFER_DAYS);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch crew documents
        const crewDocs = await db
            .select()
            .from(documents)
            .where(
                eq(documents.crewMemberId, crewId)
            );

        // Fetch crew details for rank-based validation
        const [crew] = await db
            .select()
            .from(crewMembers)
            .where(eq(crewMembers.id, crewId))
            .limit(1);

        const blockers: ValidationResult['blockers'] = [];
        const warnings: ValidationResult['warnings'] = [];

        // Mandatory documents
        const mandatoryTypes = ['passport', 'cdc', 'medical'];

        // COC is mandatory for officers
        if (crew && this.isOfficer(crew.rank)) {
            mandatoryTypes.push('coc');
        }

        for (const type of mandatoryTypes) {
            const doc = crewDocs.find(d => d.type === type);

            if (!doc) {
                blockers.push({
                    type,
                    message: `Missing mandatory document: ${type.toUpperCase()}`,
                    expiryDate: null
                });
                continue;
            }

            if (!doc.expiryDate) {
                blockers.push({
                    type,
                    message: `${type.toUpperCase()} has no expiry date set`,
                    expiryDate: null
                });
                continue;
            }

            const expiry = new Date(doc.expiryDate);
            const daysUntilExpiry = differenceInDays(expiry, today);
            const daysFromStartToExpiry = differenceInDays(expiry, startDate);

            // 1. BLOCK if expired
            if (daysUntilExpiry < 0) {
                blockers.push({
                    type,
                    message: `${type.toUpperCase()} expired on ${expiry.toLocaleDateString()}`,
                    expiryDate: expiry
                });
            }
            // 2. BLOCK if expiring within 30 days of sign-on
            else if (daysUntilExpiry < this.MINIMUM_VALIDITY_DAYS) {
                blockers.push({
                    type,
                    message: `${type.toUpperCase()} expires in ${daysUntilExpiry} days (minimum 30 days required)`,
                    expiryDate: expiry
                });
            }
            // 3. BLOCK if expires during contract (Warning for Medical)
            else if (expiry < endDate) {
                if (type === 'medical') {
                    warnings.push({
                        type,
                        message: `${type.toUpperCase()} expires on ${expiry.toLocaleDateString()} which is during the contract period`,
                        expiryDate: expiry
                    });
                } else {
                    blockers.push({
                        type,
                        message: `${type.toUpperCase()} expires on ${expiry.toLocaleDateString()} which is during the contract period`,
                        expiryDate: expiry
                    });
                }
            }
            // 4. WARN if expires within buffer period after contract
            else if (expiry < requiredUntilDate) {
                warnings.push({
                    type,
                    message: `${type.toUpperCase()} expires shortly after contract ends (${expiry.toLocaleDateString()})`,
                    expiryDate: expiry
                });
            }
        }

        return {
            isValid: blockers.length === 0,
            blockers,
            warnings
        };
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

export const documentValidationService = new DocumentValidationService();
