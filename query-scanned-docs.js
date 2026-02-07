import pg from 'pg';
import { config } from 'dotenv';

config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
});

async function queryScannedDocuments() {
    const client = await pool.connect();

    try {
        const query = `
      SELECT 
        sd.extracted_number,
        sd.extracted_expiry,
        sd.extracted_issue_date,
        sd.extracted_holder_name,
        sd.created_at
      FROM scanned_documents sd
      JOIN documents d ON sd.document_id = d.id
      JOIN crew_members cm ON d.crew_member_id = cm.id
      WHERE cm.first_name = 'VENKATARANGAN' 
        AND cm.last_name = 'BALAJI' 
        AND d.type = 'passport'
      ORDER BY sd.created_at DESC
    `;

        const result = await client.query(query);

        if (result.rows.length === 0) {
            console.log('❌ NO DATA FOUND');
        } else {
            console.log('=== SCANNED DOCUMENTS DATA ===\n');
            result.rows.forEach((row, index) => {
                console.log(`Extracted Number: ${row.extracted_number}`);
                console.log(`Extracted Expiry: ${row.extracted_expiry}`);
                console.log(`Extracted Issue Date: ${row.extracted_issue_date}`);
                console.log(`Extracted Holder Name: ${row.extracted_holder_name || 'NULL'}`);
                console.log(`Created At: ${row.created_at}`);
            });
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

queryScannedDocuments();
