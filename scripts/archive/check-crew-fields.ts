import { db } from './server/db';
import { crewMembers } from '@shared/schema';

async function checkCrewMemberFields() {
    console.log('Checking crew member data for embedded document information...\n');

    // Get a sample crew member
    const allCrew = await db.select().from(crewMembers);

    if (allCrew.length > 0) {
        const sample = allCrew[0];
        console.log('Sample crew member fields:');
        console.log(JSON.stringify(sample, null, 2));

        // Check for KAM RAJU specifically
        const kamRaju = allCrew.find(c =>
            c.firstName.toUpperCase() === 'KAM' && c.lastName.toUpperCase() === 'RAJU'
        );

        if (kamRaju) {
            console.log('\n\nKAM RAJU data:');
            console.log(JSON.stringify(kamRaju, null, 2));
        }
    }
}

checkCrewMemberFields()
    .then(() => {
        console.log('\nCheck complete.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
