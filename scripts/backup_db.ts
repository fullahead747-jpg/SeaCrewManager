import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { db } from '../server/db';
import * as schema from '../shared/schema';

// Load environment variables
config();

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', `backup-${timestamp}`);

  console.log(`🚀 Starting database backup to: ${backupDir}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const tables = [
    { name: 'users', table: schema.users },
    { name: 'vessels', table: schema.vessels },
    { name: 'crew_members', table: schema.crewMembers },
    { name: 'contracts', table: schema.contracts },
    { name: 'documents', table: schema.documents },
    { name: 'crew_rotations', table: schema.crewRotations },
    { name: 'email_settings', table: schema.emailSettings },
    { name: 'vessel_documents', table: schema.vesselDocuments },
    { name: 'scanned_documents', table: schema.scannedDocuments },
    { name: 'activity_logs', table: schema.activityLogs },
    { name: 'notification_history', table: schema.notificationHistory },
    { name: 'status_change_history', table: schema.statusChangeHistory },
    { name: 'notification_log', table: schema.notificationLog },
    { name: 'document_policies', table: schema.documentPolicies },
    { name: 'document_access_tokens', table: schema.documentAccessTokens }
  ];

  for (const tableInfo of tables) {
    try {
      console.log(`📦 Backing up table: ${tableInfo.name}...`);
      const data = await db.select().from(tableInfo.table);
      const filePath = path.join(backupDir, `${tableInfo.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`✅ Table ${tableInfo.name} backed up (${data.length} rows).`);
    } catch (error) {
      console.error(`❌ Error backing up table ${tableInfo.name}:`, error);
    }
  }

  console.log('\n✨ Database backup completed successfully!');
  console.log(`📂 Files are located in: ${backupDir}`);
  
  // Also create a summary file
  const summary = {
    timestamp: new Date().toISOString(),
    tables: tables.map(t => t.name),
    backupPath: backupDir
  };
  fs.writeFileSync(path.join(backupDir, 'summary.json'), JSON.stringify(summary, null, 2));
}

backupDatabase().catch(err => {
  console.error('💥 Critical error during backup:', err);
  process.exit(1);
});
