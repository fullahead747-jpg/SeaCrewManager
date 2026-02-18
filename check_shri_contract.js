
import { db } from './server/db';
import { crewMembers, contracts } from './shared/schema';
import { eq, ilike, or } from 'drizzle-orm';

async function checkContract() {
    console.log("Searching for crew member 'SHRI RAM NIRDOSH'...");

    // Find crew member (relaxed search)
    const members = await db.select().from(crewMembers).where(
        or(
            ilike(crewMembers.firstName, '%SHRI%'),
            ilike(crewMembers.lastName, '%NIRDOSH%')
        )
    );

    if (members.length === 0) {
        console.log("No crew member found matching 'SHRI' or 'NIRDOSH'.");
        return;
    }

    for (const member of members) {
        console.log(`\nFound Crew Member: ${member.firstName} ${member.lastName} (ID: ${member.id})`);
        console.log(`Status: ${member.status}`);
        console.log(`Current Vessel ID: ${member.currentVesselId}`);

        // Get contracts
        const memberContracts = await db.select().from(contracts).where(eq(contracts.crewMemberId, member.id));

        if (memberContracts.length === 0) {
            console.log("  No contracts found.");
        } else {
            console.log(`  Found ${memberContracts.length} contracts:`);
            memberContracts.forEach(c => {
                console.log(`    - Contract ID: ${c.id}`);
                console.log(`      Status: ${c.status}`);
                console.log(`      Start Date: ${c.startDate}`);
                console.log(`      End Date:   ${c.endDate}`);
                console.log(`      Duration:   ${c.durationDays} days`);
            });
        }
    }
}

checkContract().catch(console.error);
