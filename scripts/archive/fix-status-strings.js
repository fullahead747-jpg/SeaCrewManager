import pg from 'pg';
import { config } from 'dotenv';

config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
});

async function findWhitespaceErrors() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT id, first_name, status, status || '!' as status_check FROM crew_members");
        console.log('--- Status String Check ---');
        res.rows.forEach(row => {
            console.log(`Name: ${row.first_name}, Status: "${row.status}", Length: ${row.status.length}, Check: "${row.status_check}"`);
        });

        // Try to fix whitespace automatically
        console.log('\n--- Attempting Auto-Fix (Trim Whitespace) ---');
        const updateRes = await client.query("UPDATE crew_members SET status = TRIM(status)");
        console.log(`Updated ${updateRes.rowCount} records.`);

        // Force 'onBoard' case just in case
        console.log('\n--- Forcing Correct Case ("onBoard") ---');
        const forceRes = await client.query("UPDATE crew_members SET status = 'onBoard' WHERE status ILIKE 'onboard'");
        console.log(`Forced case on ${forceRes.rowCount} records.`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

findWhitespaceErrors();
