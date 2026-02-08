import 'dotenv/config';
import { db } from '../db';
import { documents, crewMembers, notificationLog } from '@shared/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { documentStatusService, DocumentStatus } from '../services/document-status-service';
import { notificationService } from '../services/notification-service';
import { sendDocumentExpiryNotification } from '../services/document-notification-service';

/**
 * Daily job to update document statuses and trigger notifications
 * Should be run via cron at 2 AM daily
 */
export async function updateDocumentStatuses() {
    console.log('[CRON] Starting daily document status update job...');

    try {
        // Fetch all non-deleted documents
        const allDocuments = await db
            .select()
            .from(documents);

        console.log(`[CRON] Processing ${allDocuments.length} documents...`);

        let updatedCount = 0;
        let notificationsSent = 0;

        for (const doc of allDocuments) {
            // Calculate current status
            const statusResult = documentStatusService.calculateDocumentStatus(
                doc.expiryDate,
                7
            );

            // Check if status has changed
            const statusChanged = doc.status !== statusResult.status;

            if (statusChanged) {
                // Update document status
                await db
                    .update(documents)
                    .set({
                        status: statusResult.status
                    })
                    .where(eq(documents.id, doc.id));

                updatedCount++;
                console.log(`[CRON] Updated ${doc.type} for crew ${doc.crewMemberId}: ${doc.status} → ${statusResult.status}`);
            }

            // Check if notification should be sent
            const shouldNotify = await shouldSendNotification(
                doc.id,
                statusResult.status,
                statusResult.daysUntilExpiry
            );

            if (shouldNotify) {
                // Fetch crew member details
                const crew = await db
                    .select()
                    .from(crewMembers)
                    .where(eq(crewMembers.id, doc.crewMemberId))
                    .limit(1);

                if (crew.length > 0) {
                    const crewMember = crew[0];

                    // Send notification
                    try {
                        await sendDocumentNotification(doc, crewMember, statusResult);
                        notificationsSent++;
                    } catch (error) {
                        console.error(`[CRON] Failed to send notification for document ${doc.id}:`, error);
                    }
                }
            }
        }

        console.log(`[CRON] Job complete. Updated: ${updatedCount}, Notifications sent: ${notificationsSent}`);

        return {
            success: true,
            documentsProcessed: allDocuments.length,
            documentsUpdated: updatedCount,
            notificationsSent
        };
    } catch (error) {
        console.error('[CRON] Error in document status update job:', error);
        throw error;
    }
}

/**
 * Check if a notification should be sent for a document
 */
async function shouldSendNotification(
    documentId: string,
    status: DocumentStatus,
    daysUntilExpiry: number
): Promise<boolean> {
    // Don't send notifications for valid documents
    if (status === DocumentStatus.VALID) {
        return false;
    }

    // Get the last notification sent for this document
    const lastNotification = await db
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.documentId, documentId))
        .orderBy(notificationLog.sentAt)
        .limit(1);

    if (lastNotification.length === 0) {
        // Never sent a notification, should send
        return true;
    }

    const lastSent = lastNotification[0].sentAt;
    if (!lastSent) return true;

    const daysSinceLastNotification = Math.floor(
        (Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24)
    );

    // For expiring documents, send at specific milestones
    if (status === DocumentStatus.EXPIRING_SOON) {
        const milestones = [30, 15, 7];
        return milestones.includes(daysUntilExpiry) && daysSinceLastNotification >= 1;
    }

    // For expired documents, send daily
    if (status === DocumentStatus.EXPIRED || status === DocumentStatus.CRITICALLY_EXPIRED) {
        return daysSinceLastNotification >= 1;
    }

    return false;
}

/**
 * Send notification for a document
 */
async function sendDocumentNotification(
    document: any,
    crewMember: any,
    statusResult: any
) {
    const notificationType = documentStatusService.getNotificationType(
        statusResult.status,
        statusResult.daysUntilExpiry
    );

    // Determine recipient email
    const recipientEmail = crewMember.email || 'admin@offing.biz';

    // Send email notification
    await sendDocumentExpiryNotification(
        document,
        crewMember,
        statusResult.daysUntilExpiry,
        notificationType
    );

    // Log the notification
    await db.insert(notificationLog).values({
        documentId: document.id,
        crewMemberId: crewMember.id,
        notificationType,
        recipientEmail,
        status: 'sent',
        metadata: {
            daysUntilExpiry: statusResult.daysUntilExpiry,
            documentStatus: statusResult.status
        }
    });
}

// If running directly (for testing)
if (require.main === module) {
    updateDocumentStatuses()
        .then(result => {
            console.log('Job completed successfully:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Job failed:', error);
            process.exit(1);
        });
}
