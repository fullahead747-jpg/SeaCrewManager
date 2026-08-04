/**
 * Database Backup Script
 * Exports all tables from CockroachDB to a timestamped JSON file in ./backups/
 * Run with: npx tsx backup_database.ts
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
const db = drizzle(pool);

const TABLES = [
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

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = path.join(".", "backups");
  const backupFile = path.join(backupDir, `db_backup_${timestamp}.json`);

  // Ensure backups directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`\n🗄️  SeaCrewManager Database Backup`);
  console.log(`📅  Timestamp: ${new Date().toLocaleString()}`);
  console.log(`📁  Output: ${backupFile}\n`);

  const backup: Record<string, any[]> = {
    _meta: {
      timestamp: new Date().toISOString(),
      tables: TABLES,
      version: "1.0",
    } as any,
  };

  let totalRows = 0;

  for (const table of TABLES) {
    try {
      let result;
      try {
        result = await pool.query(`SELECT * FROM "${table}" ORDER BY created_at ASC NULLS LAST`);
      } catch {
        result = await pool.query(`SELECT * FROM "${table}"`);
      }
      backup[table] = result.rows;
      totalRows += result.rows.length;
      console.log(`  ✅  ${table.padEnd(35)} ${result.rows.length} rows`);
    } catch (err: any) {
      console.log(`  ⚠️   ${table.padEnd(35)} skipped (${err.message.split("\n")[0]})`);
      backup[table] = [];
    }
  }

  // Write backup to file
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), "utf-8");

  const fileSizeKB = (fs.statSync(backupFile).size / 1024).toFixed(1);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅  Backup complete!`);
  console.log(`📊  Total rows: ${totalRows}`);
  console.log(`💾  File size:  ${fileSizeKB} KB`);
  console.log(`📄  Saved to:   ${backupFile}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  await pool.end();
}

backupDatabase().catch((err) => {
  console.error("❌ Backup failed:", err);
  pool.end();
  process.exit(1);
});
