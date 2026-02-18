
import { storage } from './server/storage';
import { db } from './server/db';
import { documents, crewMembers } from './shared/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
    const targetNum = 'MAH/MUM/327/2023';
    const normalizedTarget = targetNum.replace(/[\s\-\/\.]/g, '').toUpperCase();

    console.log(`Searching for document number: ${targetNum} (Normalized: ${normalizedTarget})`);

    const allDocs = await db.select().from(documents);
    const matches = allDocs.filter(doc => {
        const docNum = doc.documentNumber.replace(/[\s\-\/\.]/g, '').toUpperCase();
        return docNum === normalizedTarget;
    });

    console.log(`Found ${matches.length} matches:`);

    for (const doc of matches) {
        const [crew] = await db.select().from(crewMembers).where(eq(crewMembers.id, doc.crewMemberId));
        console.log(`- Document ID: ${doc.id}`);
        console.log(`  Type: ${doc.type}`);
        console.log(`  Crew Member: ${crew ? `${crew.firstName} ${crew.lastName} (ID: ${crew.id})` : 'Unknown'}`);
        console.log(`  Document Number: ${doc.documentNumber}`);
    }
}

main().catch(console.error);
