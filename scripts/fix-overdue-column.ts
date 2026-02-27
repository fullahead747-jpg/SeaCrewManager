
import pg from 'pg';
import { config } from 'dotenv';

config();

async function fixDatabase() {
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL not found in environment');
        return;
    }

    const isHelium = process.env.DATABASE_URL.includes('helium');
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isHelium ? false : { rejectUnauthorized: false }
    });

    try {
        console.log('🔄 Attempting to add overdue_enabled column to email_settings...');

        // Add the column if it doesn't exist
        await pool.query(`
      ALTER TABLE email_settings 
      ADD COLUMN IF NOT EXISTS overdue_enabled BOOLEAN DEFAULT true;
    `);

        console.log('✅ Column overdue_enabled added successfully!');
    } catch (error) {
        console.error('❌ Failed to update database:', error);
    } finally {
        await pool.end();
    }
}

fixDatabase();
