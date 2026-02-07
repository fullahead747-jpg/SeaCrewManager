
import { db } from "./server/db";
import { crewMembers, documents, scannedDocuments } from "./shared/schema";
import { eq, and } from "drizzle-orm";
import { documentVerificationService } from "./server/services/document-verification-service";
import path from "path";
import fs from "fs";

async function main() {
    console.log("Searching for crew member: VENKATARANGAN BALAJI...");

    const crewList = await db.select().from(crewMembers).execute();
    const targetCrew = crewList.find(c =>
        (c.firstName + " " + c.lastName).toUpperCase().includes("VENKATARANGAN") ||
        (c.firstName + " " + c.lastName).toUpperCase().includes("BALAJI")
    );

    if (!targetCrew) {
        console.error("Crew member not found.");
        process.exit(1);
    }

    console.log(`Found Crew Member: ${targetCrew.firstName} ${targetCrew.lastName} (ID: ${targetCrew.id})`);

    const docs = await db.select().from(documents)
        .where(and(
            eq(documents.crewMemberId, targetCrew.id),
            eq(documents.type, 'passport')
        ))
        .execute();

    if (docs.length === 0) {
        console.error("No passport document found.");
        process.exit(1);
    }

    // Pick the one with the file path we saw earlier (or just the last one)
    const doc = docs.find(d => d.filePath && d.filePath.includes("passport")) || docs[docs.length - 1];

    console.log(`Analyzing Document ID: ${doc.id}`);
    console.log(`Stored Path: ${doc.filePath}`);

    if (!doc.filePath) {
        console.error("No file path stored for valid document.");
        process.exit(1);
    }

    const fullPath = path.join(process.cwd(), doc.filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`File not found on disk: ${fullPath}`);
        process.exit(1);
    }

    console.log(`File exists. Running LIVE extraction...`);

    try {
        // 1. Extract Data
        const extracted = await documentVerificationService.extractDocumentData(fullPath, doc.type, targetCrew.nationality);
        console.log("\n[LIVE EXTRACTION RESULTS]");
        console.log(JSON.stringify(extracted, null, 2));

        // 2. Simulate Verification with a MISMATCHED date
        const fakeInputData = {
            documentNumber: doc.documentNumber,
            issuingAuthority: doc.issuingAuthority,
            issueDate: new Date("2020-01-01").toISOString(),
            expiryDate: new Date("2035-01-01").toISOString(),
            type: doc.type,
            holderName: `${targetCrew.firstName} ${targetCrew.lastName}`
        };

        console.log("\n[SIMULATING VERIFICATION FAIL]");
        console.log("Inputting fake dates: Issue=2020-01-01, Expiry=2035-01-01");

        const verifyFail = await documentVerificationService.verifyDocument(fullPath, fakeInputData);
        console.log(`IsValid: ${verifyFail.isValid}`);
        console.log(`Match Score: ${verifyFail.matchScore}`);
        console.log(`Warnings:`, verifyFail.warnings);
        console.log(`Critical Mismatches:`, verifyFail.fieldComparisons.filter(c => !c.matches && ['documentNumber', 'expiryDate'].includes(c.field)).map(c => c.field));

        // 3. Simulate Verification with the date the USER used (from screenshot/DB)
        const userInputData = {
            documentNumber: doc.documentNumber,
            issuingAuthority: doc.issuingAuthority,
            issueDate: new Date("2026-02-06").toISOString(), // From screenshot
            expiryDate: new Date("2027-07-03").toISOString(), // From screenshot
            type: doc.type,
            holderName: `${targetCrew.firstName} ${targetCrew.lastName}`
        };

        console.log("\n[SIMULATING USER INPUT]");
        console.log("Inputting: Issue=2026-02-06, Expiry=2027-07-03");

        const verifyUser = await documentVerificationService.verifyDocument(fullPath, userInputData);
        console.log(`IsValid: ${verifyUser.isValid}`);
        console.log(`Match Score: ${verifyUser.matchScore}`);
    } catch (err) {
        console.error("Error during live extraction:", err);
    }

    process.exit(0);
}

main().catch(console.error);
