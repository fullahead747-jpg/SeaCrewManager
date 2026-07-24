/**
 * ONE-TIME CLEANUP: Delete duplicate document records
 *
 * For each (crewMemberId, type) pair that has more than 1 record,
 * keep only the most recently created one and delete the rest.
 * Also deletes associated scanned_documents records first to avoid FK violations.
 */

import { db } from '../server/db';
import { documents, scannedDocuments } from '../shared/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';

async function main() {
  console.log('🔍 Scanning for duplicate document records...\n');

  // Get all documents
  const allDocs = await db
    .select({
      id: documents.id,
      crewMemberId: documents.crewMemberId,
      type: documents.type,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .orderBy(documents.crewMemberId, documents.type, documents.createdAt);

  // Group by (crewMemberId, type)
  const groupMap = new Map<string, typeof allDocs>();
  for (const doc of allDocs) {
    const key = `${doc.crewMemberId}::${doc.type}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(doc);
  }

  const toDelete: string[] = [];

  for (const [key, group] of groupMap.entries()) {
    if (group.length <= 1) continue;

    // Sort by createdAt descending — latest first
    group.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

    const [keep, ...duplicates] = group;
    console.log(`📋 [${key}] — ${group.length} records found. Keeping: ${keep.id} (${keep.createdAt?.toISOString()})`);
    for (const dup of duplicates) {
      console.log(`   ❌ Deleting: ${dup.id} (${dup.createdAt?.toISOString()})`);
      toDelete.push(dup.id);
    }
  }

  if (toDelete.length === 0) {
    console.log('\n✅ No duplicates found. Database is clean.');
    return;
  }

  console.log(`\n🗑️  Total records to delete: ${toDelete.length}`);

  // Step 1: Delete associated scanned_documents (FK constraint)
  const scanDelResult = await db
    .delete(scannedDocuments)
    .where(inArray(scannedDocuments.documentId, toDelete));
  console.log(`   Deleted ${scanDelResult.rowCount ?? 0} scanned_documents records`);

  // Step 2: Delete the duplicate document records
  const docDelResult = await db
    .delete(documents)
    .where(inArray(documents.id, toDelete));
  console.log(`   Deleted ${docDelResult.rowCount ?? 0} document records`);

  console.log('\n✅ Cleanup complete.');
}

main().catch(console.error).finally(() => process.exit(0));
