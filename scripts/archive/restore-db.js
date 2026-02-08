import pg from 'pg';
import { config } from 'dotenv';
import fs from 'fs';

config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
});

async function restoreDatabase() {
    console.log('🚀 Starting Database Restoration...');
    const backupPath = 'local-db-backup.json';

    if (!fs.existsSync(backupPath)) {
        console.error('❌ Backup file not found. Please run backup-db.js first.');
        return;
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Clear existing data (in reverse order of dependencies)
        const tablesToClear = [
            'scanned_documents',
            'documents',
            'contracts',
            'crew_members',
            'vessels',
            'activity_logs',
            'status_change_history',
            'notification_history',
            'whatsapp_messages',
            'users'
        ];

        console.log('🗑️ Clearing existing live data...');
        for (const table of tablesToClear) {
            try {
                await client.query(`DELETE FROM ${table}`);
            } catch (e) {
                console.log(`⚠️ Note: Could not clear table ${table} (it might not exist yet)`);
            }
        }

        // 2. Restore data (in dependency order)
        const tablesToRestore = [
            'users',
            'vessels',
            'crew_members',
            'contracts',
            'documents',
            'scanned_documents',
            'email_settings',
            'whatsapp_settings',
            'activity_logs'
        ];

        for (const table of tablesToRestore) {
            const rows = backupData[table];
            if (!rows || rows.length === 0) continue;

            console.log(`📥 Restoring ${rows.length} records into ${table}...`);

            const columns = Object.keys(rows[0]);
            const queryText = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`;

            for (const row of rows) {
                const values = columns.map(col => row[col]);
                await client.query(queryText, values);
            }
        }

        await client.query('COMMIT');
        console.log('✅ Restoration completed successfully!');
        console.log('🎉 Your live site now has identical data to your localhost.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Restoration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

restoreDatabase();
