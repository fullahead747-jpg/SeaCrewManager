import 'dotenv/config';
import { db } from './server/db';
import { documents, crewMembers } from './shared/schema';
import { eq, and } from 'drizzle-orm';

async function updateCOCNumber() {
    console.log('🔍 Locating UPENDRA KUMAR\'s COC document...\n');

    try {
        // 1. Find UPENDRA KUMAR
        const crew = await db
            .select()
            .from(crewMembers)
            .where(eq(crewMembers.firstName, 'UPENDRA'));

        if (crew.length === 0) {
            console.log('❌ UPENDRA KUMAR not found');
            return;
        }

        const crewId = crew[0].id;
        console.log(`✅ Found crew member: ${crew[0].firstName} ${crew[0].lastName} (ID: ${crewId})`);

        // 2. Find COC document
        const cocDocs = await db
            .select()
            .from(documents)
            .where(
                and(
                    eq(documents.crewMemberId, crewId),
                    eq(documents.type, 'coc')
                )
            );

        if (cocDocs.length === 0) {
            console.log('❌ COC document not found for this crew member');
            return;
        }

        console.log(`📋 Found ${cocDocs.length} COC document(s). Current numbers:`);
        cocDocs.forEach(doc => console.log(`   - ID: ${doc.id}, Current: "${doc.documentNumber}"`));

        // 3. Update the number
        const targetDoc = cocDocs[0];
        const newNumber = 'NCVOON673';

        console.log(`\n🔄 Updating document ${targetDoc.id} to "${newNumber}"...`);

        await db
            .update(documents)
            .set({ documentNumber: newNumber })
            .where(eq(documents.id, targetDoc.id));

        console.log('✅ Update successful!');

    } catch (error) {
        console.error('❌ Error during update:', error);
    }
}

updateCOCNumber();
