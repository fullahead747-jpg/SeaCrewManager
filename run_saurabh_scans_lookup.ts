import { db } from "./server/db";
import { scannedDocuments } from "./shared/schema";
import { inArray } from "drizzle-orm";

async function main() {
  const docIds = [
    "1a4db6fa-8cd5-4373-8ec1-a3f507ef00ec",
    "5c1282fd-96fd-46ab-bd41-c364e80b8c0b",
    "6a0675f8-5c54-4655-addc-2adf4038315d",
    "909293a2-a69f-4fcd-8f4e-6cac5723e069",
    "988f7169-0c98-43a1-8f0e-15931347f509",
    "9a5c71a8-9ad3-4b13-a95f-c85ba147d2ef",
    "be31d673-2ab3-40b1-b365-3ca2cfccab6e"
  ];
  
  console.log("Searching scanned_documents for Saurabh's document IDs...");
  const scans = await db.select().from(scannedDocuments).where(inArray(scannedDocuments.documentId, docIds));
  
  console.log(`Found ${scans.length} matching scanned documents.`);
  for (const scan of scans) {
    console.log(`\nScan ID: ${scan.id}, Doc ID: ${scan.documentId}`);
    console.log(`Seafarer Name in Scan: ${scan.seafarerName}`);
    console.log(`Extracted Number: ${scan.extractedNumber}`);
    console.log(`Extracted Issue: ${scan.extractedIssueDate}`);
    console.log(`Extracted Expiry: ${scan.extractedExpiry}`);
    console.log(`Confidence: ${scan.ocrConfidence}`);
    console.log(`Raw Text snippet: ${scan.rawText ? scan.rawText.substring(0, 100) : "none"}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
