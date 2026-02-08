import pg from 'pg';
import { config } from 'dotenv';
import fs from 'fs';

config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
});

async function restoreDatabase() {
    console.log('🚀 Starting Simplified Database Restoration...');
    const backupPath = 'local-db-backup.json';

    if (!fs.existsSync(backupPath)) {
        console.error('❌ Backup file not found.');
        return;
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Clear existing data (in reverse order of dependencies)
        const tablesToClear = [
            'scanned_documents',
            'documents',
            'contracts',
            'crew_members',
            'vessels'
        ];

        console.log('🗑️ Clearing existing data...');
        for (const table of tablesToClear) {
            try {
                await client.query(`DELETE FROM ${table}`);
            } catch (e) {
                console.log(`⚠️ Note: Could not clear table ${table}`);
            }
        }

        // Restore data (in dependency order) - ONLY core tables
        const tablesToRestore = [
            'vessels',
            'crew_members',
            'contracts',
            'documents',
            'scanned_documents'
        ];

        for (const table of tablesToRestore) {
            const rows = backupData[table];
            if (!rows || rows.length === 0) {
                console.log(`⏭️ Skipping ${table} (no data)`);
                continue;
            }

            console.log(`📥 Restoring ${rows.length} records into ${table}...`);

            const columns = Object.keys(rows[0]);
            const queryText = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`;

            for (const row of rows) {
                const values = columns.map(col => row[col]);
                try {
                    await client.query(queryText, values);
                } catch (err) {
                    console.error(`❌ Error inserting into ${table}:`, err.message);
                    throw err;
                }
            }
        }

        await client.query('COMMIT');
        console.log('✅ Restoration completed successfully!');
        console.log('🎉 Your Replit database now has your local data.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Restoration failed:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

restoreDatabase();
