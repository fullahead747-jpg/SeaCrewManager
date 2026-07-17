// @ts-nocheck
import pg from 'pg';
import { config } from 'dotenv';

config();

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set.");
}

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('helium') ? false : { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration...');

        // Check if columns exist
        const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'reset_token';
    `);

        if (checkRes.rowCount === 0) {
            console.log('Adding reset_token and reset_token_expiry to users table...');
            await client.query(`
        ALTER TABLE users 
        ADD COLUMN reset_token TEXT,
        ADD COLUMN reset_token_expiry TIMESTAMP;
      `);
            console.log('Migration successful.');
        } else {
            console.log('Columns already exist. No migration needed.');
        }
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
