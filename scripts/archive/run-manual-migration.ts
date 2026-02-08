import { Client } from 'pg';
import { config } from 'dotenv';

config();

async function runMigration() {
    const isHelium = process.env.DATABASE_URL?.includes('helium');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: isHelium ? false : { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('🚀 Running manual migration: Adding extracted_issuing_authority to scanned_documents');

        // Check if column exists first to be safe
        const checkRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'scanned_documents' AND column_name = 'extracted_issuing_authority';
        `);

        if (checkRes.rows.length === 0) {
            console.log('➕ Column missing. Adding it now...');
            await client.query(`
                ALTER TABLE scanned_documents 
                ADD COLUMN IF NOT EXISTS extracted_issuing_authority TEXT;
            `);
            console.log('✅ Column "extracted_issuing_authority" added successfully.');
        } else {
            console.log('ℹ️ Column "extracted_issuing_authority" already exists.');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await client.end();
    }
}

runMigration();
