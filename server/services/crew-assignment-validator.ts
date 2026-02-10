import { db } from '../db';
import { documents, crewMembers } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { documentStatusService, DocumentStatus } from './document-status-service';

export interface AssignmentEligibility {
    isEligible: boolean;
    blockedDocuments: Array<{
        id: string;
        type: string;
        status: DocumentStatus;
        expiryDate: Date | null;
        daysUntilExpiry: number;
    }>;
    warnings: string[];
}

export class CrewAssignmentValidator {
    /**
     * Validate if a crew member is eligible for vessel assignment
     */
    async validateCrewForAssignment(
        crewMemberId: string,
        position?: string
    ): Promise<AssignmentEligibility> {
        // Fetch all documents for the crew member
        const crewDocs = await db
            .select()
            .from(documents)
            .where(
                eq(documents.crewMemberId, crewMemberId)
            );

        // Fetch crew details for cocNotApplicable flag
        const [crew] = await db
            .select()
            .from(crewMembers)
            .where(eq(crewMembers.id, crewMemberId))
            .limit(1);

        const blockedDocuments: AssignmentEligibility['blockedDocuments'] = [];
        const warnings: string[] = [];

        // Define mandatory documents
        const mandatoryDocTypes = ['passport', 'cdc', 'medical'];

        // COC is mandatory only for officer positions, unless marked as Not Applicable
        if (position && this.isOfficerPosition(position) && !(crew?.cocNotApplicable)) {
            mandatoryDocTypes.push('coc');
        }

        // Check each mandatory document type
        for (const docType of mandatoryDocTypes) {
            const doc = crewDocs.find(d => d.type === docType);

            if (!doc) {
                // Document missing entirely
                warnings.push(`Missing ${docType.toUpperCase()} document`);
                blockedDocuments.push({
                    id: '',
                    type: docType,
                    status: DocumentStatus.CRITICALLY_EXPIRED,
                    expiryDate: null,
                    daysUntilExpiry: -999
                });
                continue;
            }

            // Calculate status
            const statusResult = documentStatusService.calculateDocumentStatus(
                doc.expiryDate,
                7
            );

            // Check if blocked
            if (statusResult.blockedFromAssignments) {
                blockedDocuments.push({
                    id: doc.id,
                    type: doc.type,
                    status: statusResult.status,
                    expiryDate: doc.expiryDate,
                    daysUntilExpiry: statusResult.daysUntilExpiry
                });
            }

            // Add warnings for expiring or expired (in grace period) documents
            if (statusResult.status === DocumentStatus.EXPIRING_SOON) {
                warnings.push(
                    `${doc.type.toUpperCase()} expires in ${statusResult.daysUntilExpiry} days`
                );
            } else if (statusResult.status === DocumentStatus.EXPIRED && statusResult.isInGracePeriod) {
                warnings.push(
                    `${doc.type.toUpperCase()} expired ${Math.abs(statusResult.daysUntilExpiry)} days ago (grace period active)`
                );
            }
        }

        return {
            isEligible: blockedDocuments.length === 0,
            blockedDocuments,
            warnings
        };
    }

    /**
     * Determine if a position requires COC
     */
    private isOfficerPosition(position: string): boolean {
        const officerPositions = [
            'captain',
            'chief officer',
            'second officer',
            'third officer',
            'chief engineer',
            'second engineer',
            'third engineer',
            'fourth engineer',
            'master',
            'mate',
            'officer'
        ];

        return officerPositions.some(p =>
            position.toLowerCase().includes(p)
        );
    }

    /**
     * Get formatted eligibility message for UI
     */
    getEligibilityMessage(eligibility: AssignmentEligibility): string {
        if (eligibility.isEligible) {
            if (eligibility.warnings.length > 0) {
                return `Eligible with warnings: ${eligibility.warnings.join(', ')}`;
            }
            return 'Eligible for assignment';
        }

        const blockedDocs = eligibility.blockedDocuments
            .map(d => d.type.toUpperCase())
            .join(', ');

        return `Cannot assign: ${blockedDocs} critically expired`;
    }
}

// Export singleton instance
export const crewAssignmentValidator = new CrewAssignmentValidator();
