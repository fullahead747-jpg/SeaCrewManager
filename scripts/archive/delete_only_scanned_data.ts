import "dotenv/config";
import { db } from "./server/db.ts";
import { documents, scannedDocuments, crewMembers } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function deleteOnlyScannedDataForTesting() {
    console.log("🗑️  Deleting ONLY scanned_documents data for passport testing...\n");
    console.log("⚠️  IMPORTANT: This will NOT delete the document from the documents table!");
    console.log("⚠️  Dashboard data will remain intact.\n");

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

    console.log(`📋 Found ${passportDocs.length} passport document(s) in documents table\n`);

    for (const doc of passportDocs) {
        console.log(`Processing passport document:`);
        console.log(`  ID: ${doc.id}`);
        console.log(`  Number: ${doc.documentNumber}`);
        console.log(`  File: ${doc.filePath}`);

        // Find associated scanned documents
        const scans = await db
            .select()
            .from(scannedDocuments)
            .where(eq(scannedDocuments.documentId, doc.id));

        console.log(`  Associated scans in scanned_documents table: ${scans.length}`);

        if (scans.length > 0) {
            // Delete ONLY the scanned documents
            await db
                .delete(scannedDocuments)
                .where(eq(scannedDocuments.documentId, doc.id));
            console.log(`  ✅ Deleted ${scans.length} scanned document record(s) from scanned_documents table`);
        } else {
            console.log(`  ℹ️  No scanned data to delete`);
        }

        console.log(`  ✅ Document record PRESERVED in documents table\n`);
    }

    console.log("✅ Cleanup complete!\n");
    console.log("📊 Summary:");
    console.log("   ✅ Documents table: INTACT (dashboard data preserved)");
    console.log("   ✅ Scanned_documents table: CLEARED (ready for fresh OCR test)");
    console.log("\n📝 Next steps:");
    console.log("   1. Go to the document page in the UI");
    console.log("   2. Click 'Re-scan' or 'Upload' on the passport document");
    console.log("   3. Watch the server logs for the new OCR validation output");
}

deleteOnlyScannedDataForTesting()
    .then(() => {
        console.log("\n✅ Script complete");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
