import type { Document } from '@shared/schema';

export type CrewStatus = 'all-valid' | 'expiring-soon' | 'action-required' | 'new-crew';

export interface CrewDocumentStatus {
    status: CrewStatus;
    expiringCount: number;
    expiredCount: number;
    missingCount: number;
    daysUntilNextExpiry: number | null;
    criticalDocument: string | null;
}

const EXPIRING_SOON_DAYS = 30;
const NEW_CREW_DAYS = 7;

/**
 * Calculate the overall status of a crew member based on their documents
 */
export function calculateCrewStatus(
    documents: Document[],
    createdAt: Date
): CrewDocumentStatus {
    const now = new Date();
    const requiredDocTypes = ['passport', 'medical', 'cdc', 'coc'];

    let expiringCount = 0;
    let expiredCount = 0;
    let missingCount = 0;
    let nearestExpiry: Date | null = null;
    let criticalDocument: string | null = null;

    // Check each required document type
    for (const docType of requiredDocTypes) {
        // Find the best document for this type:
        // 1. Must match type
        // 2. Prioritize ones with filePath (uploaded)
        // 3. If multiple uploaded, we could sort by expiry, but for now just picking one with file is enough to fix the "red dot" bug.
        const docsOfType = documents.filter(d => d.type === docType);
        const docWithFile = docsOfType.find(d => d.filePath);
        const doc = docWithFile || docsOfType[0];

        if (!doc || !doc.filePath) {
            missingCount++;
            if (!criticalDocument) criticalDocument = docType.toUpperCase();
            continue;
        }

        if (doc.expiryDate) {
            const expiryDate = new Date(doc.expiryDate);
            const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntilExpiry < 0) {
                expiredCount++;
                if (!criticalDocument) criticalDocument = docType.toUpperCase();
            } else if (daysUntilExpiry <= EXPIRING_SOON_DAYS) {
                expiringCount++;
                if (!nearestExpiry || expiryDate < nearestExpiry) {
                    nearestExpiry = expiryDate;
                    criticalDocument = docType.toUpperCase();
                }
            } else {
                // Valid document - check if it's the nearest expiry
                if (!nearestExpiry || expiryDate < nearestExpiry) {
                    nearestExpiry = expiryDate;
                }
            }
        }
    }

    // Calculate days until next expiry
    const daysUntilNextExpiry = nearestExpiry
        ? Math.floor((nearestExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    // Determine overall status
    let status: CrewStatus;

    // Check if new crew (created in last 7 days)
    const daysSinceCreation = Math.floor((now.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const isNewCrew = daysSinceCreation <= NEW_CREW_DAYS;

    if (expiredCount > 0 || missingCount > 0) {
        status = 'action-required';
    } else if (expiringCount > 0) {
        status = 'expiring-soon';
    } else if (isNewCrew) {
        status = 'new-crew';
    } else {
        status = 'all-valid';
    }

    return {
        status,
        expiringCount,
        expiredCount,
        missingCount,
        daysUntilNextExpiry,
        criticalDocument
    };
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: CrewStatus): string {
    switch (status) {
        case 'all-valid':
            return 'green';
        case 'expiring-soon':
            return 'orange';
        case 'action-required':
            return 'red';
        case 'new-crew':
            return 'blue';
    }
}

/**
 * Get status label for UI
 */
export function getStatusLabel(status: CrewStatus): string {
    switch (status) {
        case 'all-valid':
            return 'All Documents Valid';
        case 'expiring-soon':
            return 'Expiring Soon';
        case 'action-required':
            return 'Action Required';
        case 'new-crew':
            return 'New Crew';
    }
}

/**
 * Get document status (for individual document in grid)
 */
export function getDocumentStatus(doc: Document | undefined): 'valid' | 'expiring' | 'expired' | 'missing' {
    if (!doc || !doc.filePath) return 'missing';

    if (!doc.expiryDate) return 'valid'; // No expiry date means it doesn't expire

    const now = new Date();
    const expiryDate = new Date(doc.expiryDate);
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= EXPIRING_SOON_DAYS) return 'expiring';
    return 'valid';
}

/**
 * Get color for document status
 */
export function getDocumentStatusColor(status: 'valid' | 'expiring' | 'expired' | 'missing'): string {
    switch (status) {
        case 'valid':
            return '#10B981'; // green
        case 'expiring':
            return '#F59E0B'; // orange
        case 'expired':
            return '#EF4444'; // red
        case 'missing':
            return '#9CA3AF'; // gray
    }
}
