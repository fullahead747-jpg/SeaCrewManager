import pg from 'pg';
import { config } from 'dotenv';

config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
});

async function checkAllData() {
    const client = await pool.connect();

    try {
        // Check documents table
        const docsQuery = `
      SELECT COUNT(*) as count
      FROM documents d
      JOIN crew_members cm ON d.crew_member_id = cm.id
      WHERE cm.first_name = 'VENKATARANGAN' 
        AND cm.last_name = 'BALAJI'
    `;

        const docsResult = await client.query(docsQuery);
        console.log(`Documents table: ${docsResult.rows[0].count} records`);

        // Check scanned_documents table
        const scannedQuery = `
      SELECT COUNT(*) as count
      FROM scanned_documents sd
      JOIN documents d ON sd.document_id = d.id
      JOIN crew_members cm ON d.crew_member_id = cm.id
      WHERE cm.first_name = 'VENKATARANGAN' 
        AND cm.last_name = 'BALAJI'
    `;

        const scannedResult = await client.query(scannedQuery);
        console.log(`Scanned_documents table: ${scannedResult.rows[0].count} records`);

        // Check crew_members table
        const crewQuery = `
      SELECT COUNT(*) as count
      FROM crew_members
      WHERE first_name = 'VENKATARANGAN' 
        AND last_name = 'BALAJI'
    `;

        const crewResult = await client.query(crewQuery);
        console.log(`Crew_members table: ${crewResult.rows[0].count} records`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkAllData();
