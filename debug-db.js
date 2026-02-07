import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function debugData() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('--- Database Check ---');

        // Check Users
        const usersRes = await pool.query('SELECT * FROM users');
        console.log(`Users (${usersRes.rowCount}):`, usersRes.rows.map(u => ({ username: u.username, name: u.name })));

        // Check Vessels
        const vesselsRes = await pool.query('SELECT * FROM vessels');
        console.log(`Vessels (${vesselsRes.rowCount}):`, vesselsRes.rows.map(v => v.name));

        // Check Crew
        const crewRes = await pool.query('SELECT * FROM crew_members');
        console.log(`Crew Members (${crewRes.rowCount})`);

    } catch (err) {
        console.error('Debug failed:', err);
    } finally {
        await pool.end();
    }
}

debugData();
