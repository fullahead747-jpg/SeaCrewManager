import { db } from './server/db';
import { scannedDocuments, crewMembers } from '@shared/schema';

async function checkScannedDocuments() {
    console.log('Checking scanned documents table...\n');

    // Get all scanned documents
    const allScanned = await db.select().from(scannedDocuments);

    console.log(`Total scanned documents: ${allScanned.length}\n`);

    if (allScanned.length > 0) {
        // Group by document type
        const typeCount: Record<string, number> = {};
        allScanned.forEach(doc => {
            typeCount[doc.documentType] = (typeCount[doc.documentType] || 0) + 1;
        });

        console.log('Scanned documents by type:');
        Object.entries(typeCount).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });

        console.log('\nSample scanned documents:');
        allScanned.slice(0, 5).forEach(doc => {
            console.log(`- Type: ${doc.documentType}`);
            console.log(`  Crew Member ID: ${doc.crewMemberId}`);
            console.log(`  Document Number: ${doc.extractedDocNumber || 'N/A'}`);
            console.log(`  Expiry: ${doc.extractedExpiry || 'N/A'}`);
            console.log(`  File: ${doc.filePath || 'No file'}`);
            console.log('');
        });
    } else {
        console.log('No scanned documents found.');
    }
}

checkScannedDocuments()
    .then(() => {
        console.log('Check complete.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
