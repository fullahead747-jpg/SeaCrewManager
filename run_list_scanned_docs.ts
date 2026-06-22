import { db } from "./server/db";
import { scannedDocuments } from "./shared/schema";
import { desc } from "drizzle-orm";

async function main() {
  console.log("Fetching the latest 20 scanned documents from the database...");
  const docs = await db.select().from(scannedDocuments).orderBy(desc(scannedDocuments.createdAt)).limit(20);

  // Print only basic info to avoid too much noise
  const summary = docs.map(d => ({
    id: d.id,
    fileName: d.fileName,
    status: d.status,
    createdAt: d.createdAt,
    hasRawText: !!d.rawText,
    rawTextLength: d.rawText ? d.rawText.length : 0,
    extractedFieldsKeys: d.extractedFields ? Object.keys(d.extractedFields) : []
  }));

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
