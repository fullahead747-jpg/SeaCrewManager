import "dotenv/config";
import { db } from "./server/db.ts";
import { documents, scannedDocuments, crewMembers } from "./shared/schema.ts";
import { desc, eq } from "drizzle-orm";

async function deletePassportForTesting() {
    console.log("🗑️  Deleting passport document for UPENDRA KUMAR for testing...\n");

    // Find the crew member
    const crew = await db
        .select()
        .from(crewMembers)
        .where(eq(crewMembers.firstName, 'UPENDRA'))
        .limit(1);

    if (crew.length === 0) {
        console.log("❌ Crew member UPENDRA KUMAR not found");
        return;
    }

    const crewMember = crew[0];
    console.log(`✅ Found crew member: ${crewMember.firstName} ${crewMember.lastName} (ID: ${crewMember.id})\n`);

    // Find all passport documents for this crew member
    const passportDocs = await db
        .select()
        .from(documents)
        .where(eq(documents.crewMemberId, crewMember.id))
        .where(eq(documents.type, 'passport'));

    if (passportDocs.length === 0) {
        console.log("❌ No passport documents found for this crew member");
        return;
    }

    console.log(`📋 Found ${passportDocs.length} passport document(s)\n`);

    for (const doc of passportDocs) {
        console.log(`Deleting passport document:`);
        console.log(`  ID: ${doc.id}`);
        console.log(`  Number: ${doc.documentNumber}`);
        console.log(`  File: ${doc.filePath}`);

        // Delete associated scanned documents first
        const scans = await db
            .select()
            .from(scannedDocuments)
            .where(eq(scannedDocuments.documentId, doc.id));

        console.log(`  Associated scans: ${scans.length}`);

        if (scans.length > 0) {
            await db
                .delete(scannedDocuments)
                .where(eq(scannedDocuments.documentId, doc.id));
            console.log(`  ✅ Deleted ${scans.length} scanned document record(s)`);
        }

        // Delete the document
        await db
            .delete(documents)
            .where(eq(documents.id, doc.id));
        console.log(`  ✅ Deleted passport document\n`);
    }

    console.log("✅ Cleanup complete! You can now re-upload the passport for testing.\n");
    console.log("📝 What to watch for in the logs when you re-upload:");
    console.log("   1. [OCR-GROQ] - AI vision extraction with enhanced prompts");
    console.log("   2. [MRZ-VALIDATION] - MRZ checksum validation");
    console.log("   3. [DOC-NUMBER-VALIDATION] - NEW! Document number validation");
    console.log("      - Look for confidence level");
    console.log("      - Check for auto-corrections");
    console.log("      - Review any warnings");
}

deletePassportForTesting()
    .then(() => {
        console.log("\n✅ Script complete");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
