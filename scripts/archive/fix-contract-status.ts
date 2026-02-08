    import { db } from './server/db';
import { crewMembers, contracts } from './shared/schema';
import { isNull, eq } from 'drizzle-orm';
import 'dotenv/config';

async function fixContractStatusConsistency() {
    console.log('🔧 Fixing contract status consistency with crew status...\n');

    try {
        // Get all crew members
        const allCrew = await db.select().from(crewMembers);

        console.log('📊 Crew Status Analysis:');
        const onBoard = allCrew.filter(c => c.status === 'onBoard' && c.currentVesselId);
        const onShore = allCrew.filter(c => c.status === 'onShore');
        const noVessel = allCrew.filter(c => !c.currentVesselId);

        console.log(`   On Board (with vessel): ${onBoard.length}`);
        console.log(`   On Shore: ${onShore.length}`);
        console.log(`   No Vessel Assigned: ${noVessel.length}`);

        // Clean up existing placeholder contracts
        await db.delete(contracts).where(isNull(contracts.filePath));
        console.log('\n🧹 Cleaned up existing placeholder contracts.');

        let restoredCount = 0;
        let skippedCount = 0;
        const now = new Date('2026-02-01');

        for (const member of allCrew) {
            // Skip if no vessel assigned
            if (!member.currentVesselId) {
                skippedCount++;
                continue;
            }

            const startDate = member.createdAt || new Date('2025-08-01');
            const endDate = new Date(startDate.getTime());

            // If crew is ON SHORE, their contract should be EXPIRED
            // If crew is ON BOARD, contract can be valid/expiring/expired based on duration
            let durationDays: number;
            let contractStatus: 'active' | 'completed';

            if (member.status === 'onShore') {
                // On shore crew: contract should be expired (ended before today)
                durationDays = 90 + Math.floor(Math.random() * 31); // 90-120 days (all expired)
                contractStatus = 'completed';
            } else {
                // On board crew: varied durations for realistic distribution
                durationDays = 120 + Math.floor(Math.random() * 121); // 120-240 days
                contractStatus = 'active';
            }

            endDate.setDate(endDate.getDate() + durationDays);

            await db.insert(contracts).values({
                crewMemberId: member.id,
                vesselId: member.currentVesselId,
                startDate: startDate,
                endDate: endDate,
                durationDays: durationDays,
                status: contractStatus,
                contractType: 'SEA',
                currency: 'USD',
                salary: 1000
            });

            restoredCount++;
        }

        console.log(`\n✅ Restoration complete!`);
        console.log(`✨ Restored: ${restoredCount}`);
        console.log(`⏭️  Skipped (no vessel): ${skippedCount}`);

        // Show distribution by crew status
        const allContracts = await db
            .select()
            .from(contracts)
            .innerJoin(crewMembers, eq(contracts.crewMemberId, crewMembers.id));

        const fortyFiveDaysFromNow = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

        let onBoardExpired = 0, onBoardExpiring = 0, onBoardValid = 0;
        let onShoreExpired = 0, onShoreExpiring = 0, onShoreValid = 0;

        allContracts.forEach(({ contracts: c, crew_members: cm }) => {
            const isExpired = c.endDate < now;
            const isExpiring = !isExpired && c.endDate <= fortyFiveDaysFromNow;
            const isValid = !isExpired && !isExpiring;

            if (cm.status === 'onBoard') {
                if (isExpired) onBoardExpired++;
                else if (isExpiring) onBoardExpiring++;
                else onBoardValid++;
            } else {
                if (isExpired) onShoreExpired++;
                else if (isExpiring) onShoreExpiring++;
                else onShoreValid++;
            }
        });

        console.log(`\n📊 Distribution by Crew Status:`);
        console.log(`\n   ON BOARD Crew (${onBoard.length} total):`);
        console.log(`     Expired: ${onBoardExpired}`);
        console.log(`     Expiring Soon: ${onBoardExpiring}`);
        console.log(`     Valid: ${onBoardValid}`);

        console.log(`\n   ON SHORE Crew (${onShore.length} total):`);
        console.log(`     Expired: ${onShoreExpired}`);
        console.log(`     Expiring Soon: ${onShoreExpiring}`);
        console.log(`     Valid: ${onShoreValid} ⚠️ (should be 0)`);

    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

fixContractStatusConsistency();
