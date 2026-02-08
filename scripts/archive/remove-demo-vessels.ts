import 'dotenv/config';
import { db } from './server/db';
import { vessels, contracts, crewRotations, vesselDocuments, statusChangeHistory, crewMembers, users, documents, scannedDocuments, notificationHistory, activityLogs } from './shared/schema';
import { like, inArray, or } from 'drizzle-orm';

async function removeDemoVessels() {
    console.log('🚀 Removing all demo vessels and associated data...\n');

    try {
        // 1. Identify demo vessels and specific manual cleaning items
        const demoVessels = await db.select().from(vessels).where(
            or(
                like(vessels.name, '[DEMO]%'),
                inArray(vessels.name, ['AJRWB 1', 'AMNS GENESIS'])
            )
        );

        if (demoVessels.length === 0) {
            console.log('✨ No demo vessels found.');
            // Check if there are demo crew or users to delete even if no vessels
            const demoCrewCheck = await db.select().from(crewMembers).where(or(like(crewMembers.firstName, '[DEMO]%'), like(crewMembers.lastName, '[DEMO]%')));
            const demoUsersCheck = await db.select().from(users).where(like(users.name, '[DEMO]%'));
            if (demoCrewCheck.length === 0 && demoUsersCheck.length === 0) {
                return;
            }
        }

        const demoVesselIds = demoVessels.map(v => v.id);
        if (demoVessels.length > 0) {
            console.log(`📦 Found ${demoVessels.length} demo vessels:`);
            demoVessels.forEach(v => console.log(`  - ${v.name}`));
        }

        // 2. Identify crew members assigned to these vessels (for unassignment before vessel deletion)
        // This step is now primarily for unassigning crew from vessels that will be deleted,
        // before the crew themselves might be deleted in step 5.
        const crewToUpdate = await db.select().from(crewMembers).where(inArray(crewMembers.currentVesselId, demoVesselIds));
        const crewIdsToUnassign = crewToUpdate.map(c => c.id);

        // 3. Delete dependent records
        console.log('\n🧹 Cleaning up dependent records...');

        // Vessel Documents
        const vDocsDeleted = await db.delete(vesselDocuments).where(inArray(vesselDocuments.vesselId, demoVesselIds)).returning();
        console.log(`  ✅ Deleted ${vDocsDeleted.length} vessel documents`);

        // Crew Rotations
        const rotationsDeleted = await db.delete(crewRotations).where(inArray(crewRotations.vesselId, demoVesselIds)).returning();
        console.log(`  ✅ Deleted ${rotationsDeleted.length} crew rotations`);

        // Contracts
        const contractsDeleted = await db.delete(contracts).where(inArray(contracts.vesselId, demoVesselIds)).returning();
        console.log(`  ✅ Deleted ${contractsDeleted.length} contracts`);

        // Status Change History
        const historyDeleted = await db.delete(statusChangeHistory).where(inArray(statusChangeHistory.vesselId, demoVesselIds)).returning();
        console.log(`  ✅ Deleted ${historyDeleted.length} status change history records`);

        // 4. Update crew members current vessel to null (for crew not being deleted)
        if (crewIdsToUnassign.length > 0) {
            await db.update(crewMembers)
                .set({ currentVesselId: null })
                .where(inArray(crewMembers.id, crewIdsToUnassign));
            console.log(`  ✅ Unassigned ${crewIdsToUnassign.length} crew members from demo vessels`);
        }

        // 5. Delete demo crew members
        const demoCrew = await db.select().from(crewMembers).where(or(like(crewMembers.firstName, '[DEMO]%'), like(crewMembers.lastName, '[DEMO]%')));
        const demoCrewIds = demoCrew.map(c => c.id);

        if (demoCrewIds.length > 0) {
            console.log(`\n👨‍💼 Found ${demoCrewIds.length} demo crew members. Cleaning up...`);

            // Delete scanned documents
            await db.delete(scannedDocuments).where(inArray(scannedDocuments.documentId,
                db.select({ id: documents.id }).from(documents).where(inArray(documents.crewMemberId, demoCrewIds))
            ));

            // Delete documents
            await db.delete(documents).where(inArray(documents.crewMemberId, demoCrewIds));

            // Delete crew rotations (already handled some but being thorough)
            await db.delete(crewRotations).where(inArray(crewRotations.crewMemberId, demoCrewIds));

            // Delete contracts (same)
            await db.delete(contracts).where(inArray(contracts.crewMemberId, demoCrewIds));

            // Now delete crew members
            await db.delete(crewMembers).where(inArray(crewMembers.id, demoCrewIds));
            console.log(`  ✅ Removed ${demoCrewIds.length} demo crew members`);
        }

        // 6. Delete demo users
        const demoUsers = await db.select().from(users).where(like(users.name, '[DEMO]%'));
        const demoUserIds = demoUsers.map(u => u.id);

        if (demoUserIds.length > 0) {
            console.log(`\n👤 Found ${demoUserIds.length} demo users. Cleaning up...`);

            // Note: users might be referenced in activity logs or vessel_documents.uploaded_by
            // We'll leave logs but might need to nullify uploaded_by
            await db.update(vesselDocuments).set({ uploadedBy: null }).where(inArray(vesselDocuments.uploadedBy, demoUserIds));

            await db.delete(users).where(inArray(users.id, demoUserIds));
            console.log(`  ✅ Removed ${demoUserIds.length} demo users`);
        }

        // 7. Finally delete the vessels
        if (demoVesselIds.length > 0) {
            const vesselsDeleted = await db.delete(vessels).where(inArray(vessels.id, demoVesselIds)).returning();
            console.log(`\n✅ Successfully removed ${vesselsDeleted.length} demo vessels!`);
        } else {
            console.log('\n✅ No demo vessels to remove.');
        }

    } catch (err) {
        console.error('❌ Error removing demo data:', err);
        process.exit(1);
    }
}

removeDemoVessels();
