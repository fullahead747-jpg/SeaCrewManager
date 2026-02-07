import { differenceInDays, isPast, isFuture, addDays } from 'date-fns';

export enum DocumentStatus {
    VALID = 'valid',
    EXPIRING_SOON = 'expiring',
    EXPIRED = 'expired',
    CRITICALLY_EXPIRED = 'critically_expired'
}

export interface StatusCalculationResult {
    status: DocumentStatus;
    daysUntilExpiry: number;
    isInGracePeriod: boolean;
    blockedFromAssignments: boolean;
    nextNotificationDue: Date | null;
}

export class DocumentStatusService {
    private readonly WARNING_DAYS = 30; // Days before expiry to show "expiring soon"
    private readonly DEFAULT_GRACE_PERIOD = 7; // Days after expiry before critical

    /**
     * Calculate the current status of a document based on its expiry date
     */
    calculateDocumentStatus(
        expiryDate: Date | string | null,
        gracePeriodDays: number = this.DEFAULT_GRACE_PERIOD
    ): StatusCalculationResult {
        if (!expiryDate) {
            return {
                status: DocumentStatus.VALID,
                daysUntilExpiry: 999,
                isInGracePeriod: false,
                blockedFromAssignments: false,
                nextNotificationDue: null
            };
        }

        const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        const daysUntilExpiry = differenceInDays(expiry, today);

        // Determine status
        let status: DocumentStatus;
        let isInGracePeriod = false;
        let blockedFromAssignments = false;

        if (daysUntilExpiry > this.WARNING_DAYS) {
            // More than 30 days until expiry
            status = DocumentStatus.VALID;
        } else if (daysUntilExpiry > 0) {
            // 1-30 days until expiry
            status = DocumentStatus.EXPIRING_SOON;
        } else if (daysUntilExpiry >= -gracePeriodDays) {
            // 0 to grace period days past expiry
            status = DocumentStatus.EXPIRED;
            isInGracePeriod = true;
        } else {
            // More than grace period days past expiry
            status = DocumentStatus.CRITICALLY_EXPIRED;
            blockedFromAssignments = true;
        }

        // Calculate next notification due date
        const nextNotificationDue = this.calculateNextNotificationDate(
            expiry,
            daysUntilExpiry,
            status
        );

        return {
            status,
            daysUntilExpiry,
            isInGracePeriod,
            blockedFromAssignments,
            nextNotificationDue
        };
    }

    /**
     * Determine when the next notification should be sent
     */
    private calculateNextNotificationDate(
        expiryDate: Date,
        daysUntilExpiry: number,
        status: DocumentStatus
    ): Date | null {
        const today = new Date();

        switch (status) {
            case DocumentStatus.VALID:
                // Next notification at 30 days before expiry
                if (daysUntilExpiry > this.WARNING_DAYS) {
                    return addDays(expiryDate, -this.WARNING_DAYS);
                }
                return null;

            case DocumentStatus.EXPIRING_SOON:
                // Notifications at 30, 15, and 7 days before expiry
                if (daysUntilExpiry > 15) {
                    return addDays(expiryDate, -15);
                } else if (daysUntilExpiry > 7) {
                    return addDays(expiryDate, -7);
                } else if (daysUntilExpiry > 0) {
                    return expiryDate; // Next notification on expiry day
                }
                return null;

            case DocumentStatus.EXPIRED:
            case DocumentStatus.CRITICALLY_EXPIRED:
                // Daily notifications for expired documents
                return addDays(today, 1);

            default:
                return null;
        }
    }

    /**
     * Get human-readable status label
     */
    getStatusLabel(status: DocumentStatus): string {
        const labels = {
            [DocumentStatus.VALID]: 'Valid',
            [DocumentStatus.EXPIRING_SOON]: 'Expiring Soon',
            [DocumentStatus.EXPIRED]: 'Expired',
            [DocumentStatus.CRITICALLY_EXPIRED]: 'Critically Expired'
        };
        return labels[status];
    }

    /**
     * Get status badge color for UI
     */
    getStatusColor(status: DocumentStatus): {
        bg: string;
        text: string;
        border: string;
    } {
        const colors = {
            [DocumentStatus.VALID]: {
                bg: 'bg-green-100',
                text: 'text-green-800',
                border: 'border-green-200'
            },
            [DocumentStatus.EXPIRING_SOON]: {
                bg: 'bg-yellow-100',
                text: 'text-yellow-800',
                border: 'border-yellow-200'
            },
            [DocumentStatus.EXPIRED]: {
                bg: 'bg-orange-100',
                text: 'text-orange-800',
                border: 'border-orange-200'
            },
            [DocumentStatus.CRITICALLY_EXPIRED]: {
                bg: 'bg-red-100',
                text: 'text-red-800',
                border: 'border-red-200'
            }
        };
        return colors[status];
    }

    /**
     * Determine if a notification should be sent based on last sent date
     */
    shouldSendNotification(
        status: DocumentStatus,
        daysUntilExpiry: number,
        lastNotificationDate: Date | null
    ): boolean {
        if (!lastNotificationDate) {
            return true; // Never sent, should send
        }

        const daysSinceLastNotification = differenceInDays(
            new Date(),
            lastNotificationDate
        );

        switch (status) {
            case DocumentStatus.VALID:
                return false; // No notifications for valid documents

            case DocumentStatus.EXPIRING_SOON:
                // Send at 30, 15, and 7 days before expiry
                if (daysUntilExpiry === 30 || daysUntilExpiry === 15 || daysUntilExpiry === 7) {
                    return daysSinceLastNotification >= 1;
                }
                return false;

            case DocumentStatus.EXPIRED:
            case DocumentStatus.CRITICALLY_EXPIRED:
                // Send daily for expired documents
                return daysSinceLastNotification >= 1;

            default:
                return false;
        }
    }

    /**
     * Get notification type based on status and days until expiry
     */
    getNotificationType(status: DocumentStatus, daysUntilExpiry: number): string {
        if (status === DocumentStatus.CRITICALLY_EXPIRED) {
            return 'critical_expired';
        }
        if (status === DocumentStatus.EXPIRED) {
            return 'expired';
        }
        if (daysUntilExpiry === 7) {
            return 'expiring_7days';
        }
        if (daysUntilExpiry === 15) {
            return 'expiring_15days';
        }
        if (daysUntilExpiry === 30) {
            return 'expiring_30days';
        }
        return 'unknown';
    }

    /**
     * Format days remaining for display
     */
    formatDaysRemaining(daysUntilExpiry: number): string {
        if (daysUntilExpiry > 0) {
            return `${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} remaining`;
        } else if (daysUntilExpiry === 0) {
            return 'Expires today';
        } else {
            const daysPast = Math.abs(daysUntilExpiry);
            return `Expired ${daysPast} day${daysPast !== 1 ? 's' : ''} ago`;
        }
    }
}

// Export singleton instance
export const documentStatusService = new DocumentStatusService();
