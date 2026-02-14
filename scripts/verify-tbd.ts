
import { db } from "../server/db";
import { documents, crewMembers } from "@shared/schema";
import { eq, isNull, desc } from "drizzle-orm";

async function verifyTbd() {
    console.log("Searching for documents with TBD (NULL expiry dates) or recent updates...");

    try {
        // 1. Find all documents where expiryDate is NULL
        const tbdDocs = await db.select()
            .from(documents)
            .where(isNull(documents.expiryDate));

        if (tbdDocs.length > 0) {
            console.log(`\n✅ Found ${tbdDocs.length} document(s) with TBD status:`);
            for (const doc of tbdDocs) {
                const crew = await db.select().from(crewMembers).where(eq(crewMembers.id, doc.crewMemberId)).limit(1);
                const crewName = crew.length > 0 ? `${crew[0].firstName} ${crew[0].lastName}` : "Unknown Crew";
                console.log(`\nCrew: ${crewName} (ID: ${doc.crewMemberId})`);
                console.log(`  - Document: ${doc.type.toUpperCase()}`);
                console.log(`  - Expiry Date: NULL`);
            }
        } else {
            console.log("\n❌ No documents found with NULL (TBD) expiry dates.");

            // 2. Find the 10 most recently updated documents to see what happened
            console.log("\nListing 10 most recently updated documents:");
            const recentDocs = await db.select()
                .from(documents)
                .orderBy(desc(documents.updatedAt))
                .limit(10);

            for (const doc of recentDocs) {
                const crew = await db.select().from(crewMembers).where(eq(crewMembers.id, doc.crewMemberId)).limit(1);
                const crewName = crew.length > 0 ? `${crew[0].firstName} ${crew[0].lastName}` : "Unknown Crew";
                console.log(`\nCrew: ${crewName}`);
                console.log(`  - Document: ${doc.type.toUpperCase()}`);
                console.log(`  - Expiry Date: ${doc.expiryDate}`);
                console.log(`  - Updated At: ${doc.updatedAt}`);
            }
        }

    } catch (error) {
        console.error("Error querying database:", error);
    } finally {
        process.exit(0);
    }
}

verifyTbd();
