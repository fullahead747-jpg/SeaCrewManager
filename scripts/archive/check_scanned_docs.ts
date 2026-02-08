
import { db } from './server/db';
import { scannedDocuments } from './shared/schema';
import { eq } from 'drizzle-orm';

async function checkScannedDocs() {
    const passportNo = 'U2701560'; // from user's screenshot
    console.log(`🔍 Checking scanned_documents cache for Passport ${passportNo}...`);

    try {
        const results = await db.select().from(scannedDocuments)
            .where(eq(scannedDocuments.extractedNumber, passportNo))
            .execute();

        if (results.length === 0) {
            console.log('❌ No cached scans found for this passport number.');
        } else {
            console.log(`✅ Found ${results.length} cached scan(s):`);
            results.forEach((res, i) => {
                console.log(`  [${i + 1}] ID: ${res.id}`);
                console.log(`      Extracted Expiry: ${res.extractedExpiry}`);
                console.log(`      Extracted Name:   ${res.extractedHolderName}`);
                console.log(`      Created At:       ${res.createdAt}`);
            });
        }
    } catch (error) {
        console.error('❌ Error checking scanned docs:', error);
    }

    process.exit(0);
}

checkScannedDocs();
