import { db } from "./server/db";
import { crewMembers, contracts, documents, scannedDocuments } from "./shared/schema";
import { ilike, or } from "drizzle-orm";

async function main() {
  console.log("Searching database for crew members named Saurabh or Dipankar...");
  
  const matches = await db.select().from(crewMembers).where(
    or(
      ilike(crewMembers.firstName, "%Saurabh%"),
      ilike(crewMembers.lastName, "%Saurabh%"),
      ilike(crewMembers.firstName, "%Dipankar%"),
      ilike(crewMembers.lastName, "%Dipankar%")
    )
  );

  console.log(`Found ${matches.length} matching crew members.`);
  for (const crew of matches) {
    console.log("\n================ Crew Member ================");
    console.log(JSON.stringify(crew, null, 2));

    // Search for contracts
    const crewContracts = await db.select().from(contracts).where(
      ilike(contracts.crewMemberId, crew.id)
    );
    console.log("\n--- Contracts ---");
    console.log(JSON.stringify(crewContracts, null, 2));

    // Search for documents
    const crewDocs = await db.select().from(documents).where(
      ilike(documents.crewMemberId, crew.id)
    );
    console.log("\n--- Documents ---");
    console.log(JSON.stringify(crewDocs, null, 2));
  }
  
  // Also search scanned_documents table
  const scannedDocs = await db.select().from(scannedDocuments);
  console.log(`\nTotal scanned documents in DB: ${scannedDocs.length}`);
  const matchingScanned = scannedDocs.filter(d => 
    (d.rawText && d.rawText.toLowerCase().includes("saurabh")) ||
    (d.fileName && d.fileName.toLowerCase().includes("saurabh"))
  );
  console.log(`Matching scanned documents: ${matchingScanned.length}`);
  for (const sd of matchingScanned) {
    console.log("\n================ Scanned Document ================");
    console.log(`ID: ${sd.id}`);
    console.log(`File Name: ${sd.fileName}`);
    console.log(`Status: ${sd.status}`);
    console.log(`Raw Text Length: ${sd.rawText ? sd.rawText.length : 0}`);
    console.log(`Extracted Fields:`, JSON.stringify(sd.extractedFields, null, 2));
    
    if (sd.rawText) {
      // Write raw text to a local file for analysis
      const debugFilePath = `./saurabh_scanned_text.txt`;
      fs.writeFileSync(debugFilePath, sd.rawText);
      console.log(`Saved scanned document raw text to ${debugFilePath}`);
    }
  }
}

import fs from 'fs';
main().catch(console.error).finally(() => process.exit(0));
