
import pg from 'pg';
import { config } from 'dotenv';
config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkExpiries() {
    const client = await pool.connect();
    try {
        console.log('--- DB EXPIRY DIAGNOSTIC ---');

        const now = new Date();

        // Total expired in dashboard's view
        const dashboardExpired = await client.query('SELECT COUNT(*) FROM documents WHERE expiry_date IS NOT NULL AND expiry_date <= $1', [now]);
        console.log('Dashboard Expired Count (technically past):', dashboardExpired.rows[0].count);

        // Drilldown's view
        const drilldownExpired = await client.query('SELECT COUNT(*) FROM documents WHERE expiry_date IS NOT NULL AND expiry_date < $1 AND EXTRACT(YEAR FROM expiry_date) > 1900', [now]);
        console.log('Drilldown Expired Count (year > 1900):', drilldownExpired.rows[0].count);

        // TBD count
        const tbdCount = await client.query('SELECT COUNT(*) FROM documents WHERE expiry_date IS NOT NULL AND EXTRACT(YEAR FROM expiry_date) <= 1900');
        console.log('Documents with Year <= 1900 (TBD):', tbdCount.rows[0].count);

        // Group by crew member for drilldown
        const crewDocCount = await client.query(`
            SELECT crew_member_id, COUNT(*) 
            FROM documents 
            WHERE expiry_date IS NOT NULL AND expiry_date < $1 AND EXTRACT(YEAR FROM expiry_date) > 1900 
            GROUP BY crew_member_id
        `, [now]);
        console.log('Crew Members with expired documents (year > 1900):', crewDocCount.rowCount);


        console.log('---------------------------');
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkExpiries();
