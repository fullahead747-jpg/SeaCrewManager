// API endpoint to check scanned document data
// Add this to your routes.ts temporarily or call it directly

import type { Express } from "express";
import { db } from "./db";
import { documents, scannedDocuments } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export function registerCheckScannedEndpoint(app: Express) {
    app.get("/api/debug/scanned-passports", async (req, res) => {
        try {
            // Get all passport documents
            const passports = await db
                .select()
                .from(documents)
                .where(eq(documents.type, 'passport'))
                .orderBy(desc(documents.createdAt))
                .limit(5);

            const results = [];

            for (const passport of passports) {
                // Get scanned data
                const scans = await db
                    .select()
                    .from(scannedDocuments)
                    .where(eq(scannedDocuments.documentId, passport.id))
                    .orderBy(desc(scannedDocuments.createdAt));

                const activeScan = scans.find(s => !s.supersededAt) || scans[0];

                results.push({
                    documentId: passport.id,
                    documentNumber: passport.documentNumber,
                    crewMemberId: passport.crewMemberId,
                    mainTable: {
                        issueDate: passport.issueDate,
                        expiryDate: passport.expiryDate,
                        createdAt: passport.createdAt
                    },
                    scannedData: activeScan ? {
                        scanId: activeScan.id,
                        extractedNumber: activeScan.extractedNumber,
                        extractedIssueDate: activeScan.extractedIssueDate,
                        extractedExpiry: activeScan.extractedExpiry,
                        extractedHolderName: activeScan.extractedHolderName,
                        ocrConfidence: activeScan.ocrConfidence,
                        mrzValidation: activeScan.mrzValidation,
                        createdAt: activeScan.createdAt,
                        supersededAt: activeScan.supersededAt
                    } : null,
                    totalScans: scans.length
                });
            }

            res.json({
                success: true,
                count: results.length,
                passports: results
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
}
