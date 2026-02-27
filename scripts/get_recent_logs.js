
import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';
config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function getLastLogs() {
    try {
        console.log('--- Last 20 Activity Logs ---');
        const activities = await pool.query('SELECT "created_at", "type", "action", "description", "severity" FROM activity_logs ORDER BY "created_at" DESC LIMIT 20');
        console.table(activities.rows);

        console.log('\n--- Startup Events (Type: System or Server) ---');
        const startups = await pool.query('SELECT "created_at", "type", "description" FROM activity_logs WHERE description ILIKE \'%started%\' OR description ILIKE \'%initialized%\' ORDER BY "created_at" DESC LIMIT 10');
        console.table(startups.rows);

        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

getLastLogs();
