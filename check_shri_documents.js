
import { db } from './server/db';
import { crewMembers, documents } from './shared/schema';
import { eq, ilike, or } from 'drizzle-orm';

async function checkDocuments() {
    const members = await db.select().from(crewMembers).where(
        or(
            ilike(crewMembers.firstName, '%SHRI RAM%'),
            ilike(crewMembers.lastName, '%NIRDOSH%')
        )
    );

    if (members.length === 0) {
        console.log("No crew member found.");
        return;
    }

    const member = members[0];
    console.log(`Checking documents for ${member.firstName} ${member.lastName} (${member.id})`);

    const memberDocs = await db.select().from(documents).where(eq(documents.crewMemberId, member.id));

    if (memberDocs.length === 0) {
        console.log("No documents found.");
    } else {
        console.log(`Found ${memberDocs.length} documents:`);
        memberDocs.forEach(d => {
            console.log(`- Type: ${d.type}`);
            console.log(`  Number: ${d.documentNumber}`);
            console.log(`  Issue Date: ${d.issueDate}`);
            console.log(`  Expiry Date: ${d.expiryDate}`);
        });
    }
}

checkDocuments().catch(console.error);
