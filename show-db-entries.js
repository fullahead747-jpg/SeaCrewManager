import pg from 'pg';
import { config } from 'dotenv';

config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
});

async function showDatabaseEntries() {
    const client = await pool.connect();

    try {
        // Get documents table data
        const docsQuery = `
      SELECT 
        d.type,
        d.document_number,
        d.issue_date,
        d.expiry_date,
        d.issuing_authority,
        d.created_at
      FROM documents d
      JOIN crew_members cm ON d.crew_member_id = cm.id
      WHERE cm.first_name = 'VENKATARANGAN' 
        AND cm.last_name = 'BALAJI'
      ORDER BY d.created_at DESC
    `;

        const docsResult = await client.query(docsQuery);

        console.log('=== DOCUMENTS TABLE ===\n');
        if (docsResult.rows.length === 0) {
            console.log('No documents found');
        } else {
            docsResult.rows.forEach((row, index) => {
                console.log(`Document #${index + 1}:`);
                console.log(`  Type: ${row.type}`);
                console.log(`  Number: ${row.document_number}`);
                console.log(`  Issue Date: ${row.issue_date}`);
                console.log(`  Expiry Date: ${row.expiry_date}`);
                console.log(`  Issuing Authority: ${row.issuing_authority}`);
                console.log('');
            });
        }

        // Get scanned_documents table data
        const scannedQuery = `
      SELECT 
        sd.extracted_number,
        sd.extracted_issue_date,
        sd.extracted_expiry,
        sd.extracted_holder_name,
        sd.created_at
      FROM scanned_documents sd
      JOIN documents d ON sd.document_id = d.id
      JOIN crew_members cm ON d.crew_member_id = cm.id
      WHERE cm.first_name = 'VENKATARANGAN' 
        AND cm.last_name = 'BALAJI'
      ORDER BY sd.created_at DESC
    `;

        const scannedResult = await client.query(scannedQuery);

        console.log('=== SCANNED_DOCUMENTS TABLE ===\n');
        if (scannedResult.rows.length === 0) {
            console.log('No scanned documents found');
        } else {
            scannedResult.rows.forEach((row, index) => {
                console.log(`Scanned Record #${index + 1}:`);
                console.log(`  Extracted Number: ${row.extracted_number}`);
                console.log(`  Extracted Issue Date: ${row.extracted_issue_date}`);
                console.log(`  Extracted Expiry: ${row.extracted_expiry}`);
                console.log(`  Extracted Holder Name: ${row.extracted_holder_name}`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

showDatabaseEntries();
