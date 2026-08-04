/**
 * Full System Backup Script
 * Creates a complete ZIP package containing:
 * 1. CockroachDB database JSON dump
 * 2. Uploaded document files (uploads/ folder)
 * 3. Attached assets (attached_assets/ folder)
 * 
 * Run with: npx tsx create_full_backup.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import archiver from "archiver";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

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

async function createFullBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dateStr = new Date().toISOString().slice(0, 10);
  const backupDir = path.resolve(".", "backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const jsonBackupPath = path.join(backupDir, `db_backup_${timestamp}.json`);
  const zipBackupPath = path.join(backupDir, `FULL_BACKUP_${dateStr}_${timestamp.slice(11)}.zip`);

  console.log(`\n==================================================`);
  console.log(`🚀 Starting Full SeaCrewManager System Backup`);
  console.log(`📅 Date & Time: ${new Date().toLocaleString()}`);
  console.log(`==================================================\n`);

  // Step 1: Export Database
  console.log(`📦 [1/2] Backing up CockroachDB database...`);
  const backupData: Record<string, any[]> = {
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
      backupData[table] = result.rows;
      totalRows += result.rows.length;
      console.log(`   ✅  ${table.padEnd(30)} ${result.rows.length} rows`);
    } catch (err: any) {
      console.log(`   ⚠️   ${table.padEnd(30)} skipped (${err.message.split("\n")[0]})`);
      backupData[table] = [];
    }
  }

  fs.writeFileSync(jsonBackupPath, JSON.stringify(backupData, null, 2), "utf-8");
  const jsonSizeMB = (fs.statSync(jsonBackupPath).size / (1024 * 1024)).toFixed(2);
  console.log(`   📄 Database JSON saved (${jsonSizeMB} MB, ${totalRows} total rows)\n`);

  await pool.end();

  // Step 2: Create Zip Archive (DB JSON + uploads/ + attached_assets/)
  console.log(`📦 [2/2] Archiving database dump & physical files into ZIP...`);

  const output = fs.createWriteStream(zipBackupPath);
  const archive = archiver("zip", { zlib: { level: 6 } });

  return new Promise<void>((resolve, reject) => {
    output.on("close", () => {
      const zipSizeMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
      console.log(`\n==================================================`);
      console.log(`🎉 FULL BACKUP CREATED SUCCESSFULLY!`);
      console.log(`==================================================`);
      console.log(`📊  Total DB Rows:    ${totalRows}`);
      console.log(`💾  Archive Size:     ${zipSizeMB} MB`);
      console.log(`📁  Zip Archive Path: ${zipBackupPath}`);
      console.log(`📄  JSON Backup Path: ${jsonBackupPath}`);
      console.log(`==================================================\n`);
      resolve();
    });

    archive.on("error", (err) => {
      console.error("❌ ZIP Compression failed:", err);
      reject(err);
    });

    archive.pipe(output);

    // Add JSON backup file
    archive.file(jsonBackupPath, { name: `database_backup_${timestamp}.json` });

    // Add uploads directory if exists
    const uploadsDir = path.resolve(".", "uploads");
    if (fs.existsSync(uploadsDir)) {
      console.log(`   📂 Adding uploaded document files (uploads/)...`);
      archive.directory(uploadsDir, "uploads");
    }

    // Add attached_assets directory if exists
    const attachedAssetsDir = path.resolve(".", "attached_assets");
    if (fs.existsSync(attachedAssetsDir)) {
      console.log(`   📂 Adding attached assets (attached_assets/)...`);
      archive.directory(attachedAssetsDir, "attached_assets");
    }

    archive.finalize();
  });
}

createFullBackup().catch((err) => {
  console.error("❌ Full backup failed:", err);
  pool.end();
  process.exit(1);
});
