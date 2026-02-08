/**
 * Real-time document upload monitor
 * Run this script and then upload a document to see the storage process in action
 */

import { db } from '../server/db';
import { documents } from '@shared/schema';
import { desc } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 Document Upload Monitor Started');
console.log('=====================================\n');

console.log('📋 Current Status:');
console.log(`   Storage Mode: ${process.env.PRIVATE_OBJECT_DIR ? 'Object Storage (Replit)' : 'Local File System'}`);
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('');

// Check uploads folder
const uploadsDir = path.join(process.cwd(), 'uploads');
if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    console.log(`📁 Files in uploads folder: ${files.length}`);
    if (files.length > 0) {
        console.log('   Recent files:');
        files.slice(-5).forEach(file => {
            const stats = fs.statSync(path.join(uploadsDir, file));
            console.log(`   - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
        });
    }
} else {
    console.log('📁 Uploads folder does not exist');
}
console.log('');

// Get latest document
async function checkLatestDocument() {
    const latestDocs = await db
        .select()
        .from(documents)
        .orderBy(desc(documents.createdAt))
        .limit(1);

    if (latestDocs.length > 0) {
        const doc = latestDocs[0];
        console.log('📄 Latest Document in Database:');
        console.log(`   ID: ${doc.id}`);
        console.log(`   Type: ${doc.type}`);
        console.log(`   File Path: ${doc.filePath || '❌ NULL'}`);
        console.log(`   Created: ${doc.createdAt}`);

        if (doc.filePath) {
            // Check if file exists
            const isCloudPath = doc.filePath.startsWith('/');
            if (isCloudPath) {
                console.log(`   Storage: ☁️  Object Storage`);
            } else {
                const fullPath = path.join(process.cwd(), doc.filePath);
                const exists = fs.existsSync(fullPath);
                console.log(`   Storage: 💾 Local File System`);
                console.log(`   File Exists: ${exists ? '✅ Yes' : '❌ No'}`);
                if (exists) {
                    const stats = fs.statSync(fullPath);
                    console.log(`   File Size: ${(stats.size / 1024).toFixed(2)} KB`);
                }
            }
        } else {
            console.log(`   ⚠️  WARNING: Document has no file path!`);
            console.log(`   This means the document was created without a file attachment.`);
        }
    } else {
        console.log('📄 No documents found in database');
    }
    console.log('');
}

// Monitor for changes
let lastDocId: string | null = null;

async function monitor() {
    const latestDocs = await db
        .select()
        .from(documents)
        .orderBy(desc(documents.createdAt))
        .limit(1);

    if (latestDocs.length > 0 && latestDocs[0].id !== lastDocId) {
        lastDocId = latestDocs[0].id;
        console.log('\n🆕 NEW DOCUMENT DETECTED!');
        console.log('========================\n');
        await checkLatestDocument();
    }
}

// Initial check
checkLatestDocument().then(() => {
    console.log('👀 Monitoring for new uploads...');
    console.log('   (Upload a document now to see it appear here)\n');

    // Poll every 2 seconds
    setInterval(monitor, 2000);
});
