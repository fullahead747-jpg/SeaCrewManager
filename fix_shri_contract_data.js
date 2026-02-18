
import { db } from './server/db';
import { contracts, crewMembers } from './shared/schema';
import { eq, ilike, or } from 'drizzle-orm';

async function fixContract() {
    // 1. Find SHRI RAM NIRDOSH
    const members = await db.select().from(crewMembers).where(
        or(
            ilike(crewMembers.firstName, '%SHRI%'),
            ilike(crewMembers.lastName, '%NIRDOSH%')
        )
    );

    if (members.length === 0) {
        console.log("Member not found");
        return;
    }
    const shri = members[0];
    console.log(`Fixing data for: ${shri.firstName} ${shri.lastName}`);

    // 2. Check for existing contract again (just in case)
    const existing = await db.select().from(contracts).where(eq(contracts.crewMemberId, shri.id));
    if (existing.length > 0) {
        console.log("Contract already exists! Updating instead...");
        // Logic to update if it exists would go here, but we know it doesn't from previous step
    }

    // 3. Insert new contract
    // User said "Date is 06-12-2025". Assuming this is Start Date (DD-MM-YYYY) -> 2025-12-06
    const startDate = new Date('2025-12-06T00:00:00Z');

    // Default duration 9 months (standard?) or 6? Let's use 9 months as placeholder or 90 days?
    // Usually partial contracts might be shorter. Let's guess standard is 9 months. 
    // Wait, let's look at other contracts. Usually 9 months +/-.
    // Let's set endDate to 9 months from start.
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 9);

    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`Creating contract: Start=${startDate.toISOString()}, End=${endDate.toISOString()}`);

    const [newContract] = await db.insert(contracts).values({
        crewMemberId: shri.id,
        vesselId: shri.currentVesselId, // Assign to current vessel
        startDate: startDate,
        endDate: endDate,
        durationDays: durationDays,
        status: 'active',
        contractType: 'SEA',
        contractNumber: 'MANUAL-FIX-001'
    }).returning();

    console.log(`Created contract ID: ${newContract.id}`);
}

fixContract().catch(console.error);
