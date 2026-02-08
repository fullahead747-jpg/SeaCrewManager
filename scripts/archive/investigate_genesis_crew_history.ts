import { db } from './server/db';
import { crewMembers, contracts, crewRotations } from '@shared/schema';
import { eq, desc, or, and } from 'drizzle-orm';

async function investigateGenesisAlphaCrewHistory() {
    try {
        console.log('🔍 Investigating Genesis Alpha crew history...\n');

        const genesisAlphaId = '53b58ee7-8c95-4145-851a-49c313fac1df';

        // Check all crew members to see if any mention Genesis Alpha in their data
        const allCrew = await db.select().from(crewMembers);

        console.log('📋 Checking all crew members for Genesis Alpha references...\n');

        // Check if any crew member's name, rank, or other fields suggest they should be on Genesis Alpha
        const possibleGenesisCrewByName = allCrew.filter(c =>
            c.firstName?.toLowerCase().includes('genesis') ||
            c.lastName?.toLowerCase().includes('genesis')
        );

        if (possibleGenesisCrewByName.length > 0) {
            console.log('Found crew with "Genesis" in their name:');
            possibleGenesisCrewByName.forEach(c => {
                console.log(`  - ${c.firstName} ${c.lastName} (Current Vessel: ${c.currentVesselId})`);
            });
        }

        // Check contracts for Genesis Alpha
        console.log('\n📄 Checking contracts for Genesis Alpha...\n');
        const genesisContracts = await db
            .select()
            .from(contracts)
            .where(eq(contracts.vesselId, genesisAlphaId))
            .orderBy(desc(contracts.createdAt));

        console.log(`Found ${genesisContracts.length} contracts for Genesis Alpha:`);

        if (genesisContracts.length > 0) {
            for (const contract of genesisContracts) {
                const crew = allCrew.find(c => c.id === contract.crewMemberId);
                console.log(`\n  Contract ID: ${contract.id}`);
                console.log(`  Crew: ${crew?.firstName} ${crew?.lastName}`);
                console.log(`  Status: ${contract.status}`);
                console.log(`  Start Date: ${contract.startDate}`);
                console.log(`  End Date: ${contract.endDate}`);
                console.log(`  Created: ${contract.createdAt}`);
                console.log(`  Crew's Current Vessel: ${crew?.currentVesselId}`);
                console.log(`  Crew's Status: ${crew?.status}`);
            }
        }

        // Check rotations for Genesis Alpha
        console.log('\n\n🔄 Checking rotations for Genesis Alpha...\n');
        const genesisRotations = await db
            .select()
            .from(crewRotations)
            .where(eq(crewRotations.vesselId, genesisAlphaId))
            .orderBy(desc(crewRotations.createdAt));

        console.log(`Found ${genesisRotations.length} rotations for Genesis Alpha:`);

        if (genesisRotations.length > 0) {
            for (const rotation of genesisRotations) {
                const crew = allCrew.find(c => c.id === rotation.crewMemberId);
                console.log(`\n  Rotation ID: ${rotation.id}`);
                console.log(`  Crew: ${crew?.firstName} ${crew?.lastName}`);
                console.log(`  Join Date: ${rotation.joinDate}`);
                console.log(`  Leave Date: ${rotation.leaveDate}`);
                console.log(`  Status: ${rotation.status}`);
                console.log(`  Created: ${rotation.createdAt}`);
                console.log(`  Crew's Current Vessel: ${crew?.currentVesselId}`);
                console.log(`  Crew's Status: ${crew?.status}`);
            }
        }

        // Check for recently updated crew members
        console.log('\n\n📊 Recently updated crew members (last 10):\n');
        const recentlyUpdated = [...allCrew]
            .sort((a, b) => {
                const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return dateB - dateA;
            })
            .slice(0, 10);

        recentlyUpdated.forEach(crew => {
            console.log(`  ${crew.firstName} ${crew.lastName}`);
            console.log(`    Current Vessel: ${crew.currentVesselId}`);
            console.log(`    Status: ${crew.status}`);
            console.log(`    Updated: ${crew.updatedAt}`);
            console.log('');
        });

        // Summary
        console.log('\n📈 SUMMARY:');
        console.log(`  Total contracts for Genesis Alpha: ${genesisContracts.length}`);
        console.log(`  Total rotations for Genesis Alpha: ${genesisRotations.length}`);
        console.log(`  Active contracts: ${genesisContracts.filter(c => c.status === 'active').length}`);
        console.log(`  Crew currently assigned to Genesis Alpha: 0`);

        if (genesisContracts.length > 0 || genesisRotations.length > 0) {
            console.log('\n⚠️  ISSUE DETECTED:');
            console.log('  There are contracts/rotations for Genesis Alpha, but no crew is currently assigned!');
            console.log('  This suggests the crew assignments were changed or reset.');
        }

    } catch (error) {
        console.error('❌ Error investigating Genesis Alpha crew history:', error);
    } finally {
        process.exit(0);
    }
}

investigateGenesisAlphaCrewHistory();
