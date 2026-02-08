import { db } from './server/db';
import { crewMembers, documents, contracts, crewRotations, scannedDocuments } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function deleteAllCrewData() {
    console.log('Starting crew data deletion...\n');

    // Get counts before deletion
    const allCrew = await db.select().from(crewMembers);
    const allDocs = await db.select().from(documents);
    const allContracts = await db.select().from(contracts);
    const allRotations = await db.select().from(crewRotations);

    console.log('Current data:');
    console.log(`  Crew members: ${allCrew.length}`);
    console.log(`  Documents: ${allDocs.length}`);
    console.log(`  Contracts: ${allContracts.length}`);
    console.log(`  Crew rotations: ${allRotations.length}`);

    console.log('\n⚠️  WARNING: This will delete ALL crew members and their associated data!');
    console.log('This includes:');
    console.log('  - All crew member records');
    console.log('  - All documents (Passport, CDC, COC, Medical, AOA)');
    console.log('  - All contracts');
    console.log('  - All crew rotations');
    console.log('  - All scanned document records');
    console.log('\nVessels, users, and other system data will be preserved.');

    console.log('\nProceeding with deletion in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        // Delete in correct order due to foreign key constraints

        // 1. Delete scanned documents (references documents)
        console.log('\n1. Deleting scanned documents...');
        const scannedDocs = await db.select().from(scannedDocuments);
        if (scannedDocs.length > 0) {
            await db.delete(scannedDocuments);
            console.log(`   ✓ Deleted ${scannedDocs.length} scanned document records`);
        } else {
            console.log('   No scanned documents to delete');
        }

        // 2. Delete documents (references crew members)
        console.log('\n2. Deleting documents...');
        if (allDocs.length > 0) {
            await db.delete(documents);
            console.log(`   ✓ Deleted ${allDocs.length} documents`);
        } else {
            console.log('   No documents to delete');
        }

        // 3. Delete contracts (references crew members)
        console.log('\n3. Deleting contracts...');
        if (allContracts.length > 0) {
            await db.delete(contracts);
            console.log(`   ✓ Deleted ${allContracts.length} contracts`);
        } else {
            console.log('   No contracts to delete');
        }

        // 4. Delete crew rotations (references crew members)
        console.log('\n4. Deleting crew rotations...');
        if (allRotations.length > 0) {
            await db.delete(crewRotations);
            console.log(`   ✓ Deleted ${allRotations.length} crew rotations`);
        } else {
            console.log('   No crew rotations to delete');
        }

        // 5. Finally, delete crew members
        console.log('\n5. Deleting crew members...');
        if (allCrew.length > 0) {
            await db.delete(crewMembers);
            console.log(`   ✓ Deleted ${allCrew.length} crew members`);
        } else {
            console.log('   No crew members to delete');
        }

        console.log('\n✅ Deletion complete!');
        console.log('\nSummary:');
        console.log(`  Crew members deleted: ${allCrew.length}`);
        console.log(`  Documents deleted: ${allDocs.length}`);
        console.log(`  Contracts deleted: ${allContracts.length}`);
        console.log(`  Crew rotations deleted: ${allRotations.length}`);

        // Verify deletion
        const remainingCrew = await db.select().from(crewMembers);
        const remainingDocs = await db.select().from(documents);
        const remainingContracts = await db.select().from(contracts);

        console.log('\nVerification:');
        console.log(`  Remaining crew members: ${remainingCrew.length}`);
        console.log(`  Remaining documents: ${remainingDocs.length}`);
        console.log(`  Remaining contracts: ${remainingContracts.length}`);

        if (remainingCrew.length === 0 && remainingDocs.length === 0 && remainingContracts.length === 0) {
            console.log('\n✓ All crew data successfully deleted!');
            console.log('The database is now ready for fresh crew data.');
        } else {
            console.log('\n⚠️  Warning: Some data may not have been deleted.');
        }

    } catch (error: any) {
        console.error('\n❌ Error during deletion:', error.message);
        throw error;
    }
}

deleteAllCrewData()
    .then(() => {
        console.log('\nDeletion process complete.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
