import pg from 'pg';
import { config } from 'dotenv';

config();

async function createSessionTable() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('helium') ? false : { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
        console.log('Creating session table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL PRIMARY KEY,
        "sess" jsonb NOT NULL,
        "expire" timestamp(6) NOT NULL
      );
    `);

        console.log('Creating index on expire...');
        await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

        console.log('Session table created successfully.');
    } catch (err) {
        console.error('Failed to create session table:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

createSessionTable();
