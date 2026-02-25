import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function migrate() {
    console.log('🚀 Starting emergency migration: Adding contract_id to document_access_tokens...');

    try {
        // Add contract_id column
        await db.execute(sql`ALTER TABLE "document_access_tokens" ADD COLUMN IF NOT EXISTS "contract_id" text;`);
        console.log('✅ Added contract_id column (if it didn\'t exist)');

        // Make document_id nullable
        await db.execute(sql`ALTER TABLE "document_access_tokens" ALTER COLUMN "document_id" DROP NOT NULL;`);
        console.log('✅ Made document_id nullable');

        console.log('🎉 Migration successful!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
