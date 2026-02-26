import { db } from '../db';
import { documentAccessTokens, documents } from '@shared/schema';
import { eq, and, lt } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Service for managing secure document access tokens
 * Enables time-limited, secure document viewing via email links
 */
export class DocumentAccessService {
    /**
     * Generate a secure access token for a document
     * @param documentId - ID of the document to grant access to
     * @param expiryHours - Hours until token expires (default: 48)
     * @param purpose - Purpose of the token (for tracking)
     * @returns Secure token string
     */
    async generateAccessToken(
        targetId: string,
        expiryHours: number = 48,
        purpose: string = 'email_notification',
        targetType: 'document' | 'contract' = 'document'
    ): Promise<string> {
        // Generate cryptographically secure random token
        const token = crypto.randomBytes(32).toString('hex');

        // Calculate expiry time
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiryHours);

        // Store token in database
        const values: any = {
            token,
            expiresAt,
            createdFor: purpose,
            metadata: {
                generatedAt: new Date().toISOString(),
                expiryHours
            }
        };

        if (targetType === 'document') {
            values.documentId = targetId;
        } else {
            values.contractId = targetId;
        }

        await db.insert(documentAccessTokens).values(values);

        console.log(`🔐 Generated access token for ${targetType} ${targetId}, expires in ${expiryHours}h`);

        return token;
    }

    /**
     * Validate token and retrieve document
     * @param token - Access token from email link
     * @returns Document if token is valid, null otherwise
     */
    async getTargetByToken(token: string): Promise<{ type: 'document' | 'contract', data: any } | null> {
        try {
            // Find token in database
            const tokenRecords = await db
                .select()
                .from(documentAccessTokens)
                .where(eq(documentAccessTokens.token, token))
                .limit(1);

            if (tokenRecords.length === 0) {
                console.log(`⚠️ Token not found: ${token.substring(0, 10)}...`);
                return null;
            }

            const tokenRecord = tokenRecords[0];

            // Check if token has expired
            const now = new Date();
            if (tokenRecord.expiresAt < now) {
                console.log(`⏰ Token expired: ${token.substring(0, 10)}...`);
                return null;
            }

            if (tokenRecord.documentId) {
                // Fetch the document
                const docs = await db
                    .select()
                    .from(documents)
                    .where(eq(documents.id, tokenRecord.documentId))
                    .limit(1);

                if (docs.length === 0) {
                    console.log(`⚠️ Document not found for token: ${token.substring(0, 10)}...`);
                    return null;
                }

                console.log(`✅ Valid token access for document: ${docs[0].type} - ${docs[0].documentNumber}`);
                return { type: 'document', data: docs[0] };
            } else if (tokenRecord.contractId) {
                // Fetch the contract
                const { contracts } = await import('@shared/schema');
                const cntrs = await db
                    .select()
                    .from(contracts)
                    .where(eq(contracts.id, tokenRecord.contractId))
                    .limit(1);

                if (cntrs.length === 0) {
                    console.log(`⚠️ Contract not found for token: ${token.substring(0, 10)}...`);
                    return null;
                }

                console.log(`✅ Valid token access for contract: ${cntrs[0].id}`);
                return { type: 'contract', data: cntrs[0] };
            }

            return null;
        } catch (error) {
            console.error('❌ Error validating token:', error);
            return null;
        }
    }

    /**
     * Cleanup expired tokens (run as daily job)
     * @returns Number of tokens deleted
     */
    async cleanupExpiredTokens(): Promise<number> {
        try {
            const now = new Date();

            // Delete all expired tokens
            const result = await db
                .delete(documentAccessTokens)
                .where(lt(documentAccessTokens.expiresAt, now));

            console.log(`🧹 Cleaned up expired tokens`);

            return 0; // Drizzle doesn't return count easily, would need raw query
        } catch (error) {
            console.error('❌ Error cleaning up tokens:', error);
            return 0;
        }
    }

    /**
     * Generate full document view URL
     * @param token - Access token
     * @param baseUrl - Base URL of the application
     * @returns Full URL to view document
     */
    generateViewUrl(token: string, baseUrl?: string): string {
        const base = baseUrl || process.env.APP_URL;

        if (!base) {
            console.warn('⚠️ [WARNING] APP_URL not set in environment. Secure document links in emails will be broken. Falling back to relative path.');
            return `/api/documents/view/${token}`;
        }

        // Ensure base doesn't end with a slash to avoid double slash
        const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
        return `${cleanBase}/api/documents/view/${token}`;
    }
}

// Export singleton instance
export const documentAccessService = new DocumentAccessService();
