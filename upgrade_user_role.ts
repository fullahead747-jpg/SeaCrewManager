import pg from 'pg';
import { config } from 'dotenv';
config();

async function run() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        console.log('--- UPGRADING USER ROLE ---');
        const res = await pool.query("UPDATE users SET role = 'admin' WHERE email = 'crewing@fullahead.in' RETURNING id, username, role, email");
        if (res.rows.length > 0) {
            console.log('SUCCESS: User role updated to admin');
            console.log(JSON.stringify(res.rows[0], null, 2));
        } else {
            console.log('WARNING: No user found with email crewing@fullahead.in');
        }
        console.log('---------------------------');
    } catch (error) {
        console.error('DATABASE ERROR:', error.message);
    } finally {
        await pool.end();
    }
}
run();
