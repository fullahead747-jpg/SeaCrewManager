import { db } from "./server/db";
import { crewMembers, contracts, documents } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const crewId = "64bdb8da-dfeb-440c-a51a-32e6fb2edacb";
  console.log(`Fetching details for crew member ID: ${crewId}`);
  
  const [crew] = await db.select().from(crewMembers).where(eq(crewMembers.id, crewId));
  console.log("\n--- Crew Member ---");
  console.log(JSON.stringify(crew, null, 2));

  const crewContracts = await db.select().from(contracts).where(eq(contracts.crewMemberId, crewId));
  console.log("\n--- Contracts ---");
  console.log(JSON.stringify(crewContracts, null, 2));

  const crewDocs = await db.select().from(documents).where(eq(documents.crewMemberId, crewId));
  console.log("\n--- Documents ---");
  console.log(JSON.stringify(crewDocs, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
