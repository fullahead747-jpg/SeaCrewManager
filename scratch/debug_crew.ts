import pg from 'pg';
import { config } from 'dotenv';
config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function debugCrew() {
    const client = await pool.connect();
    try {
        console.log('--- AMNS CREW DEBUG ---');
        // Find vessel AMNS
        const vesselRes = await client.query("SELECT * FROM vessels WHERE name LIKE '%AMNS%'");
        console.log('Vessels found:', vesselRes.rows);

        for (const vessel of vesselRes.rows) {
            console.log(`\n================ VESSEL: ${vessel.name} (ID: ${vessel.id}) ================`);
            
            // Get crew members
            const crewRes = await client.query(
                "SELECT * FROM crew_members WHERE current_vessel_id = $1",
                [vessel.id]
            );
            console.log(`Total crew members: ${crewRes.rows.length}`);

            for (const member of crewRes.rows) {
                const name = `${member.first_name} ${member.last_name}`;
                console.log(`\nCrew Member: ${name} (ID: ${member.id})`);
                console.log(`Rank: ${member.rank}, Status: ${member.status}`);

                // Get active contract
                const contractRes = await client.query(
                    "SELECT * FROM contracts WHERE crew_member_id = $1 AND status = 'active'",
                    [member.id]
                );
                const activeContract = contractRes.rows[0];
                if (activeContract) {
                    console.log(`Contract: Start=${activeContract.start_date.toISOString().split('T')[0]}, End=${activeContract.end_date.toISOString().split('T')[0]}, Status=${activeContract.status}`);
                } else {
                    console.log('Contract: None active');
                }

                // Get documents
                const docsRes = await client.query(
                    "SELECT * FROM documents WHERE crew_member_id = $1",
                    [member.id]
                );
                console.log('Documents:');
                for (const doc of docsRes.rows) {
                    const expiry = doc.expiry_date ? doc.expiry_date.toISOString().split('T')[0] : 'N/A';
                    console.log(`  - Type: ${doc.type}, No: ${doc.document_number}, Expiry: ${expiry}, Status: ${doc.status}`);
                }
            }
        }
    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

debugCrew();
