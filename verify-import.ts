import { db } from './server/db';
import { documents, crewMembers } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function verifyImport() {
    console.log('Verifying document import...\n');

    // Check total documents
    const allDocs = await db.select().from(documents);
    console.log(`Total documents in database: ${allDocs.length}\n`);

    // Group by type
    const typeCount: Record<string, number> = {};
    allDocs.forEach(doc => {
        typeCount[doc.type] = (typeCount[doc.type] || 0) + 1;
    });

    console.log('Documents by type:');
    Object.entries(typeCount).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });

    // Check KAM RAJU specifically
    const kamRaju = await db.select().from(crewMembers).where(
        eq(crewMembers.id, '02e81248-c5a5-4879-a655-401c9f90bd03')
    );

    if (kamRaju.length > 0) {
        console.log(`\n✓ Found KAM RAJU`);

        const kamDocs = await db.select().from(documents).where(
            eq(documents.crewMemberId, kamRaju[0].id)
        );

        console.log(`  Documents for KAM RAJU: ${kamDocs.length}`);

        if (kamDocs.length > 0) {
            console.log('\n  Document details:');
            kamDocs.forEach(doc => {
                console.log(`    - ${doc.type.toUpperCase()}: ${doc.documentNumber}`);
                console.log(`      Issue: ${doc.issueDate.toISOString().split('T')[0]}`);
                console.log(`      Expiry: ${doc.expiryDate.toISOString().split('T')[0]}`);
                console.log(`      Authority: ${doc.issuingAuthority}`);
                console.log(`      File: ${doc.filePath}`);
                console.log('');
            });
        }
    }

    // Show sample of crew members with documents
    console.log('\nSample crew members with documents:');
    const crewWithDocs = new Map<string, number>();
    allDocs.forEach(doc => {
        crewWithDocs.set(doc.crewMemberId, (crewWithDocs.get(doc.crewMemberId) || 0) + 1);
    });

    const allCrew = await db.select().from(crewMembers);
    let count = 0;
    for (const crew of allCrew) {
        const docCount = crewWithDocs.get(crew.id) || 0;
        if (docCount > 0 && count < 5) {
            console.log(`  ${crew.firstName} ${crew.lastName}: ${docCount} documents`);
            count++;
        }
    }

    console.log(`\nTotal crew members with documents: ${crewWithDocs.size}/${allCrew.length}`);
}

verifyImport()
    .then(() => {
        console.log('\nVerification complete.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
