import { db } from '../db';
import { sql } from 'drizzle-orm';

async function createTransitionsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS daily_compliance_transitions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        crew_member_id VARCHAR NOT NULL,
        contract_id VARCHAR,
        vessel_id VARCHAR,
        previous_category TEXT NOT NULL,
        new_category TEXT NOT NULL,
        transition_date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Created daily_compliance_transitions table successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating daily_compliance_transitions table:', err);
    process.exit(1);
  }
}

createTransitionsTable();
