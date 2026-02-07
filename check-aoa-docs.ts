import { db } from './server/db';
import { documents } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function checkAOADocuments() {
    console.log('Checking for AOA documents in the database...\n');

    // Get all documents
    const allDocs = await db.select().from(documents);

    console.log(`Total documents in database: ${allDocs.length}`);

    // Filter AOA documents
    const aoaDocs = allDocs.filter(doc => doc.type === 'aoa');

    console.log(`\nAOA documents found: ${aoaDocs.length}`);

    if (aoaDocs.length > 0) {
        console.log('\nAOA Documents:');
        aoaDocs.forEach(doc => {
            console.log(`- Crew Member ID: ${doc.crewMemberId}`);
            console.log(`  Document Number: ${doc.documentNumber}`);
            console.log(`  Issuing Authority: ${doc.issuingAuthority}`);
            console.log(`  Issue Date: ${doc.issueDate}`);
            console.log(`  Expiry Date: ${doc.expiryDate}`);
            console.log(`  File Path: ${doc.filePath || 'No file'}`);
            console.log('');
        });
    } else {
        console.log('\nNo AOA documents found in the database.');
        console.log('\nChecking all document types:');
        const docTypes = new Set(allDocs.map(doc => doc.type));
        console.log('Document types in database:', Array.from(docTypes));
    }
}

checkAOADocuments()
    .then(() => {
        console.log('Check complete.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
