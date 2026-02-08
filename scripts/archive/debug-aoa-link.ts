
import { db } from "./server/db";
import { crewMembers, documents, contracts } from "./shared/schema";
import { eq } from "drizzle-orm";

async function investigate() {
    const crewId = "f99f7466-1dc0-4111-ab1e-4459a533d8e3";
    console.log(`Investigating records for Crew ID: ${crewId}`);

    const crew = await db.select().from(crewMembers).where(eq(crewMembers.id, crewId)).limit(1);
    console.log("\nCrew Details:", JSON.stringify(crew[0], null, 2));

    const crewDocs = await db.select().from(documents).where(eq(documents.crewMemberId, crewId));
    console.log("\nDocuments:", JSON.stringify(crewDocs, null, 2));

    const crewContracts = await db.select().from(contracts).where(eq(contracts.crewMemberId, crewId));
    console.log("\nContracts:", JSON.stringify(crewContracts, null, 2));

    process.exit(0);
}

investigate().catch(err => {
    console.error("Investigation failed:", err);
    process.exit(1);
});
