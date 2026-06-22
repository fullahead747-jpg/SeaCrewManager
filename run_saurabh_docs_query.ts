import 'dotenv/config';
import { db } from './server/db';
import { documents, crewMembers } from './shared/schema';
import { eq, ilike, or } from 'drizzle-orm';

async function main() {
  console.log('Looking up Saurabh Dipankar documents...\n');

  // Find crew member first
  const crew = await db.select().from(crewMembers).where(
    or(
      ilike(crewMembers.firstName, '%Saurabh%'),
      ilike(crewMembers.lastName, '%Dipankar%')
    )
  );

  if (!crew.length) {
    console.log('No crew member found for Saurabh Dipankar');
    return;
  }

  for (const c of crew) {
    console.log(`Crew Member: ${c.firstName} ${c.lastName} (ID: ${c.id})`);
    console.log(`  Nationality: ${c.nationality}`);
    console.log(`  Rank: ${c.rank}`);

    const docs = await db.select().from(documents).where(eq(documents.crewMemberId, c.id));
    console.log(`\n  Documents (${docs.length} total):`);
    for (const doc of docs) {
      console.log(`  - Type: ${doc.type}, Number: ${doc.documentNumber}, File: ${doc.filePath}`);
      console.log(`    Issue: ${doc.issueDate}, Expiry: ${doc.expiryDate}`);
      console.log(`    ID: ${doc.id}`);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
