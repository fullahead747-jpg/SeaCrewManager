
import pg from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

if (!process.env.DATABASE_URL) {
    console.error("❌ ERROR: DATABASE_URL must be set.");
    process.exit(1);
}

const isHelium = process.env.DATABASE_URL?.includes('helium');
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isHelium ? false : { rejectUnauthorized: false }
});

async function runMigration() {
    console.log("🚀 Starting emergency migration...");

    const client = await pool.connect();
    try {
        // Add the coc_not_applicable column if it doesn't exist
        console.log("🛠 Adding 'coc_not_applicable' column to 'crew_members' table...");
        await client.query(`
      ALTER TABLE crew_members 
      ADD COLUMN IF NOT EXISTS coc_not_applicable boolean DEFAULT false;
    `);

        console.log("✅ Migration successful: Column added (or already existed).");
    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

runMigration();
