import pg from 'pg';
const { Pool } = pg;

async function run() {
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL environment variable is missing');
        return;
    }

    console.log('🔗 Connecting to database...');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // We add IF NOT EXISTS to make it idempotent
        const query = 'ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "last_health_category" text;';
        console.log('🚀 Running migration...');
        await pool.query(query);
        console.log('✅ Column "last_health_category" added successfully (or already exists)!');
    } catch (e: any) {
        console.error('❌ Migration failed:', e.message);
    } finally {
        await pool.end();
    }
}

run();
