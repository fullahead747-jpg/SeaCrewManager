// @ts-nocheck
import pg from 'pg';
import { config } from 'dotenv';

config();

async function inspectDB() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('helium') ? false : { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
        console.log('Listing tables:');
        const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
        tables.rows.forEach(r => console.log(`- ${r.table_name}`));

        console.log('\nChecking for "session" table details:');
        const sessionTable = tables.rows.find(r => r.table_name === 'session');
        if (sessionTable) {
            const columns = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'session';
      `);
            console.log('Session table columns:');
            columns.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
        } else {
            console.log('Session table does not exist.');
        }
    } catch (err) {
        console.error('Inspection failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

inspectDB();
