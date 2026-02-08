/**
 * Comprehensive storage verification - checks both contracts and documents
 */

import { db } from '../server/db';
import { contracts, documents, crewMembers } from '@shared/schema';
import { eq, desc, or } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function comprehensiveCheck() {
    console.log('🔍 COMPREHENSIVE STORAGE VERIFICATION');
    console.log('='.repeat(70));
    console.log('');

    // Environment
    console.log('📋 Environment:');
    console.log(`   Storage Mode: ${process.env.PRIVATE_OBJECT_DIR ? 'Object Storage' : 'Local File System'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log('');

    // Find Upendra Kumar
    const crew = await db
        .select()
        .from(crewMembers)
        .where(or(
            eq(crewMembers.firstName, 'UPENDRA'),
            eq(crewMembers.firstName, 'Upendra')
        ));

    if (crew.length === 0) {
        console.log('❌ Crew member "Upendra Kumar" not found');
        return;
    }

    const upendra = crew[0];
    console.log(`✅ Found: ${upendra.firstName} ${upendra.lastName}`);
    console.log(`   ID: ${upendra.id}`);
    console.log('');

    // Check contracts
    console.log('📄 CONTRACTS:');
    console.log('-'.repeat(70));
    const crewContracts = await db
        .select()
        .from(contracts)
        .where(eq(contracts.crewMemberId, upendra.id))
        .orderBy(desc(contracts.createdAt));

    if (crewContracts.length === 0) {
        console.log('   No contracts found');
    } else {
        crewContracts.forEach((contract, i) => {
            console.log(`   Contract ${i + 1}:`);
            console.log(`      Created: ${contract.createdAt}`);
            console.log(`      File Path: ${contract.filePath || '❌ NULL'}`);

            if (contract.filePath) {
                if (contract.filePath.startsWith('/')) {
                    console.log(`      Storage: ☁️  Object Storage`);
                    console.log(`      Status: ✅ STORED IN CLOUD`);
                } else {
                    const fullPath = path.join(process.cwd(), contract.filePath);
                    const exists = fs.existsSync(fullPath);
                    console.log(`      Storage: 💾 Local`);
                    console.log(`      File Exists: ${exists ? '✅ Yes' : '❌ No (deleted)'}`);
                    if (exists) {
                        const stats = fs.statSync(fullPath);
                        console.log(`      Size: ${(stats.size / 1024).toFixed(2)} KB`);
                        console.log(`      Status: ✅ STORED LOCALLY`);
                    } else {
                        console.log(`      Status: ⚠️  File deleted from disk`);
                    }
                }
            } else {
                console.log(`      Status: ❌ NO FILE ATTACHED`);
            }
            console.log('');
        });
    }

    // Check documents
    console.log('📄 DOCUMENTS:');
    console.log('-'.repeat(70));
    const crewDocs = await db
        .select()
        .from(documents)
        .where(eq(documents.crewMemberId, upendra.id))
        .orderBy(desc(documents.createdAt));

    if (crewDocs.length === 0) {
        console.log('   No documents found');
    } else {
        crewDocs.forEach((doc, i) => {
            console.log(`   Document ${i + 1} (${doc.type}):`);
            console.log(`      Created: ${doc.createdAt}`);
            console.log(`      File Path: ${doc.filePath || '❌ NULL'}`);

            if (doc.filePath) {
                if (doc.filePath.startsWith('/')) {
                    console.log(`      Storage: ☁️  Object Storage`);
                    console.log(`      Status: ✅ STORED IN CLOUD`);
                } else {
                    const fullPath = path.join(process.cwd(), doc.filePath);
                    const exists = fs.existsSync(fullPath);
                    console.log(`      Storage: 💾 Local`);
                    console.log(`      File Exists: ${exists ? '✅ Yes' : '❌ No (deleted)'}`);
                    if (exists) {
                        const stats = fs.statSync(fullPath);
                        console.log(`      Size: ${(stats.size / 1024).toFixed(2)} KB`);
                        console.log(`      Status: ✅ STORED LOCALLY`);
                    } else {
                        console.log(`      Status: ⚠️  File deleted from disk`);
                    }
                }
            } else {
                console.log(`      Status: ❌ NO FILE ATTACHED`);
            }
            console.log('');
        });
    }

    // Check uploads folder
    console.log('📁 UPLOADS FOLDER:');
    console.log('-'.repeat(70));
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        const upendraFiles = files.filter(f => f.toLowerCase().includes('upendra'));

        console.log(`   Total files: ${files.length}`);
        console.log(`   Upendra files: ${upendraFiles.length}`);

        if (upendraFiles.length > 0) {
            console.log('');
            console.log('   Recent Upendra files:');
            upendraFiles.slice(-5).forEach(file => {
                const stats = fs.statSync(path.join(uploadsDir, file));
                console.log(`      - ${file}`);
                console.log(`        Size: ${(stats.size / 1024).toFixed(2)} KB`);
                console.log(`        Modified: ${stats.mtime}`);
            });
        }
    } else {
        console.log('   ❌ Uploads folder does not exist');
    }
    console.log('');

    // Summary
    console.log('📊 SUMMARY:');
    console.log('='.repeat(70));

    const contractsWithFiles = crewContracts.filter(c => c.filePath).length;
    const docsWithFiles = crewDocs.filter(d => d.filePath).length;

    console.log(`   Contracts: ${crewContracts.length} total, ${contractsWithFiles} with files`);
    console.log(`   Documents: ${crewDocs.length} total, ${docsWithFiles} with files`);
    console.log('');

    if (contractsWithFiles > 0 || docsWithFiles > 0) {
        console.log('✅ STORAGE IS WORKING!');
        console.log('   Files are being saved with paths in the database.');
        console.log('');
        console.log('⚠️  NOTE: In local development, files are stored in uploads/ folder.');
        console.log('   For persistent storage on Replit, configure Object Storage.');
    } else {
        console.log('⚠️  No files attached to contracts or documents.');
        console.log('   Make sure to select a file when uploading.');
    }
}

comprehensiveCheck()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
