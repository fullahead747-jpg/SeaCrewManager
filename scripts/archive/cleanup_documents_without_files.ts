import { db } from './server/db';
import { documents } from '@shared/schema';
import { isNull } from 'drizzle-orm';

async function cleanupDocumentsWithoutFiles() {
    try {
        console.log('🧹 Cleaning up documents without files...\n');

        // Find all documents without file paths
        const docsWithoutFiles = await db
            .select()
            .from(documents)
            .where(isNull(documents.filePath));

        console.log(`📄 Found ${docsWithoutFiles.length} documents without files\n`);

        if (docsWithoutFiles.length === 0) {
            console.log('✅ No cleanup needed - all documents have files!');
            return;
        }

        // Show what will be deleted
        console.log('The following documents will be DELETED:\n');

        const byType: Record<string, number> = {};
        docsWithoutFiles.forEach(doc => {
            byType[doc.type] = (byType[doc.type] || 0) + 1;
        });

        Object.entries(byType).forEach(([type, count]) => {
            console.log(`   ${type.toUpperCase()}: ${count} documents`);
        });

        console.log('\n⚠️  WARNING: This action cannot be undone!');
        console.log('   These documents have metadata but no actual files.');
        console.log('   Deleting them will clean up the database and prevent UI confusion.\n');

        // Uncomment the line below to actually delete
        // const result = await db.delete(documents).where(isNull(documents.filePath));

        console.log('🔒 SAFETY MODE: Delete operation is commented out.');
        console.log('   To actually delete, uncomment the delete line in the script.\n');

        console.log('💡 RECOMMENDATION:');
        console.log('   1. Review the list above');
        console.log('   2. If you want to proceed, uncomment the delete line');
        console.log('   3. Run the script again to perform the cleanup\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

cleanupDocumentsWithoutFiles();
