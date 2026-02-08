
import pg from 'pg';
import { config } from 'dotenv';
config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkCounts() {
    const client = await pool.connect();
    try {
        console.log('--- DB COUNTS DIAGNOSTIC ---');

        const vessels = await client.query('SELECT COUNT(*) FROM vessels');
        console.log('Vessels:', vessels.rows[0].count);

        const crew = await client.query('SELECT COUNT(*) FROM crew_members');
        console.log('Crew Members:', crew.rows[0].count);

        const docs = await client.query('SELECT COUNT(*) FROM documents');
        console.log('Documents:', docs.rows[0].count);

        const contracts = await client.query('SELECT COUNT(*) FROM contracts');
        console.log('Contracts:', contracts.rows[0].count);

        if (vessels.rows[0].count > 0) {
            const firstVessel = await client.query('SELECT name FROM vessels LIMIT 1');
            console.log('Sample Vessel Name:', firstVessel.rows[0].name);
        }

        console.log('---------------------------');
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkCounts();
