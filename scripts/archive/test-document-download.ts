
import { DocumentStorageService } from '../server/objectStorage';
import { db } from '../server/db';
import { contracts, crewMembers } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function testDownload() {
    console.log('🔍 Testing Document Download Logic');
    console.log('='.repeat(50));

    // Find the contract for Upendra
    const crew = await db.select().from(crewMembers).where(eq(crewMembers.firstName, 'Upendra'));
    if (crew.length === 0) {
        console.error('❌ Upendra not found');
        return;
    }

    const upendra = crew[0];
    const crewContracts = await db.select().from(contracts).where(eq(contracts.crewMemberId, upendra.id));

    if (crewContracts.length === 0) {
        console.error('❌ No contracts found for Upendra');
        return;
    }

    const contract = crewContracts[0];
    console.log(`📄 Testing Contract ID: ${contract.id}`);
    console.log(`   File Path: ${contract.filePath}`);

    if (!contract.filePath || !contract.filePath.startsWith('/')) {
        console.error('❌ Contract does not have a cloud path');
        return;
    }

    const storageService = new DocumentStorageService();
    try {
        console.log('   Attempting to get file metadata...');
        const file = await storageService.getDocumentFile(contract.filePath);
        const [metadata] = await file.getMetadata();
        console.log('✅ Metadata retrieved successfully:');
        console.log(`   - Content-Type: ${metadata.contentType}`);
        console.log(`   - Size: ${metadata.size} bytes`);
        console.log(`   - Updated: ${metadata.updated}`);

        console.log('\n✅ Download logic is working on the storage layer!');
    } catch (error: any) {
        console.error('\n❌ ERROR in storage layer:');
        console.error(error.message);
        if (error.stack) console.error(error.stack);

        if (error.message.includes('projectId')) {
            console.log('\n💡 Suggestion: The GCS client might need a Project ID, even on Replit.');
        }
    }
}

testDownload();
