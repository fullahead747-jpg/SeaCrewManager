import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { crewMembers, documents } from './shared/schema';
import { eq, or, ilike } from 'drizzle-orm';
import { config } from 'dotenv';

config();

async function checkAOA() {
    const isHelium = process.env.DATABASE_URL?.includes('helium');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isHelium ? false : { rejectUnauthorized: false }
    });

    const db = drizzle(pool);

    try {
        console.log('🔍 Searching for Upendra Kumar and AOA documents...');

        const crew = await db.select().from(crewMembers);
        const upendra = crew.find(c =>
            (c.firstName?.toUpperCase().includes('UPENDRA') && c.lastName?.toUpperCase().includes('KUMAR')) ||
            (c.firstName?.toUpperCase().includes('UPENDRA') || c.lastName?.toUpperCase().includes('KUMAR'))
        );

        if (!upendra) {
            console.log('❌ Upendra Kumar not found.');
            return;
        }

        console.log(`✅ Found Crew Member: ${upendra.firstName} ${upendra.lastName} (ID: ${upendra.id})`);

        const allDocs = await db.select().from(documents).where(eq(documents.crewMemberId, upendra.id));

        console.log(`\n📄 Total documents for Upendra: ${allDocs.length}`);

        allDocs.forEach(doc => {
            const isAOA = doc.type?.toUpperCase().includes('AOA') ||
                doc.documentNumber?.toUpperCase().includes('AOA') ||
                doc.issuingAuthority?.toUpperCase().includes('AOA');

            const storageType = doc.filePath?.startsWith('/') ? '☁️ CLOUD' : (doc.filePath ? '💻 LOCAL' : '❌ NONE');

            console.log(`\n- Document: ${doc.type}`);
            console.log(`  Number: ${doc.documentNumber}`);
            console.log(`  File Path: ${doc.filePath || 'NULL'}`);
            console.log(`  Storage: ${storageType}`);
            if (isAOA) console.log('  🎯 THIS LOOKS LIKE THE AOA FORM!');
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkAOA();
