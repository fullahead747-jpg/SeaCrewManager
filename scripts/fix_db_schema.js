import pkg from 'pg';
const { Client } = pkg;
import { config } from 'dotenv';
config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected.');

        const infoRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'document_access_tokens'");
        const columns = infoRes.rows;
        console.log('Current Schema:', columns);

        async function ensureTimestamptz(columnName) {
            const col = columns.find(c => c.column_name === columnName);
            if (!col) {
                console.log(`Column ${columnName} not found.`);
                return;
            }

            if (col.data_type === 'timestamp with time zone') {
                console.log(`Column ${columnName} is already timestamptz.`);
                return;
            }

            console.log(`Converting ${columnName} to timestamptz...`);
            // Convert timestamp without TZ to with TZ assuming the original is UTC
            await client.query(`ALTER TABLE document_access_tokens ALTER COLUMN ${columnName} TYPE timestamptz USING ${columnName} AT TIME ZONE 'UTC'`);
            console.log(`Successfully converted ${columnName}.`);
        }

        await ensureTimestamptz('expires_at');
        await ensureTimestamptz('used_at');
        await ensureTimestamptz('created_at');

        console.log('Schema update process complete.');
    } catch (err) {
        console.error('Error updating schema:', err);
    } finally {
        await client.end();
    }
}

run();
