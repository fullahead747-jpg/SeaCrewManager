import pg from 'pg';
import { config } from 'dotenv';

config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
});

async function deleteBadCachedData() {
    const client = await pool.connect();

    try {
        // Delete the bad cached data for BALAJI's passport
        const deleteQuery = `
      DELETE FROM scanned_documents 
      WHERE document_id IN (
        SELECT d.id 
        FROM documents d
        JOIN crew_members cm ON d.crew_member_id = cm.id
        WHERE cm.first_name = 'VENKATARANGAN' 
          AND cm.last_name = 'BALAJI' 
          AND d.type = 'passport'
      )
    `;

        const result = await client.query(deleteQuery);
        console.log(`✅ Deleted ${result.rowCount} bad cached record(s) from scanned_documents`);
        console.log('\nNow the system will use fresh OCR or manual data entry without interference from bad cache.');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

deleteBadCachedData();
