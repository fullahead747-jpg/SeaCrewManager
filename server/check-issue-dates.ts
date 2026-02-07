// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
config();

// Script to check issue dates stored in scanned_documents table for passports
import { db } from './db.js';
import { documents, scannedDocuments } from '@shared/schema';
import { eq, desc, isNull } from 'drizzle-orm';


async function checkIssueDates() {
    try {
        console.log('=== Checking Issue Dates in Scanned Documents (Passports) ===\n');

        // Get all passport documents
        const passports = await db
            .select()
            .from(documents)
            .where(eq(documents.type, 'passport'))
            .orderBy(desc(documents.createdAt));

        console.log(`Found ${passports.length} passport document(s) in total:\n`);

        for (const passport of passports) {
            console.log(`\n${'='.repeat(70)}`);
            console.log(`PASSPORT DOCUMENT`);
            console.log(`${'='.repeat(70)}`);
            console.log(`Document ID: ${passport.id}`);
            console.log(`Document Number: ${passport.documentNumber}`);
            console.log(`Crew Member ID: ${passport.crewMemberId}`);
            console.log(`\nMAIN DOCUMENTS TABLE:`);
            console.log(`  Issue Date: ${passport.issueDate ? new Date(passport.issueDate).toISOString() : 'NULL'}`);
            console.log(`  Expiry Date: ${passport.expiryDate ? new Date(passport.expiryDate).toISOString() : 'NULL'}`);
            console.log(`  Created At: ${passport.createdAt ? new Date(passport.createdAt).toISOString() : 'NULL'}`);

            // Get ALL scanned data for this document (including superseded ones)
            const allScans = await db
                .select()
                .from(scannedDocuments)
                .where(eq(scannedDocuments.documentId, passport.id))
                .orderBy(desc(scannedDocuments.createdAt));

            if (allScans.length > 0) {
                console.log(`\nSCANNED DOCUMENTS TABLE (${allScans.length} scan(s) found):`);

                for (let i = 0; i < allScans.length; i++) {
                    const scan = allScans[i];
                    const isActive = !scan.supersededAt;

                    console.log(`\n  --- Scan #${i + 1} ${isActive ? '[ACTIVE]' : '[SUPERSEDED]'} ---`);
                    console.log(`  Scan ID: ${scan.id}`);
                    console.log(`  Created At: ${scan.createdAt ? new Date(scan.createdAt).toISOString() : 'NULL'}`);

                    if (scan.supersededAt) {
                        console.log(`  Superseded At: ${new Date(scan.supersededAt).toISOString()}`);
                        console.log(`  Superseded By: ${scan.supersededBy || 'N/A'}`);
                    }

                    console.log(`\n  EXTRACTED DATA:`);
                    console.log(`    Document Number: ${scan.extractedNumber || 'NULL'}`);
                    console.log(`    Issue Date: ${scan.extractedIssueDate ? new Date(scan.extractedIssueDate).toISOString() : 'NULL'}`);
                    console.log(`    Expiry Date: ${scan.extractedExpiry ? new Date(scan.extractedExpiry).toISOString() : 'NULL'}`);
                    console.log(`    Holder Name: ${scan.extractedHolderName || 'NULL'}`);
                    console.log(`    OCR Confidence: ${scan.ocrConfidence || 'NULL'}`);

                    if (scan.mrzValidation) {
                        const mrzData = typeof scan.mrzValidation === 'string'
                            ? JSON.parse(scan.mrzValidation)
                            : scan.mrzValidation;
                        console.log(`    MRZ Valid: ${mrzData.isValid ? 'YES' : 'NO'}`);
                        if (mrzData.errors && mrzData.errors.length > 0) {
                            console.log(`    MRZ Errors: ${mrzData.errors.join(', ')}`);
                        }
                    }

                    // Show raw OCR data if available
                    if (scan.rawText) {
                        try {
                            const rawData = typeof scan.rawText === 'string'
                                ? JSON.parse(scan.rawText)
                                : scan.rawText;

                            console.log(`\n  RAW OCR EXTRACTION:`);
                            console.log(`    passportIssueDate: ${rawData.issueDate || 'NULL'}`);
                            console.log(`    passportExpiryDate: ${rawData.expiryDate || 'NULL'}`);
                            console.log(`    passportNumber: ${rawData.documentNumber || 'NULL'}`);
                        } catch (e) {
                            console.log(`  Raw text parsing error: ${e}`);
                        }
                    }
                }

                // Highlight the active scan
                const activeScan = allScans.find(s => !s.supersededAt);
                if (activeScan) {
                    console.log(`\n  ✅ ACTIVE SCAN SUMMARY:`);
                    console.log(`     Issue Date Stored: ${activeScan.extractedIssueDate ? '✓ YES - ' + new Date(activeScan.extractedIssueDate).toLocaleDateString() : '✗ NO (NULL)'}`);
                    console.log(`     Expiry Date Stored: ${activeScan.extractedExpiry ? '✓ YES - ' + new Date(activeScan.extractedExpiry).toLocaleDateString() : '✗ NO (NULL)'}`);
                }
            } else {
                console.log(`\n  ⚠️  NO SCANNED DATA FOUND`);
                console.log(`  This document has not been scanned yet or scan failed.`);
            }
        }

        console.log(`\n${'='.repeat(70)}`);
        console.log(`SUMMARY`);
        console.log(`${'='.repeat(70)}`);
        console.log(`Total Passports: ${passports.length}`);

        let scannedCount = 0;
        let withIssueDate = 0;

        for (const passport of passports) {
            const scans = await db
                .select()
                .from(scannedDocuments)
                .where(eq(scannedDocuments.documentId, passport.id));

            if (scans.length > 0) {
                scannedCount++;
                const activeScan = scans.find(s => !s.supersededAt) || scans[0];
                if (activeScan.extractedIssueDate) {
                    withIssueDate++;
                }
            }
        }

        console.log(`Passports with Scanned Data: ${scannedCount}`);
        console.log(`Passports with Issue Date Extracted: ${withIssueDate}`);
        console.log(`Success Rate: ${passports.length > 0 ? Math.round((withIssueDate / passports.length) * 100) : 0}%`);

    } catch (error) {
        console.error('Error querying database:', error);
    } finally {
        process.exit(0);
    }
}

checkIssueDates();
