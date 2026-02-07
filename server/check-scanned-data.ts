// Quick script to check scanned document data in database
import { db } from './db.js';
import { documents, scannedDocuments } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

async function checkScannedData() {
    try {
        console.log('=== Checking Recent Passport Documents ===\n');

        // Get recent passport documents
        const passports = await db
            .select()
            .from(documents)
            .where(eq(documents.type, 'passport'))
            .orderBy(desc(documents.createdAt))
            .limit(3);

        console.log(`Found ${passports.length} recent passport(s):\n`);

        for (const passport of passports) {
            console.log(`\n--- Passport Document ---`);
            console.log(`ID: ${passport.id}`);
            console.log(`Document Number: ${passport.documentNumber}`);
            console.log(`Crew Member ID: ${passport.crewMemberId}`);
            console.log(`Issuing Authority: ${passport.issuingAuthority}`);
            console.log(`Expiry Date: ${passport.expiryDate}`);
            console.log(`Created At: ${passport.createdAt}`);

            // Get scanned data for this document
            const scanned = await db
                .select()
                .from(scannedDocuments)
                .where(eq(scannedDocuments.documentId, passport.id))
                .orderBy(desc(scannedDocuments.createdAt))
                .limit(1);

            if (scanned.length > 0) {
                const scan = scanned[0];
                console.log(`\n  Scanned Data:`);
                console.log(`  - Scan ID: ${scan.id}`);
                console.log(`  - Created At: ${scan.createdAt}`);
                console.log(`  - Verification Score: ${scan.verificationScore}`);
                console.log(`  - Is Valid: ${scan.isValid}`);

                if (scan.rawOcrData) {
                    const ocrData = typeof scan.rawOcrData === 'string'
                        ? JSON.parse(scan.rawOcrData)
                        : scan.rawOcrData;

                    console.log(`\n  Raw OCR Data:`);
                    console.log(`  - Passport Number: ${ocrData.passportNumber || 'N/A'}`);
                    console.log(`  - MRZ Line 1: ${ocrData.mrzLine1 || 'N/A'}`);
                    console.log(`  - MRZ Line 2: ${ocrData.mrzLine2 || 'N/A'}`);
                    console.log(`  - MRZ Validation: ${ocrData.mrzValidation ? JSON.stringify(ocrData.mrzValidation) : 'N/A'}`);
                    console.log(`  - Holder Name: ${ocrData.holderName || ocrData.detectedHolderName || 'N/A'}`);
                    console.log(`  - Expiry Date: ${ocrData.expiryDate || ocrData.passportExpiryDate || 'N/A'}`);
                } else {
                    console.log(`  - No raw OCR data stored`);
                }
            } else {
                console.log(`  - No scanned data found`);
            }

            console.log('\n' + '='.repeat(50));
        }

    } catch (error) {
        console.error('Error querying database:', error);
    } finally {
        process.exit(0);
    }
}

checkScannedData();
