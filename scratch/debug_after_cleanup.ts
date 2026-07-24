/**
 * Quick check: what documents remain for the two crew members
 * that previously had expired docs?
 */
import { db } from '../server/db';
import { documents, crewMembers } from '../shared/schema';
import { eq, or, sql, and, isNotNull, lte } from 'drizzle-orm';

async function main() {
  const now = new Date();
  console.log('Current time (UTC):', now.toISOString());

  // Find NARATTAM and NOBY
  const crew = await db
    .select({ id: crewMembers.id, firstName: crewMembers.firstName, lastName: crewMembers.lastName })
    .from(crewMembers)
    .where(or(
      sql`lower(${crewMembers.firstName}) like '%narattam%'`,
      sql`lower(${crewMembers.firstName}) like '%noby%'`,
    ));

  console.log('\nFound crew:', crew.map(c => `${c.firstName} ${c.lastName} (${c.id})`));

  for (const c of crew) {
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.crewMemberId, c.id));

    console.log(`\n${c.firstName} ${c.lastName} — ${docs.length} document(s):`);
    for (const d of docs) {
      const expiryYear = d.expiryDate ? new Date(d.expiryDate).getFullYear() : null;
      const isExpiredByDate = d.expiryDate && new Date(d.expiryDate) < now;
      const yearGt1900 = expiryYear && expiryYear > 1900;
      console.log(`  [${d.type}] expiry: ${d.expiryDate?.toISOString() ?? 'null'} | year: ${expiryYear} | isExpiredByDate: ${isExpiredByDate} | yearGt1900: ${yearGt1900} | status: ${d.status}`);
    }
  }

  // Also run the same query used in getDashboardStats
  const expiredQuery = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${documents.crewMemberId})` })
    .from(documents)
    .where(and(
      isNotNull(documents.expiryDate),
      lte(documents.expiryDate, now),
      sql`EXTRACT(YEAR FROM ${documents.expiryDate}) > 1900`
    ));

  console.log('\n\ngetDashboardStats COUNT DISTINCT result:', expiredQuery[0]?.count);
}

main().catch(console.error).finally(() => process.exit(0));
