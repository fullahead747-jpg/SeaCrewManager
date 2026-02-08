import pg from 'pg';
import { config } from 'dotenv';

config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
});

async function checkDatabaseState() {
    console.log('🔍 Checking Database State...\n');
    const client = await pool.connect();

    try {
        // Check crew members
        const crewResult = await client.query('SELECT id, first_name, last_name, rank, status FROM crew_members ORDER BY created_at DESC');
        console.log(`👥 Crew Members (${crewResult.rows.length}):`);
        crewResult.rows.forEach((crew, i) => {
            console.log(`  ${i + 1}. ${crew.first_name} ${crew.last_name} - ${crew.rank} (${crew.status})`);
        });

        // Check vessels
        const vesselResult = await client.query('SELECT id, name, type, status FROM vessels ORDER BY sort_order');
        console.log(`\n🚢 Vessels (${vesselResult.rows.length}):`);
        vesselResult.rows.forEach((vessel, i) => {
            console.log(`  ${i + 1}. ${vessel.name} - ${vessel.type} (${vessel.status})`);
        });

        // Check documents
        const docResult = await client.query('SELECT COUNT(*) as count FROM documents');
        console.log(`\n📄 Documents: ${docResult.rows[0].count}`);

        // Check contracts
        const contractResult = await client.query('SELECT COUNT(*) as count FROM contracts WHERE status = \'active\'');
        console.log(`📋 Active Contracts: ${contractResult.rows[0].count}`);

        console.log('\n✅ Database check complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkDatabaseState();
