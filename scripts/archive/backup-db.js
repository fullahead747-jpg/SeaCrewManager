import pg from 'pg';
import { config } from 'dotenv';
import fs from 'fs';

config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
});

async function backupDatabase() {
    console.log('🚀 Starting Database Backup...');
    const client = await pool.connect();

    try {
        const tables = [
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

        const backupData = {};

        for (const table of tables) {
            console.log(`📦 Exporting table: ${table}...`);
            const result = await client.query(`SELECT * FROM ${table}`);
            backupData[table] = result.rows;
        }

        const backupPath = 'local-db-backup.json';
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

        console.log(`✅ Backup completed successfully!`);
        console.log(`📂 File saved to: ${backupPath}`);
        console.log(`📊 Total tables exported: ${tables.length}`);

    } catch (error) {
        console.error('❌ Backup failed:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

backupDatabase();
