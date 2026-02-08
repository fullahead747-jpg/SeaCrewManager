import 'dotenv/config';
import { db } from './server/db';
import { vessels } from './shared/schema';
import { eq } from 'drizzle-orm';

async function updateVesselStatuses() {
    console.log('🚀 Updating vessel statuses...\n');

    try {
        // Update AMNS HERCULES to harbour-mining
        await db.update(vessels)
            .set({ status: 'harbour-mining' })
            .where(eq(vessels.name, 'AMNS HERCULES'));
        console.log('✅ Updated AMNS HERCULES to Harbour-Mining');

        // Update DRA 1 to coastal-mining
        await db.update(vessels)
            .set({ status: 'coastal-mining' })
            .where(eq(vessels.name, 'DRA 1'));
        console.log('✅ Updated DRA 1 to Coastal-Mining');

        // Update Aqua Tow to world-wide
        await db.update(vessels)
            .set({ status: 'world-wide' })
            .where(eq(vessels.name, 'Aqua Tow'));
        console.log('✅ Updated Aqua Tow to World-Wide');

        // Update remaining vessels with varied statuses
        await db.update(vessels)
            .set({ status: 'oil-field' })
            .where(eq(vessels.name, 'Genesis Alpha'));
        console.log('✅ Updated Genesis Alpha to Oil-Field');

        await db.update(vessels)
            .set({ status: 'harbour-mining' })
            .where(eq(vessels.name, 'Fairmacs Nicobar'));
        console.log('✅ Updated Fairmacs Nicobar to Harbour-Mining');

        await db.update(vessels)
            .set({ status: 'coastal-mining' })
            .where(eq(vessels.name, 'AJR WB 1'));
        console.log('✅ Updated AJR WB 1 to Coastal-Mining');

        console.log('\n✅ All vessel statuses updated successfully!');

        // Verify the updates
        const updatedVessels = await db.select().from(vessels);
        console.log('\nUpdated Vessel Statuses:');
        updatedVessels.forEach(v => {
            console.log(`  ${v.name}: ${v.status}`);
        });

    } catch (err) {
        console.error('❌ Error updating vessel statuses:', err);
        process.exit(1);
    }
}

updateVesselStatuses();
