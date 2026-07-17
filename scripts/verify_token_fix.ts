// @ts-nocheck
import { documentAccessService } from '../server/services/document-access-service.js';
import { db } from '../server/db.js';
import { documentAccessTokens } from '../shared/schema.js';
import { desc, eq } from 'drizzle-orm';

async function verify() {
    try {
        console.log('🧪 Testing token generation with 0.25 hours (15 mins)...');
        const token = await documentAccessService.generateAccessToken('test-id', 0.25, 'verification_test');

        const record = await db.select()
            .from(documentAccessTokens)
            .where(eq(documentAccessTokens.token, token))
            .limit(1);

        if (record.length === 0) {
            console.error('❌ Token not found in database!');
            process.exit(1);
        }

        const t = record[0];
        const now = new Date();
        const diffMs = t.expiresAt.getTime() - t.createdAt.getTime();
        const diffMins = diffMs / (60 * 1000);

        console.log(`Token: ${token.substring(0, 10)}...`);
        console.log(`Created At: ${t.createdAt.toISOString()}`);
        console.log(`Expires At: ${t.expiresAt.toISOString()}`);
        console.log(`Duration: ${diffMins.toFixed(2)} minutes`);

        if (Math.abs(diffMins - 15) < 1) {
            console.log('✅ Success! Token duration is approximately 15 minutes.');
        } else {
            console.error(`❌ Failure! Expected ~15 mins, got ${diffMins.toFixed(2)} mins`);
            process.exit(1);
        }

        // Cleanup
        await db.delete(documentAccessTokens).where(eq(documentAccessTokens.token, token));
        console.log('🧹 Cleanup complete.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during verification:', err);
        process.exit(1);
    }
}

verify();
