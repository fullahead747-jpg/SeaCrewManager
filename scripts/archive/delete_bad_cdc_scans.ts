import 'dotenv/config';
import { db } from './server/db';
import { scannedDocuments } from './shared/schema';
import { eq } from 'drizzle-orm';

async function deleteBadCDCScans() {
    console.log('🗑️  Deleting incorrect CDC scan entries...\n');

    try {
        const cdcDocId = '27a1be63-0bb1-4c1f-8d2a-21386e410fb7';

        // Delete all scanned entries for this CDC document
        const result = await db
            .delete(scannedDocuments)
            .where(eq(scannedDocuments.documentId, cdcDocId));

        console.log('✅ Deleted all CDC scan entries');
        console.log('\n📝 Now you can re-upload the CDC document and it will:');
        console.log('   1. Pass validation (no scan data to compare against)');
        console.log('   2. Run OCR.space extraction in background');
        console.log('   3. Create new scan entry with CORRECT dates');
        console.log('   4. Future edits will be validated against correct dates');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

deleteBadCDCScans();
