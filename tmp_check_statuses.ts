import pg from 'pg';
import { config } from 'dotenv';
config();

async function run() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        console.log('--- DETAILED STATS ---');
        
        const crew = await pool.query("SELECT status, count(*) FROM crew_members GROUP BY status");
        console.log('CREW STATUSES:');
        console.table(crew.rows);
        
        const vessels = await pool.query("SELECT status, count(*) FROM vessels GROUP BY status");
        console.log('VESSEL STATUSES:');
        console.table(vessels.rows);
        
        console.log('---------------------------');
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await pool.end();
    }
}
run();
