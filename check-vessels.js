const { Pool } = require('pg');
require('dotenv').config();

async function checkVessels() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query('SELECT name, "imoNumber", status FROM vessels');
        console.log('--- Vessels in Database ---');
        console.table(res.rows);
    } catch (err) {
        console.error('Error querying vessels:', err);
    } finally {
        await pool.end();
    }
}

checkVessels();
