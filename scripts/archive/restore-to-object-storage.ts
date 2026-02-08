import fs from 'fs';
import path from 'path';
import { db } from '../../server/db';
import { documents, contracts } from '../../shared/schema';
import { DocumentStorageService, objectStorageClient } from '../../server/objectStorage';
import { eq } from 'drizzle-orm';
import { getMimeType } from '../../server/utils'; // Assuming this utility exists or I'll implement a simple one

async function migrate() {
    console.log('🚀 Starting Document Restoration to Object Storage...\n');

    const storageService = new DocumentStorageService();
    const uploadsDir = path.join(process.cwd(), 'uploads');

    // 1. Migrate Crew Documents
    console.log('📂 Migrating Crew Documents...');
    const allDocs = await db.select().from(documents);
    let crewDocsCount = 0;

    for (const doc of allDocs) {
        if (doc.filePath && !doc.filePath.startsWith('/')) {
            const localPath = path.join(process.cwd(), doc.filePath);

            if (fs.existsSync(localPath)) {
                console.log(`  [MIGRATING] Doc ID ${doc.id}: ${doc.filePath}`);
                try {
                    const fileName = path.basename(localPath);
                    const uploadUrl = await storageService.getDocumentUploadURL('crew', doc.crewMemberId, fileName);

                    const fileBuffer = fs.readFileSync(localPath);
                    const response = await fetch(uploadUrl, {
                        method: 'PUT',
                        body: fileBuffer,
                        headers: {
                            'Content-Type': 'application/pdf' // Default to PDF or detect
                        }
                    });

                    if (response.ok) {
                        const cloudPath = storageService.normalizeDocumentPath(uploadUrl);
                        await db.update(documents).set({ filePath: cloudPath }).where(eq(documents.id, doc.id));
                        console.log(`  [SUCCESS] -> ${cloudPath}`);
                        crewDocsCount++;
                    } else {
                        console.error(`  [FAILED] Upload failed for Doc ID ${doc.id}: ${response.statusText}`);
                    }
                } catch (e) {
                    console.error(`  [ERROR] Doc ID ${doc.id}:`, e.message);
                }
            } else {
                console.warn(`  [MISSING] Local file not found: ${localPath}`);
            }
        } else if (doc.filePath?.startsWith('/')) {
            console.log(`  [SKIP] Doc ID ${doc.id} already in cloud.`);
        }
    }

    // 2. Migrate Contracts
    console.log('\n📂 Migrating Contracts...');
    const allContracts = await db.select().from(contracts);
    let contractsCount = 0;

    for (const contract of allContracts) {
        if (contract.filePath && !contract.filePath.startsWith('/')) {
            const localPath = path.join(process.cwd(), contract.filePath);

            if (fs.existsSync(localPath)) {
                console.log(`  [MIGRATING] Contract ID ${contract.id}: ${contract.filePath}`);
                try {
                    const fileName = path.basename(localPath);
                    const uploadUrl = await storageService.getDocumentUploadURL('crew', contract.crewMemberId, fileName);

                    const fileBuffer = fs.readFileSync(localPath);
                    const response = await fetch(uploadUrl, {
                        method: 'PUT',
                        body: fileBuffer,
                        headers: {
                            'Content-Type': 'application/pdf'
                        }
                    });

                    if (response.ok) {
                        const cloudPath = storageService.normalizeDocumentPath(uploadUrl);
                        await db.update(contracts).set({ filePath: cloudPath }).where(eq(contracts.id, contract.id));
                        console.log(`  [SUCCESS] -> ${cloudPath}`);
                        contractsCount++;
                    } else {
                        console.error(`  [FAILED] Upload failed for Contract ID ${contract.id}: ${response.statusText}`);
                    }
                } catch (e) {
                    console.error(`  [ERROR] Contract ID ${contract.id}:`, e.message);
                }
            } else {
                console.warn(`  [MISSING] Local file not found: ${localPath}`);
            }
        }
    }

    console.log(`\n✅ Migration Complete!`);
    console.log(`   - Crew Documents: ${crewDocsCount}`);
    console.log(`   - Contracts: ${contractsCount}`);

    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ Migration Critical Error:', err);
    process.exit(1);
});
