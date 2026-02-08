/**
 * Check contract storage for a specific crew member
 */

import { db } from '../server/db';
import { contracts, crewMembers } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function checkContractStorage(crewName: string) {
    console.log(`🔍 Checking contract storage for: ${crewName}`);
    console.log('='.repeat(60));
    console.log('');

    // Find crew member
    const crew = await db
        .select()
        .from(crewMembers)
        .where(eq(crewMembers.firstName, crewName.split(' ')[0]));

    if (crew.length === 0) {
        console.log(`❌ No crew member found with name: ${crewName}`);
        return;
    }

    const crewMember = crew[0];
    console.log(`✅ Found crew member: ${crewMember.firstName} ${crewMember.lastName}`);
    console.log(`   ID: ${crewMember.id}`);
    console.log('');

    // Get contracts for this crew member
    const crewContracts = await db
        .select()
        .from(contracts)
        .where(eq(contracts.crewMemberId, crewMember.id))
        .orderBy(desc(contracts.createdAt));

    console.log(`📋 Contracts found: ${crewContracts.length}`);
    console.log('');

    if (crewContracts.length === 0) {
        console.log('⚠️  No contracts found for this crew member');
        return;
    }

    // Check each contract
    crewContracts.forEach((contract, index) => {
        console.log(`Contract ${index + 1}:`);
        console.log(`   ID: ${contract.id}`);
        console.log(`   Vessel ID: ${contract.vesselId}`);
        console.log(`   Start Date: ${contract.startDate}`);
        console.log(`   End Date: ${contract.endDate}`);
        console.log(`   Status: ${contract.status}`);
        console.log(`   File Path: ${contract.filePath || '❌ NULL'}`);

        if (contract.filePath) {
            const isCloudPath = contract.filePath.startsWith('/');

            if (isCloudPath) {
                console.log(`   Storage Type: ☁️  Object Storage (Replit)`);
                console.log(`   ✅ Contract is stored in persistent cloud storage`);
            } else {
                console.log(`   Storage Type: 💾 Local File System`);

                // Check if file exists locally
                const fullPath = path.join(process.cwd(), contract.filePath);
                const exists = fs.existsSync(fullPath);

                if (exists) {
                    const stats = fs.statSync(fullPath);
                    console.log(`   File Exists: ✅ Yes`);
                    console.log(`   File Size: ${(stats.size / 1024).toFixed(2)} KB`);
                    console.log(`   Full Path: ${fullPath}`);
                } else {
                    console.log(`   File Exists: ❌ No (file may have been deleted)`);
                }
            }
        } else {
            console.log(`   ⚠️  WARNING: Contract has no file attached!`);
        }

        console.log(`   Created: ${contract.createdAt}`);
        console.log('');
    });

    // Summary
    const withFiles = crewContracts.filter(c => c.filePath !== null).length;
    const withoutFiles = crewContracts.length - withFiles;

    console.log('📊 Summary:');
    console.log(`   Total Contracts: ${crewContracts.length}`);
    console.log(`   With Files: ${withFiles}`);
    console.log(`   Without Files: ${withoutFiles}`);

    if (withFiles > 0) {
        console.log('');
        console.log('✅ Storage is working! Contracts are being saved with file paths.');
    } else {
        console.log('');
        console.log('⚠️  No contracts have file paths. Files may not be attached during upload.');
    }
}

// Get crew name from command line or use default
const crewName = process.argv[2] || 'UPENDRA';

checkContractStorage(crewName)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
