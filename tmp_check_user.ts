import pg from 'pg';
import { config } from 'dotenv';
config();

async function run() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        const res = await pool.query("SELECT id, username, email, role FROM users WHERE email ILIKE 'crewing@fullahead.in'");
        console.log('--- USER DATA ---');
        console.log(JSON.stringify(res.rows, null, 2));
        console.log('-----------------');
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await pool.end();
    }
}
run();
