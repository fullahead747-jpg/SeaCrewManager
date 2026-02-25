
import { db } from './server/db.js';
import { contracts, crewMembers } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkMultipleActiveContracts() {
    try {
        const allActiveContracts = await db.select().from(contracts).where(eq(contracts.status, 'active'));
        const crewCounts = {};

        allActiveContracts.forEach(c => {
            if (!crewCounts[c.crewMemberId]) crewCounts[c.crewMemberId] = [];
            crewCounts[c.crewMemberId].push(c);
        });

        const multiple = Object.entries(crewCounts).filter(([id, list]) => list.length > 1);

        if (multiple.length === 0) {
            console.log("No crew members with multiple active contracts found.");
        } else {
            console.log(`Found ${multiple.length} crew members with multiple active contracts:`);
            for (const [id, list] of multiple) {
                const [crew] = await db.select().from(crewMembers).where(eq(crewMembers.id, id));
                console.log(`Crew: ${crew.firstName} ${crew.lastName} (ID: ${id})`);
                list.forEach(c => {
                    console.log(`  - Contract ID: ${c.id}, CreatedAt: ${c.createdAt}, EndDate: ${c.endDate}`);
                });
            }
        }
    } catch (error) {
        console.error(error);
    }
}

checkMultipleActiveContracts().then(() => process.exit(0));
