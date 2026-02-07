// Load environment variables FIRST
import { config } from 'dotenv';
config();

// Check if document exists and its deletion status
import { db } from './db.js';
import { documents, scannedDocuments } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function checkDocumentDeletion() {
    try {
        console.log('=== Checking Document Deletion Status ===\n');

        // Check for the specific document
        const doc = await db
            .select()
            .from(documents)
            .where(eq(documents.id, 'ad6a9fdc-a012-45a4-8a1a-b2f5e0c0a6a7'));

        if (doc.length > 0) {
            console.log('❌ DOCUMENT STILL EXISTS IN DATABASE');
            console.log(`   Document ID: ${doc[0].id}`);
            console.log(`   Document Number: ${doc[0].documentNumber}`);
            console.log(`   Type: ${doc[0].type}`);
            console.log(`   Created At: ${doc[0].createdAt}`);
        } else {
            console.log('✅ DOCUMENT DELETED FROM DATABASE');
        }

        // Check for scanned documents
        const scans = await db
            .select()
            .from(scannedDocuments)
            .where(eq(scannedDocuments.documentId, 'ad6a9fdc-a012-45a4-8a1a-b2f5e0c0a6a7'));

        console.log(`\nScanned Documents: ${scans.length} found`);
        if (scans.length > 0) {
            console.log('❌ SCANNED DATA STILL EXISTS');
            console.log(`   Total scans: ${scans.length}`);
        } else {
            console.log('✅ SCANNED DATA DELETED');
        }

        // Check all passport documents
        const allPassports = await db
            .select()
            .from(documents)
            .where(eq(documents.type, 'passport'));

        console.log(`\n=== All Passport Documents ===`);
        console.log(`Total: ${allPassports.length}`);

        if (allPassports.length === 0) {
            console.log('✅ NO PASSPORT DOCUMENTS IN DATABASE - READY FOR FRESH TEST');
        } else {
            console.log('\nExisting passports:');
            allPassports.forEach((p, i) => {
                console.log(`  ${i + 1}. ID: ${p.id}, Number: ${p.documentNumber}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkDocumentDeletion();
