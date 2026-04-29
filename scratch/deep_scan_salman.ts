
import { db } from "../server/db";
import { crewMembers, documents } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function deepScanSalman() {
  console.log("--- Deep Scanning Salman Mohammad's Documents ---");
  
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
  console.log(`Passport N/A: ${salman.passportNotApplicable}`);

  const allDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.crewMemberId, salman.id));

  console.log(`\nFound ${allDocs.length} total documents:`);
  
  // Group by type to find duplicates
  const grouped: Record<string, any[]> = {};
  allDocs.forEach(d => {
    if (!grouped[d.type]) grouped[d.type] = [];
    grouped[d.type].push(d);
  });

  Object.entries(grouped).forEach(([type, docs]) => {
    console.log(`\nType: ${type} (${docs.length} records)`);
    docs.forEach((d, i) => {
      console.log(`  [${i}] ID: ${d.id}, Number: ${d.documentNumber}, FilePath: ${d.filePath ? 'YES' : 'NULL'}, Created: ${d.createdAt}`);
    });
  });
}

deepScanSalman().catch(console.error).finally(() => process.exit());
