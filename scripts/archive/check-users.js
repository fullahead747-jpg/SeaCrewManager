import pg from 'pg';
import { config } from 'dotenv';
config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
});

async function checkUsers() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT id, username, name, role FROM users");
        console.log('--- Users in Database ---');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkUsers();
