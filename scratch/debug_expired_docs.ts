/**
 * Diagnostic: Expired Documents Count Mismatch
 *
 * The dashboard shows ~10-11 expired documents, but user sees only 2 crew
 * members with expired documents when reviewing manually.
 *
 * Hypothesis: The count in getDashboardStats counts individual *document records*
 * (one per document type), not the number of *crew members* who have >= 1 expired doc.
 *
 * This script will:
 *  1. Fetch all expired document records (year > 1900) — same filter as getDashboardStats
 *  2. Show how many distinct crew members they belong to
 *  3. Show the raw breakdown per crew member + document type
 */

import { db } from '../server/db';
import { documents, crewMembers } from '../shared/schema';
import { and, isNotNull, lte, sql, inArray } from 'drizzle-orm';

async function main() {
  const now = new Date();

  // Exactly the same filter used in getDashboardStats for expiredDocsCount
  const expiredDocs = await db
    .select({
      id: documents.id,
      crewMemberId: documents.crewMemberId,
      type: documents.type,
      documentNumber: documents.documentNumber,
      expiryDate: documents.expiryDate,
      status: documents.status,
    })
    .from(documents)
    .where(
      and(
        isNotNull(documents.expiryDate),
        lte(documents.expiryDate, now),
        sql`EXTRACT(YEAR FROM ${documents.expiryDate}) > 1900`
      )
    );

  console.log(`\n=== TOTAL expired document RECORDS: ${expiredDocs.length} ===\n`);

  // Group by crew member
  const byCrewId = new Map<string, typeof expiredDocs>();
  for (const doc of expiredDocs) {
    if (!byCrewId.has(doc.crewMemberId)) byCrewId.set(doc.crewMemberId, []);
    byCrewId.get(doc.crewMemberId)!.push(doc);
  }

  console.log(`=== DISTINCT crew members with >= 1 expired doc: ${byCrewId.size} ===\n`);

  // Fetch crew names
  const crewIds = Array.from(byCrewId.keys());
  const crewList = crewIds.length > 0
    ? await db
        .select({
          id: crewMembers.id,
          firstName: crewMembers.firstName,
          lastName: crewMembers.lastName,
          status: crewMembers.status
        })
        .from(crewMembers)
        .where(inArray(crewMembers.id, crewIds))
    : [];

  const crewNameMap = new Map(crewList.map(c => [c.id, `${c.firstName} ${c.lastName} (${c.status})`]));

  console.log('Breakdown per crew member:\n');
  for (const [crewId, docs] of byCrewId.entries()) {
    const name = crewNameMap.get(crewId) ?? `Unknown (${crewId})`;
    console.log(`  ${name}`);
    for (const doc of docs) {
      console.log(`    - [${doc.type}] expires: ${doc.expiryDate?.toISOString().split('T')[0]}, status field: ${doc.status}`);
    }
    console.log('');
  }
}

main().catch(console.error).finally(() => process.exit(0));
