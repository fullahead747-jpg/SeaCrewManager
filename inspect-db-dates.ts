
import { db } from "./server/db";
import { documents } from "./shared/schema";

async function main() {
  console.log("Searching for problematic dates in the database...");
  const allDocs = await db.select().from(documents);
  console.log(`Found ${allDocs.length} documents.`);

  const problematic = allDocs.filter(doc => {
    const issueStr = doc.issueDate ? String(doc.issueDate) : "";
    const expiryStr = doc.expiryDate ? String(doc.expiryDate) : "";
    return issueStr.includes("-1") || expiryStr.includes("-1") || 
           issueStr.includes("1969") || expiryStr.includes("1969") ||
           issueStr.includes("1970") || expiryStr.includes("1970");
  });

  if (problematic.length === 0) {
    console.log("No -1 or epoch-adjacent dates found in the database.");
  } else {
    console.log(`Found ${problematic.length} problematic documents:`);
    problematic.forEach(doc => {
      console.log(`ID: ${doc.id}, Type: ${doc.type}, Issue: ${doc.issueDate}, Expiry: ${doc.expiryDate}`);
    });
  }
}

main().catch(console.error).finally(() => process.exit(0));
