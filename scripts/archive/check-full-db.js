import pg from 'pg';
import { config } from 'dotenv';
config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
});

async function listTables() {
    const client = await pool.connect();
    try {
        console.log('--- Database Table Check ---');
        const res = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
        `);

        for (const row of res.rows) {
            const table = row.table_name;
            const countRes = await client.query('SELECT count(*) FROM "' + table + '"');
            console.log('Table: ' + table + ', Rows: ' + countRes.rows[0].count);
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

listTables();
