
import { db } from "./server/db";
import { crewMembers, documents } from "./shared/schema";
import { eq, and } from "drizzle-orm";

async function main() {
    const crewList = await db.select().from(crewMembers).execute();
    const targetCrew = crewList.find(c =>
        (c.firstName + " " + c.lastName).toUpperCase().includes("VENKATARANGAN") ||
        (c.firstName + " " + c.lastName).toUpperCase().includes("BALAJI")
    );

    if (!targetCrew) {
        console.log("Crew member not found.");
        process.exit(0);
    }

    const docs = await db.select().from(documents)
        .where(and(
            eq(documents.crewMemberId, targetCrew.id),
            eq(documents.type, 'passport')
        ))
        .execute();

    if (docs.length === 0) {
        console.log("No passport found.");
    } else {
        // Show all passports found
        docs.forEach((doc, idx) => {
            console.log(`\nPassport #${idx + 1}`);
            console.log(`Document Number: ${doc.documentNumber}`);
            console.log(`Issue Date:    ${doc.issueDate}`);
            console.log(`Expiry Date:   ${doc.expiryDate}`);
            console.log(`File Path:     ${doc.filePath}`);
        });
    }
    process.exit(0);
}

main().catch(console.error);
