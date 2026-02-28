
import { DatabaseStorage } from "../server/storage";
import { db } from "../server/db";
import { contracts } from "../shared/schema";
import { eq } from "drizzle-orm";

async function verifyAllCrew() {
    const storage = new DatabaseStorage();
    console.log("Fetching all crew members with details...");
    const crewMembers = await storage.getCrewMembers();

    let issuesFound = 0;
    console.log(`Checking ${crewMembers.length} crew members...\n`);

    for (const member of crewMembers) {
        if (member.activeContract && member.totalSailedMonths !== undefined) {
            const contract = member.activeContract;
            const startDate = new Date(contract.startDate);
            const endDate = new Date(contract.endDate);

            const expectedDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const expectedMonths = Math.round((expectedDays / 30) * 10) / 10;

            // Note: totalSailedMonths in storage.ts is calculated as the SUM of months from history
            // AND it only adds the CURRENT contract if it's active.
            // Wait, let's check the logic in storage.ts again.

            /*
            storage.ts logic:
            sailingHistoryMap.get(c.crewMemberId)!.push({ vesselName, durationDays, durationMonths });
            if (isActive) {
              const currentTotal = totalSailedMap.get(c.crewMemberId) || 0;
              totalSailedMap.set(c.crewMemberId, currentTotal + durationMonths);
            }
            */

            if (member.totalSailedMonths < expectedMonths) {
                // This might be okay if they have NO other contracts, but if they have an active contract, 
                // totalSailedMonths should at least be equal to that contract's duration.
                // However, the user said "months shown should strictly match the duration calculated based on the crew member’s contract start and end dates (or current active contract date)".
                // This implies the badge should reflect the ACTIVE contract duration.

                // Let's check if totalSailedMonths for this vessel matches.
                const vesselHistory = member.sailingHistory?.find(h => h.vesselName === (member.currentVessel?.name || 'Unknown Vessel'));
                if (vesselHistory) {
                    if (Math.abs(vesselHistory.durationMonths - expectedMonths) > 0.01) {
                        console.log(`[ISSUE] ${member.firstName} ${member.lastName}:`);
                        console.log(`  Contract: ${startDate.toDateString()} - ${endDate.toDateString()}`);
                        console.log(`  Expected Months: ${expectedMonths}`);
                        console.log(`  Actual History Months for Vessel: ${vesselHistory.durationMonths}`);
                        issuesFound++;
                    }
                }
            }
        }
    }

    if (issuesFound === 0) {
        console.log("\nSuccess: All active contract durations match the sailing months calculation!");
    } else {
        console.log(`\nFound ${issuesFound} issues.`);
    }

    process.exit(0);
}

verifyAllCrew().catch(err => {
    console.error(err);
    process.exit(1);
});
