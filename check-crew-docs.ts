import { db } from './server/db';
import { crewMembers, documents } from '@shared/schema';

async function checkCrewAndDocuments() {
    console.log('Checking crew members and their documents...\n');

    // Get all crew members
    const allCrew = await db.select().from(crewMembers);
    console.log(`Total crew members: ${allCrew.length}\n`);

    if (allCrew.length > 0) {
        console.log('Sample crew members:');
        allCrew.slice(0, 5).forEach(crew => {
            console.log(`- ${crew.firstName} ${crew.lastName} (ID: ${crew.id})`);
        });
    }

    // Get all documents
    const allDocs = await db.select().from(documents);
    console.log(`\nTotal documents: ${allDocs.length}`);

    if (allDocs.length > 0) {
        console.log('\nDocument types breakdown:');
        const docTypeCount: Record<string, number> = {};
        allDocs.forEach(doc => {
            docTypeCount[doc.type] = (docTypeCount[doc.type] || 0) + 1;
        });
        Object.entries(docTypeCount).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
    } else {
        console.log('\n⚠️  No documents found in database!');
        console.log('This explains why AOA and other documents are not showing.');
    }

    // Check for KAM RAJU specifically
    const kamRaju = allCrew.find(c =>
        c.firstName.toUpperCase() === 'KAM' && c.lastName.toUpperCase() === 'RAJU'
    );

    if (kamRaju) {
        console.log(`\n✓ Found KAM RAJU (ID: ${kamRaju.id})`);
        const kamDocs = allDocs.filter(doc => doc.crewMemberId === kamRaju.id);
        console.log(`  Documents for KAM RAJU: ${kamDocs.length}`);
    }
}

checkCrewAndDocuments()
    .then(() => {
        console.log('\nCheck complete.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
