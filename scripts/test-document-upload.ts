/**
 * Test script to verify document upload and storage
 * This script will help verify that documents are being stored properly
 */

import { db } from '../server/db';
import { documents } from '@shared/schema';
import { desc } from 'drizzle-orm';

async function testDocumentStorage() {
    console.log('=== Document Storage Verification ===\n');

    // Check environment configuration
    console.log('1. Environment Configuration:');
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   - PRIVATE_OBJECT_DIR: ${process.env.PRIVATE_OBJECT_DIR || 'NOT SET (Local development)'}`);
    console.log('');

    // Check if Object Storage is available (Replit only)
    const isReplitEnvironment = !!process.env.PRIVATE_OBJECT_DIR;
    console.log(`2. Storage Mode: ${isReplitEnvironment ? 'Object Storage (Replit)' : 'Local File System'}`);
    console.log('');

    // Query recent documents
    console.log('3. Recent Documents in Database:');
    try {
        const recentDocs = await db
            .select()
            .from(documents)
            .orderBy(desc(documents.createdAt))
            .limit(10);

        if (recentDocs.length === 0) {
            console.log('   ⚠️  No documents found in database');
        } else {
            console.log(`   ✅ Found ${recentDocs.length} document(s):\n`);

            recentDocs.forEach((doc, index) => {
                console.log(`   Document ${index + 1}:`);
                console.log(`      - ID: ${doc.id}`);
                console.log(`      - Type: ${doc.type}`);
                console.log(`      - File Path: ${doc.filePath}`);
                console.log(`      - Storage Type: ${doc.filePath?.startsWith('/') ? 'Object Storage' : 'Local File System'}`);
                console.log(`      - Created: ${doc.createdAt}`);
                console.log('');
            });
        }
    } catch (error) {
        console.error('   ❌ Error querying documents:', error);
    }

    // Provide guidance
    console.log('4. Next Steps:');
    if (!isReplitEnvironment) {
        console.log('   📝 You are in LOCAL DEVELOPMENT mode:');
        console.log('      - Documents will be stored in the local "uploads" folder');
        console.log('      - Files will NOT persist on Replit deployments');
        console.log('      - To test Object Storage, deploy to Replit with PRIVATE_OBJECT_DIR set');
        console.log('');
        console.log('   🚀 To enable persistent storage on Replit:');
        console.log('      1. Create an Object Storage bucket in Replit');
        console.log('      2. Set PRIVATE_OBJECT_DIR environment variable');
        console.log('      3. Re-upload documents - they will automatically be stored in Object Storage');
    } else {
        console.log('   ✅ Object Storage is ENABLED');
        console.log('      - New uploads will be stored in Object Storage');
        console.log('      - Files will persist across deployments');
        console.log('      - Check the file paths above - they should start with "/"');
    }
    console.log('');

    console.log('=== Verification Complete ===');
    process.exit(0);
}

testDocumentStorage().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
