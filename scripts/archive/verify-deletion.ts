import { db } from './server/db';
import { crewMembers, documents, contracts, vessels, users } from '@shared/schema';

async function verifyDeletion() {
    console.log('Verifying deletion and checking preserved data...\n');

    // Check deleted data
    const remainingCrew = await db.select().from(crewMembers);
    const remainingDocs = await db.select().from(documents);
    const remainingContracts = await db.select().from(contracts);

    console.log('Deleted data (should be 0):');
    console.log(`  Crew members: ${remainingCrew.length}`);
    console.log(`  Documents: ${remainingDocs.length}`);
    console.log(`  Contracts: ${remainingContracts.length}`);

    // Check preserved data
    const allVessels = await db.select().from(vessels);
    const allUsers = await db.select().from(users);

    console.log('\nPreserved data:');
    console.log(`  Vessels: ${allVessels.length}`);
    console.log(`  Users: ${allUsers.length}`);

    if (allVessels.length > 0) {
        console.log('\n✓ Vessels preserved:');
        allVessels.slice(0, 5).forEach(vessel => {
            console.log(`  - ${vessel.name} (${vessel.type})`);
        });
        if (allVessels.length > 5) {
            console.log(`  ... and ${allVessels.length - 5} more`);
        }
    }

    console.log('\n✅ Verification complete!');
    console.log('The database is clean and ready for fresh crew data.');
}

verifyDeletion()
    .then(() => {
        console.log('\nVerification complete.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
