import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { crewMembers, contracts } from './shared/schema';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

config();

async function checkContracts() {
    const isHelium = process.env.DATABASE_URL?.includes('helium');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isHelium ? false : { rejectUnauthorized: false }
    });

    const db = drizzle(pool);

    try {
        console.log('🔍 Checking contracts table for Upendra Kumar...');

        const upendraId = '54542d2a-5bda-4236-8cdc-ff53cb546e16';
        const upendraContracts = await db.select().from(contracts).where(eq(contracts.crewMemberId, upendraId));

        console.log(`\n📄 Found ${upendraContracts.length} contracts for Upendra.`);

        upendraContracts.forEach(c => {
            console.log(`\n- Contract ID: ${c.id}`);
            console.log(`  Number: ${c.contractNumber}`);
            console.log(`  Type: ${c.contractType}`);
            console.log(`  Status: ${c.status}`);
            console.log(`  File Path: ${c.filePath || 'NULL'}`);
            console.log(`  Storage: ${c.filePath?.startsWith('/') ? '☁️ CLOUD' : (c.filePath ? '💻 LOCAL' : '❌ NONE')}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkContracts();
