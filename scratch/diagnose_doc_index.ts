/**
 * COMPREHENSIVE Documents Index Diagnostic
 * Mirrors getDashboardStats exactly, then exposes every inconsistency.
 */
import { db } from '../server/db';
import { documents, crewMembers } from '../shared/schema';
import { and, isNotNull, isNull, lte, gte, gt, lt, eq, sql, count, inArray } from 'drizzle-orm';

async function main() {
  const now = new Date();
  const thirtyDaysFromNow   = new Date(now.getTime() + 30  * 24 * 60 * 60 * 1000);
  const ninetyDaysFromNow   = new Date(now.getTime() + 90  * 24 * 60 * 60 * 1000);
  const oneEightyDaysFromNow= new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  console.log(`\nAnalysis at: ${now.toISOString()}\n`);

  // ─── 1. RAW COUNTS exactly as getDashboardStats does it ─────────────────────

  // Expired: COUNT(DISTINCT crewMemberId) where expiryDate <= now AND year > 1900
  const [expiredCountRow] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${documents.crewMemberId})` })
    .from(documents)
    .where(and(
      isNotNull(documents.expiryDate),
      lte(documents.expiryDate, now),
      sql`EXTRACT(YEAR FROM ${documents.expiryDate}) > 1900`
    ));

  // TBD: year <= 1900 (Excel bug)
  const [tbdCountRow] = await db
    .select({ count: count() })
    .from(documents)
    .where(and(
      isNotNull(documents.expiryDate),
      sql`EXTRACT(YEAR FROM ${documents.expiryDate}) <= 1900`
    ));

  // Critical: expiry between now and +30d   (count of DOCUMENT RECORDS)
  const [criticalCountRow] = await db
    .select({ count: count() })
    .from(documents)
    .where(and(
      isNotNull(documents.expiryDate),
      gte(documents.expiryDate, now),
      lte(documents.expiryDate, thirtyDaysFromNow)
    ));

  // Warning: +30d to +90d
  const [warningCountRow] = await db
    .select({ count: count() })
    .from(documents)
    .where(and(
      isNotNull(documents.expiryDate),
      gt(documents.expiryDate, thirtyDaysFromNow),
      lte(documents.expiryDate, ninetyDaysFromNow)
    ));

  // Attention: +90d to +180d
  const [attentionCountRow] = await db
    .select({ count: count() })
    .from(documents)
    .where(and(
      isNotNull(documents.expiryDate),
      gt(documents.expiryDate, ninetyDaysFromNow),
      lte(documents.expiryDate, oneEightyDaysFromNow)
    ));

  // Permanent: expiryDate IS NULL
  const [permanentCountRow] = await db
    .select({ count: count() })
    .from(documents)
    .where(isNull(documents.expiryDate));

  // Far Future: expiryDate > +180d
  const [farFutureCountRow] = await db
    .select({ count: count() })
    .from(documents)
    .where(gt(documents.expiryDate, oneEightyDaysFromNow));

  // Total documents
  const [totalDocsRow] = await db
    .select({ count: count() })
    .from(documents);

  const expired   = expiredCountRow.count;
  const tbd       = tbdCountRow.count;
  const critical  = criticalCountRow.count;
  const warning   = warningCountRow.count;
  const attention = attentionCountRow.count;
  const permanent = permanentCountRow.count;
  const farFuture = farFutureCountRow.count;
  const total     = totalDocsRow.count;
  const valid     = permanent + farFuture + tbd;  // what getDashboardStats computes as "validDocsCount"

  console.log('=== WHAT getDashboardStats SENDS TO FRONTEND ===\n');
  console.log(`  documentHealth.expired   = ${expired}    ← COUNT(DISTINCT crewMemberId) where expired`);
  console.log(`  documentHealth.critical  = ${critical}   ← COUNT(*) document records expiring ≤ 30d`);
  console.log(`  documentHealth.warning   = ${warning}    ← COUNT(*) document records expiring 30-90d`);
  console.log(`  documentHealth.attention = ${attention}  ← COUNT(*) document records expiring 90-180d`);
  console.log(`  documentHealth.valid     = ${valid}      ← permanent(${permanent}) + farFuture(${farFuture}) + tbd(${tbd})`);
  console.log(`  documentHealth.total     = ${total}      ← COUNT(*) ALL documents`);

  const frontendSum = expired + critical + warning + attention + valid;
  console.log(`\n  Sum of categories shown in pie: ${frontendSum}`);
  console.log(`  Actual total documents:         ${total}`);
  console.log(`  Difference (sum - total):       ${frontendSum - total}`);

  // ─── 2. CONSISTENCY CHECK: Does expired use DISTINCT while others don't? ────
  console.log('\n=== UNIT MISMATCH ANALYSIS ===\n');
  console.log('  "Expired"   counts DISTINCT CREW MEMBERS (persons)');
  console.log('  All others  count DOCUMENT RECORDS (rows)');
  console.log('  → The pie chart mixes two different units — this is a fundamental bug.\n');

  // Count expired as document records (not DISTINCT crew)
  const [expiredAsDocsRow] = await db
    .select({ count: count() })
    .from(documents)
    .where(and(
      isNotNull(documents.expiryDate),
      lte(documents.expiryDate, now),
      sql`EXTRACT(YEAR FROM ${documents.expiryDate}) > 1900`
    ));
  const expiredAsDocs = expiredAsDocsRow.count;
  console.log(`  Expired as DOCUMENT RECORDS (like the other categories): ${expiredAsDocs}`);
  console.log(`  Expired as DISTINCT CREW MEMBERS (what dashboard currently shows): ${expired}`);

  // ─── 3. DUPLICATE DOCUMENT RECORDS PER CREW MEMBER ──────────────────────────
  console.log('\n=== DUPLICATE DOCUMENTS CHECK ===\n');
  const allDocs = await db
    .select({
      id: documents.id,
      crewMemberId: documents.crewMemberId,
      type: documents.type,
      expiryDate: documents.expiryDate,
      createdAt: documents.createdAt,
    })
    .from(documents);

  const byCrewType = new Map<string, typeof allDocs>();
  for (const doc of allDocs) {
    const key = `${doc.crewMemberId}::${doc.type}`;
    if (!byCrewType.has(key)) byCrewType.set(key, []);
    byCrewType.get(key)!.push(doc);
  }

  let duplicateGroups = 0;
  let duplicateRecords = 0;
  for (const [key, group] of byCrewType.entries()) {
    if (group.length > 1) {
      duplicateGroups++;
      duplicateRecords += group.length - 1;
    }
  }
  console.log(`  (crewMemberId, type) pairs with > 1 record: ${duplicateGroups}`);
  console.log(`  Extra (duplicate) document records:          ${duplicateRecords}`);
  console.log(`  These inflate critical/warning/attention/valid counts.`);

  // ─── 4. TBD DATES (year <= 1900) TREATMENT ──────────────────────────────────
  console.log('\n=== TBD / BUGGY DATES ===\n');
  console.log(`  Documents with expiryDate year ≤ 1900 (Excel TBD bug): ${tbd}`);
  console.log(`  These are counted in "valid" (permanentDocs + farFutureDocs + tbdDocs)`);
  console.log(`  But they DON'T appear in expired/critical/warning/attention.`);
  console.log(`  This is reasonable IF they are intentionally TBD, but should be verified.`);

  // ─── 5. DRILLDOWN vs STATS CONSISTENCY ──────────────────────────────────────
  console.log('\n=== DRILLDOWN ENDPOINT vs STATS ENDPOINT COMPARISON ===\n');
  console.log('  getDashboardStats (pie numbers):');
  console.log(`    expired   = COUNT(DISTINCT crewMemberId) where expiryDate ≤ now`);
  console.log(`    critical  = COUNT(*) docs where expiry between now and +30d`);
  console.log('');
  console.log('  getDrilldown (what modal shows for "expired" key):');
  console.log(`    key='expired': doc.expiryDate < now AND year > 1900  → adds crewMemberId to a Set`);
  console.log(`    → returns UNIQUE crew members who have ≥ 1 expired doc`);
  console.log('');
  console.log('  getDrilldown for "critical" key:');
  console.log(`    key='critical': doc.expiryDate >= now AND expiryDate <= +30d → adds crewMemberId to a Set`);
  console.log(`    → returns UNIQUE crew members who have ≥ 1 critical doc`);
  console.log('');
  console.log('  So: pie chart "critical" = COUNT of DOCUMENT RECORDS');
  console.log('      drilldown "critical" = COUNT of CREW MEMBERS with ≥ 1 critical doc');
  console.log('  → THESE WILL ALMOST ALWAYS DIFFER. The number shown in the pie ≠ number of rows in modal.');

  // Get unique crew counts for each category for comparison
  const allDocsForCrew = await db.select().from(documents);
  const crewSets = {
    expired:   new Set<string>(),
    critical:  new Set<string>(),
    warning:   new Set<string>(),
    attention: new Set<string>(),
    valid:     new Set<string>(),
  };

  for (const doc of allDocsForCrew) {
    if (!doc.expiryDate) { crewSets.valid.add(doc.crewMemberId); continue; }
    const year = new Date(doc.expiryDate).getFullYear();
    if (year <= 1900) { crewSets.valid.add(doc.crewMemberId); continue; }
    const expiry = new Date(doc.expiryDate);
    if (expiry <= now) crewSets.expired.add(doc.crewMemberId);
    else if (expiry <= thirtyDaysFromNow) crewSets.critical.add(doc.crewMemberId);
    else if (expiry <= ninetyDaysFromNow) crewSets.warning.add(doc.crewMemberId);
    else if (expiry <= oneEightyDaysFromNow) crewSets.attention.add(doc.crewMemberId);
    else crewSets.valid.add(doc.crewMemberId);
  }

  console.log('\n=== WHAT THE DRILLDOWN MODAL ACTUALLY RETURNS (crew member counts) ===\n');
  console.log(`  Expired   → ${crewSets.expired.size}  crew members`);
  console.log(`  Critical  → ${crewSets.critical.size}  crew members`);
  console.log(`  Warning   → ${crewSets.warning.size}  crew members`);
  console.log(`  Attention → ${crewSets.attention.size}  crew members`);
  console.log(`  Valid     → ${crewSets.valid.size}  crew members`);

  console.log('\n=== WHAT THE PIE CHART SHOWS (mixed units) ===\n');
  console.log(`  Expired   → ${expired} (DISTINCT crew)`);
  console.log(`  Critical  → ${critical} (document RECORDS)`);
  console.log(`  Warning   → ${warning} (document RECORDS)`);
  console.log(`  Attention → ${attention} (document RECORDS)`);
  console.log(`  Valid     → ${valid} (document RECORDS)`);
  console.log(`  Total label = ${total} DOCUMENTS`);

  console.log('\n=== SUMMARY OF BUGS FOUND ===\n');
  console.log('  BUG 1: UNIT MISMATCH — "Expired" counts DISTINCT crew members,');
  console.log('         while Critical/Warning/Attention/Valid count raw document RECORDS.');
  console.log('         The pie chart slices are NOT comparable to each other.\n');
  console.log('  BUG 2: PIE ≠ MODAL — The number shown in the pie chart segment');
  console.log('         does NOT match the row count shown in the drill-down modal.');
  console.log('         (Pie shows doc-record counts; modal shows unique-crew counts)\n');
  console.log('  BUG 3: SUM INCONSISTENCY — The sum of all category counts');
  console.log(`         (${frontendSum}) may not equal totalDocsCount (${total}).`);
  console.log(`         Because: expired uses DISTINCT, others use COUNT(*), and`);
  console.log(`         a crew member with both expired AND critical docs would be`);
  console.log(`         counted in BOTH expired (DISTINCT) AND critical (doc count).\n`);
  if (duplicateRecords > 0) {
    console.log(`  BUG 4: DUPLICATE RECORDS — ${duplicateRecords} extra document records exist`);
    console.log(`         for ${duplicateGroups} (crewMemberId, type) pairs, inflating counts.\n`);
  } else {
    console.log('  BUG 4: No duplicate (crewMemberId, type) records found. DB is clean.\n');
  }
}

main().catch(console.error).finally(() => process.exit(0));
