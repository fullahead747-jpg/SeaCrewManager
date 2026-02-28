
import { db } from "../db";
import { crewMembers, contracts, vessels } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";

async function main() {
    console.log("Searching for RAJPAL SINGH...");
    const [member] = await db.select().from(crewMembers).where(
        and(
            sql`LOWER(${crewMembers.firstName}) = 'rajpal'`,
            sql`LOWER(${crewMembers.lastName}) = 'singh'`
        )
    );

    if (!member) {
        console.log("Crew member not found.");
        return;
    }

    console.log(`Found member: ${member.firstName} ${member.lastName} (ID: ${member.id})`);
    console.log(`Status: ${member.status}`);
    console.log(`Current Vessel ID: ${member.currentVesselId}`);
    console.log(`Last Vessel ID: ${member.lastVesselId}`);

    const memberContracts = await db.select().from(contracts).where(eq(contracts.crewMemberId, member.id));
    const allVessels = await db.select().from(vessels);
    const vesselMap = new Map(allVessels.map(v => [v.id, v]));

    console.log("\nContracts:");
    memberContracts.forEach(c => {
        const vessel = vesselMap.get(c.vesselId);
        console.log(`- Vessel: ${vessel ? vessel.name : 'Unknown'} (${c.vesselId})`);
        console.log(`  Contract ID: ${c.id}`);
        console.log(`  Status: ${c.status}`);
        console.log(`  Start: ${c.startDate}`);
        console.log(`  End: ${c.endDate}`);
        console.log(`  Duration Days: ${c.durationDays}`);

        // Calculation logic from storage.ts
        const isCompleted = c.status === 'completed' && c.startDate && c.endDate;
        const isActive = c.status === 'active' && c.startDate;

        if ((isCompleted || isActive) && c.startDate) {
            let durationDays = c.durationDays;
            if (isActive || typeof durationDays !== 'number') {
                const endDate = c.endDate!;
                durationDays = Math.ceil((endDate.getTime() - new Date(c.startDate).getTime()) / (1000 * 60 * 60 * 24));
                durationDays = Math.max(0, durationDays);
            }
            const durationMonths = Math.round((durationDays / 30) * 10) / 10;
            console.log(`  Calculated Months: ${durationMonths} (Days: ${durationDays})`);
        }
    });

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
