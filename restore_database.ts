/**
 * Database Restore Script
 * Restores data from a JSON backup file back into CockroachDB / PostgreSQL
 * 
 * Usage: npx tsx restore_database.ts <path-to-json-backup>
 * Example: npx tsx restore_database.ts backups/db_backup_2026-07-30T08-05-03.json
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Correct insertion order respecting foreign keys
const RESTORE_ORDER = [
  "users",
  "vessels",
  "crew_members",
  "contracts",
  "documents",
  "crew_rotations",
  "email_settings",
  "vessel_documents",
  "scanned_documents",
  "activity_logs",
  "notification_history",
  "status_change_history",
  "notification_log",
  "document_policies",
  "document_access_tokens",
];

async function restoreDatabase() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("❌ Please specify the backup JSON file path.");
    console.log("Usage: npx tsx restore_database.ts <path-to-json-backup>");
    process.exit(1);
  }

  const absolutePath = path.resolve(jsonPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Backup file not found: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`\n==================================================`);
  console.log(`🔄 Starting Database Restore`);
  console.log(`📄 File: ${absolutePath}`);
  console.log(`==================================================\n`);

  const fileData = fs.readFileSync(absolutePath, "utf-8");
  const backup: Record<string, any[]> = JSON.parse(fileData);

  let restoredTotal = 0;

  for (const table of RESTORE_ORDER) {
    const rows = backup[table];
    if (!rows || rows.length === 0) {
      console.log(`   ⏭️   ${table.padEnd(30)} skipped (0 rows in backup)`);
      continue;
    }

    let restoredInTable = 0;

    for (const row of rows) {
      const keys = Object.keys(row);
      const values = Object.values(row);

      const columnsStr = keys.map((k) => `"${k}"`).join(", ");
      const placeholdersStr = keys.map((_, i) => `$${i + 1}`).join(", ");
      const updateStr = keys.map((k) => `"${k}" = EXCLUDED."${k}"`).join(", ");

      const query = `
        INSERT INTO "${table}" (${columnsStr})
        VALUES (${placeholdersStr})
        ON CONFLICT DO UPDATE SET ${updateStr};
      `;

      try {
        await pool.query(query, values);
        restoredInTable++;
      } catch (err: any) {
        console.error(`   ❌ Failed to insert row into ${table}:`, err.message);
      }
    }

    restoredTotal += restoredInTable;
    console.log(`   ✅  ${table.padEnd(30)} ${restoredInTable}/${rows.length} rows restored`);
  }

  console.log(`\n==================================================`);
  console.log(`🎉 RESTORE COMPLETED SUCCESSFULLY!`);
  console.log(`📊 Total rows restored: ${restoredTotal}`);
  console.log(`==================================================\n`);

  await pool.end();
}

restoreDatabase().catch((err) => {
  console.error("❌ Restore failed:", err);
  pool.end();
  process.exit(1);
});
