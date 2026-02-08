import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { documents, crewMembers } from './shared/schema';
import { eq, desc } from 'drizzle-orm';
import { config } from 'dotenv';

config();

async function checkRecentUploads() {
    const isHelium = process.env.DATABASE_URL?.includes('helium');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isHelium ? false : { rejectUnauthorized: false }
    });

    const db = drizzle(pool);

    try {
        console.log('🔍 Checking for cloud-stored documents for Upendra Kumar...');

        const upendraId = '54542d2a-5bda-4236-8cdc-ff53cb546e16';
        const recentDocs = await db.select()
            .from(documents)
            .where(eq(documents.crewMemberId, upendraId))
            .orderBy(desc(documents.createdAt))
            .limit(20);

        const cloudDocs = recentDocs.filter(doc => doc.filePath?.startsWith('/replit-objstore'));

        console.log(`\n📄 Found ${cloudDocs.length} cloud-stored documents for Upendra.`);

        cloudDocs.forEach((doc, idx) => {
            console.log(`\n[${idx + 1}] Type: ${doc.type}`);
            console.log(`    Number: ${doc.documentNumber}`);
            console.log(`    File Path: ${doc.filePath}`);
            console.log(`    Created: ${doc.createdAt}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkRecentUploads();
