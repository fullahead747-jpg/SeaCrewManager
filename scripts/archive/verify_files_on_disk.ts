import * as fs from 'fs';
import * as path from 'path';
import { db } from '../../server/db';
import { documents } from '@shared/schema';

async function verifyFiles() {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const dbDocs = await db.select().from(documents);

    console.log('--- Verifying Database Paths vs File System ---');

    dbDocs.forEach(doc => {
        if (!doc.filePath) {
            console.log(`[NULL] ${doc.type} (ID: ${doc.id}) - No file path`);
            return;
        }

        // Strip 'uploads/' prefix if present for FS check, or use as is if relative to cwd
        const fullPath = path.join(process.cwd(), doc.filePath);
        const exists = fs.existsSync(fullPath);

        console.log(`[${exists ? 'EXISTS' : 'MISSING'}] ${doc.type} (ID: ${doc.id}) -> ${doc.filePath}`);
    });
}

verifyFiles().then(() => process.exit(0));
