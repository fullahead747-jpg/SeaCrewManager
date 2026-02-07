import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkTables() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.log('Tables found:', res.rows.map(r => r.table_name));
    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await pool.end();
    }
}

checkTables();
