// @ts-nocheck
import { db } from '../server/db.js';
import { documentAccessTokens } from '../shared/schema.js';
import { desc } from 'drizzle-orm';

async function checkTokens() {
    try {
        console.log('🔍 Checking latest document access tokens...');
        const tokens = await db.select().from(documentAccessTokens).orderBy(desc(documentAccessTokens.createdAt)).limit(10);

        if (tokens.length === 0) {
            console.log('❌ No tokens found in the database.');
        } else {
            console.table(tokens.map(t => ({
                id: t.id,
                token: t.token.substring(0, 10) + '...',
                expiresAt: t.expiresAt,
                createdFor: t.createdFor,
                createdAt: t.createdAt
            })));
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkTokens();
