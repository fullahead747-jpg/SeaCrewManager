import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';
config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function test() {
    try {
        const tokens = await pool.query('SELECT token, expires_at, created_at, metadata FROM document_access_tokens ORDER BY created_at DESC LIMIT 1');
        if (tokens.rows.length > 0) {
            const t = tokens.rows[0];
            console.log('Latest Token:', t);

            const expiresAt = new Date(t.expires_at);
            const createdAt = new Date(t.created_at);

            console.log('Expires At (ISO):', expiresAt.toISOString());
            console.log('Created At (ISO):', createdAt.toISOString());
            console.log('Diff (ms):', expiresAt.getTime() - createdAt.getTime());

            if (t.metadata) {
                console.log('Metadata generatedAt:', t.metadata.generatedAt);
                console.log('Metadata expiryHours:', t.metadata.expiryHours);
            }
        } else {
            console.log('No tokens found.');
        }

        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

test();
