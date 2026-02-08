import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { crewMembers, documents, vesselDocuments } from './shared/schema';
import { eq, or, ilike } from 'drizzle-orm';
import { config } from 'dotenv';

config();

async function findSpecificAOA() {
    const isHelium = process.env.DATABASE_URL?.includes('helium');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isHelium ? false : { rejectUnauthorized: false }
    });

    const db = drizzle(pool);

    try {
        console.log('🔍 Searching for "SIGN ON AOA" or "Upendra" in multiple tables...');

        // Search in documents table
        console.log('\n--- Documents Table ---');
        const docs = await db.select().from(documents);
        const matches = docs.filter(d =>
            d.filePath?.toLowerCase().includes('aoa') ||
            d.type?.toLowerCase().includes('aoa') ||
            d.documentNumber?.toLowerCase().includes('aoa')
        );
        console.log(`Matches in documents: ${matches.length}`);
        matches.forEach(m => console.log(`  ID: ${m.id}, Type: ${m.type}, Path: ${m.filePath}`));

        // Search in vessel_documents table
        console.log('\n--- Vessel Documents Table ---');
        const vDocs = await db.select().from(vesselDocuments);
        const vMatches = vDocs.filter(d =>
            d.name?.toLowerCase().includes('aoa') ||
            d.fileName?.toLowerCase().includes('aoa') ||
            d.name?.toLowerCase().includes('upendra')
        );
        console.log(`Matches in vessel_documents: ${vMatches.length}`);
        vMatches.forEach(m => console.log(`  ID: ${m.id}, Name: ${m.name}, File: ${m.fileName}, Path: ${m.filePath}`));

        // Final check: look for any document with a non-null filePath for Upendra
        const upendraDocs = await db.select().from(documents).where(eq(documents.crewMemberId, '54542d2a-5bda-4236-8cdc-ff53cb546e16'));
        console.log('\n--- Upendra\'s Documents explicitly ---');
        upendraDocs.forEach(d => console.log(`  Type: ${d.type}, Path: ${d.filePath || 'NULL'}`));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

findSpecificAOA();
