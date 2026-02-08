import { Client } from 'pg';
import { config } from 'dotenv';

config();

async function introspectTable() {
    const isHelium = process.env.DATABASE_URL?.includes('helium');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: isHelium ? false : { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('🔍 Checking columns for table: scanned_documents');

        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'scanned_documents'
            ORDER BY ordinal_position;
        `);

        if (res.rows.length === 0) {
            console.log('❌ Table "scanned_documents" not found!');
        } else {
            console.log('\nColumns in "scanned_documents":');
            res.rows.forEach(col => {
                console.log(`- ${col.column_name} (${col.data_type})`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

introspectTable();
