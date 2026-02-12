
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
    console.log("🚀 Starting manual migration for TBD dates...");

    const client = await pool.connect();
    try {
        // 1. Make expiry_date nullable in the documents table
        console.log("🛠 Updating 'documents' table: making 'expiry_date' nullable...");
        await client.query(`
            ALTER TABLE documents 
            ALTER COLUMN expiry_date DROP NOT NULL;
        `);

        // 2. EnsureUpdatedAt exists (optional, but good for consistency)
        console.log("🛠 Ensuring 'updated_at' exists on 'documents'...");
        await client.query(`
            ALTER TABLE documents 
            ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
        `);

        console.log("✅ Migration successful: Database schema updated.");
    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

runMigration();
