import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { crewMembers, documents } from './shared/schema';
import { eq, or, ilike } from 'drizzle-orm';
import { config } from 'dotenv';

config();

async function findAnyAOA() {
    const isHelium = process.env.DATABASE_URL?.includes('helium');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isHelium ? false : { rejectUnauthorized: false }
    });

    const db = drizzle(pool);

    try {
        console.log('🔍 Searching all documents for "AOA"...');

        const allDocs = await db.select().from(documents);

        const aoaDocs = allDocs.filter(doc =>
            doc.type?.toUpperCase().includes('AOA') ||
            doc.documentNumber?.toUpperCase().includes('AOA') ||
            (doc as any).metadata?.toString().includes('AOA')
        );

        console.log(`\n📄 Found ${aoaDocs.length} total AOA documents in database.`);

        for (const doc of aoaDocs) {
            const crew = await db.select().from(crewMembers).where(eq(crewMembers.id, doc.crewMemberId)).limit(1);
            const crewName = crew.length > 0 ? `${crew[0].firstName} ${crew[0].lastName}` : 'Unknown';

            console.log(`\n- Crew: ${crewName} (ID: ${doc.crewMemberId})`);
            console.log(`  Type: ${doc.type}`);
            console.log(`  Number: ${doc.documentNumber}`);
            console.log(`  File Path: ${doc.filePath || 'NULL'}`);
            console.log(`  Storage: ${doc.filePath?.startsWith('/') ? '☁️ CLOUD' : (doc.filePath ? '💻 LOCAL' : '❌ NONE')}`);
        }

        if (aoaDocs.length === 0) {
            console.log('\n❌ No documents found with "AOA" in type or number.');
            console.log('\nTop 10 most recent documents:');
            const recent = allDocs.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)).slice(0, 10);
            recent.forEach(doc => {
                console.log(`  - Type: ${doc.type}, Number: ${doc.documentNumber}, Path: ${doc.filePath}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

findAnyAOA();
