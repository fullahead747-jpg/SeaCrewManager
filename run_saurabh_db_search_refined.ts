import { db } from "./server/db";
import { crewMembers, scannedDocuments } from "./shared/schema";
import { ilike, or } from "drizzle-orm";

async function main() {
  console.log("Searching database for 'Saurabh'...");
  
  const crewMatches = await db.select().from(crewMembers).where(
    or(
      ilike(crewMembers.firstName, "%Saurabh%"),
      ilike(crewMembers.lastName, "%Saurabh%")
    )
  );

  console.log(`\nFound ${crewMatches.length} matching crew members.`);
  for (const crew of crewMatches) {
    console.log(`ID: ${crew.id}, Name: ${crew.firstName} ${crew.lastName}, DOB: ${crew.dateOfBirth}, Rank: ${crew.rank}`);
  }
  
  const scannedDocs = await db.select().from(scannedDocuments);
  const matchingScanned = scannedDocs.filter(d => 
    (d.rawText && d.rawText.toLowerCase().includes("saurabh")) ||
    (d.fileName && d.fileName.toLowerCase().includes("saurabh"))
  );
  
  console.log(`\nFound ${matchingScanned.length} matching scanned documents.`);
  for (const sd of matchingScanned) {
    console.log(`ID: ${sd.id}, FileName: ${sd.fileName}, Status: ${sd.status}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
