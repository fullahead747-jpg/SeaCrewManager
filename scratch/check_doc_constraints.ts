import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  // Check indexes on documents table
  const indexes = await db.execute(sql`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'documents' 
    ORDER BY indexname
  `);
  console.log('\n=== INDEXES ON documents TABLE ===');
  for (const row of indexes.rows) {
    console.log(`  ${(row as any).indexname}: ${(row as any).indexdef}`);
  }

  // Check constraints
  const constraints = await db.execute(sql`
    SELECT conname, contype, pg_get_constraintdef(oid) as definition
    FROM pg_constraint 
    WHERE conrelid = 'documents'::regclass
    ORDER BY conname
  `);
  console.log('\n=== CONSTRAINTS ON documents TABLE ===');
  for (const row of constraints.rows) {
    const r = row as any;
    const typeLabel = r.contype === 'p' ? 'PRIMARY KEY' : r.contype === 'u' ? 'UNIQUE' : r.contype === 'f' ? 'FOREIGN KEY' : r.contype === 'c' ? 'CHECK' : r.contype;
    console.log(`  ${r.conname} (${typeLabel}): ${r.definition}`);
  }

  // Check if any UNIQUE constraint exists on (crew_member_id, type)
  console.log('\n=== UNIQUE CONSTRAINT CHECK ===');
  const uniqueOnCrewType = constraints.rows.filter((r: any) => 
    r.contype === 'u' && r.definition?.includes('crew_member_id') && r.definition?.includes('type')
  );
  if (uniqueOnCrewType.length === 0) {
    console.log('  ❌ NO unique constraint on (crew_member_id, type) — DB allows duplicates!');
  } else {
    console.log('  ✅ UNIQUE constraint found on (crew_member_id, type)');
  }

  // Count current duplicates
  const duplicates = await db.execute(sql`
    SELECT crew_member_id, type, COUNT(*) as cnt
    FROM documents
    GROUP BY crew_member_id, type
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log(`\n=== CURRENT DUPLICATE DOCUMENT GROUPS (crew_member_id, type) ===`);
  if (duplicates.rows.length === 0) {
    console.log('  ✅ No duplicates found currently');
  } else {
    console.log(`  ❌ Found ${duplicates.rows.length} groups with duplicates:`);
    for (const row of duplicates.rows) {
      const r = row as any;
      console.log(`    crew=${r.crew_member_id}, type=${r.type}, count=${r.cnt}`);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
