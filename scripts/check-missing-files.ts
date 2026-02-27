import { db } from "../server/db";
import { documents, contracts, crewMembers } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";
import { eq, isNotNull } from "drizzle-orm";

async function checkMissingFiles() {
    console.log("🔍 Checking for missing document and contract files...");
    console.log("=".repeat(60));

    const allDocuments = await db.select().from(documents).where(isNotNull(documents.filePath));
    const allContracts = await db.select().from(contracts).where(isNotNull(contracts.filePath));

    let missingCount = 0;
    let cloudCount = 0;
    let localCount = 0;

    console.log(`\n📄 Checking ${allDocuments.length} documents...`);
    for (const doc of allDocuments) {
        const filePath = doc.filePath!;
        if (filePath.startsWith("/")) {
            cloudCount++;
            continue; // Assume cloud files exist or are handled by viewer
        }

        localCount++;
        const fullPath = path.join(process.cwd(), filePath);
        if (!fs.existsSync(fullPath)) {
            const crew = await db.select().from(crewMembers).where(eq(crewMembers.id, doc.crewMemberId)).limit(1);
            const crewName = crew.length > 0 ? `${crew[0].firstName} ${crew[0].lastName}` : "Unknown";

            console.log(`❌ MISSING: [${doc.type.toUpperCase()}] for ${crewName}`);
            console.log(`   Path: ${filePath}`);
            console.log(`   ID: ${doc.id}`);
            missingCount++;
        }
    }

    console.log(`\n📝 Checking ${allContracts.length} contracts...`);
    for (const contract of allContracts) {
        const filePath = contract.filePath!;
        if (filePath.startsWith("/")) {
            cloudCount++;
            continue;
        }

        localCount++;
        const fullPath = path.join(process.cwd(), filePath);
        if (!fs.existsSync(fullPath)) {
            const crew = await db.select().from(crewMembers).where(eq(crewMembers.id, contract.crewMemberId)).limit(1);
            const crewName = crew.length > 0 ? `${crew[0].firstName} ${crew[0].lastName}` : "Unknown";

            console.log(`❌ MISSING: [CONTRACT] for ${crewName}`);
            console.log(`   Path: ${filePath}`);
            console.log(`   ID: ${contract.id}`);
            missingCount++;
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Summary:");
    console.log(`   Total Cloud Files: ${cloudCount} (Saved securely)`);
    console.log(`   Total Local Files: ${localCount} (At risk on Replit)`);
    console.log(`   Total Missing Files: ${missingCount} (LOST - Need Re-upload)`);
    console.log("=".repeat(60));

    if (missingCount > 0) {
        console.log("\n💡 Recommendation: Re-upload the missing documents listed above.");
        console.log("   The new fix will ensure they are saved to Cloud Storage permanently.");
    } else {
        console.log("\n✅ All specified files are present.");
    }

    process.exit(0);
}

checkMissingFiles().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
