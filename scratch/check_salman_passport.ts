
import { db } from "../server/db";
import { crewMembers, documents, contracts } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function checkSalmanPassport() {
  console.log("--- Checking Salman Mohammad's Documents ---");
  
  // 1. Find Salman Mohammad
  const [salman] = await db
    .select()
    .from(crewMembers)
    .where(
      and(
        eq(crewMembers.firstName, "SALMAN"),
        eq(crewMembers.lastName, "MOHAMMAD")
      )
    );

  if (!salman) {
    console.log("Salman Mohammad not found.");
    return;
  }

  console.log(`Found Salman (ID: ${salman.id})`);

  // 2. Check Passport
  const salmanDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.crewMemberId, salman.id));

  console.log("\nDocuments found:");
  salmanDocs.forEach(d => {
    console.log(`- Type: ${d.type}, Number: ${d.documentNumber}, FilePath: ${d.filePath || 'NULL'}`);
  });

  // 3. Check Active Contract
  const [contract] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.crewMemberId, salman.id), eq(contracts.status, 'active')));

  if (contract) {
    console.log(`\nActive Contract (ID: ${contract.id}): FilePath: ${contract.filePath || 'NULL'}`);
  } else {
    console.log("\nNo active contract found.");
  }
}

checkSalmanPassport().catch(console.error).finally(() => process.exit());
