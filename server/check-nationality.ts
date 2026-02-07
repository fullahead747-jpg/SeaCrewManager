// Load environment variables FIRST
import { config } from 'dotenv';
config();

// Check crew member nationality
import { db } from './db.js';
import { crewMembers } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function checkNationality() {
    try {
        const crewMember = await db
            .select()
            .from(crewMembers)
            .where(eq(crewMembers.id, 'eb01e725-93fd-4506-aee3-8351e007d260'))
            .limit(1);

        if (crewMember.length > 0) {
            console.log('Crew Member Found:');
            console.log(`  ID: ${crewMember[0].id}`);
            console.log(`  Name: ${crewMember[0].firstName} ${crewMember[0].lastName}`);
            console.log(`  Nationality: "${crewMember[0].nationality}"`);
            console.log(`  Nationality (uppercase): "${crewMember[0].nationality?.toUpperCase()}"`);
            console.log(`  Includes 'IND': ${crewMember[0].nationality?.toUpperCase().includes('IND')}`);
            console.log(`  Equals 'INDIAN': ${crewMember[0].nationality?.toUpperCase() === 'INDIAN'}`);
        } else {
            console.log('Crew member not found');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkNationality();
