
import { db } from "../server/db";
import { crewMembers, documents, contracts } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function checkSalmanData() {
  console.log("Searching for SALMAN MOHAMMAD...");
  
  const salmans = await db.select().from(crewMembers)
    .where(
      and(
        eq(crewMembers.firstName, "SALMAN"),
        eq(crewMembers.lastName, "MOHAMMAD")
      )
    );

  if (salmans.length === 0) {
    console.log("No crew member found with name SALMAN MOHAMMAD");
    return;
  }

  for (const salman of salmans) {
    console.log(`\nFound Seafarer: ${salman.firstName} ${salman.lastName} (ID: ${salman.id})`);
    
    // Check documents
    const crewDocs = await db.select().from(documents)
      .where(eq(documents.crewMemberId, salman.id));
    
    console.log("\n--- Documents ---");
    if (crewDocs.length === 0) {
      console.log("No documents found in documents table.");
    } else {
      crewDocs.forEach(doc => {
        console.log(`Type: ${doc.type}, ID: ${doc.id}, FilePath: ${doc.filePath || 'NULL'}`);
      });
    }

    // Check contracts
    const crewContracts = await db.select().from(contracts)
      .where(and(eq(contracts.crewMemberId, salman.id), eq(contracts.status, 'active')));
    
    console.log("\n--- Active Contracts ---");
    if (crewContracts.length === 0) {
      console.log("No active contracts found.");
    } else {
      crewContracts.forEach(contract => {
        console.log(`ID: ${contract.id}, FilePath: ${contract.filePath || 'NULL'}, Start: ${contract.startDate}, End: ${contract.endDate}`);
      });
    }
  }
}

checkSalmanData().catch(console.error);
