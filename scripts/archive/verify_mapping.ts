
import { db } from './server/db';
import { documents, crewMembers } from './shared/schema';
import { eq } from 'drizzle-orm';

async function verifyMapping() {
    console.log('--- Document to Crew Mapping Report ---\n');

    const allDocs = await db.select().from(documents);
    const allCrew = await db.select().from(crewMembers);

    const crewMap = new Map();
    allCrew.forEach(c => crewMap.set(c.id, `${c.firstName} ${c.lastName}`));

    let mismatchCount = 0;

    for (const doc of allDocs) {
        const crewName = crewMap.get(doc.crewMemberId) || 'Unknown';
        const fileName = doc.filePath ? doc.filePath.split('/').pop() : 'NULL';

        // Simple check: does the filename contain at least one part of the crew name?
        const names = crewName.toLowerCase().split(' ');
        const lowerFile = fileName.toString().toLowerCase();

        const isLikelyMatch = names.some(n => n.length > 2 && lowerFile.includes(n));

        if (doc.filePath && !isLikelyMatch) {
            console.log(`❌ POTENTIAL MISMATCH:`);
            console.log(`   Crew: ${crewName}`);
            console.log(`   File: ${fileName}`);
            console.log(`   ID:   ${doc.id}\n`);
            mismatchCount++;
        } else if (doc.filePath) {
            console.log(`✅ MATCH: ${crewName} -> ${fileName}`);
        }
    }

    console.log(`\nFound ${mismatchCount} potential mismatches.`);
    process.exit(0);
}

verifyMapping().catch(console.error);
