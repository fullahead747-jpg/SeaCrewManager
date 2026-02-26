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
        const res = await pool.query('SELECT * FROM document_access_tokens ORDER BY created_at DESC LIMIT 1');
        if (res.rows.length > 0) {
            console.log('DATA:', JSON.stringify(res.rows[0], null, 2));
        } else {
            console.log('No tokens.');
        }
        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

test();
