import { db } from "../db";
import { scannedDocuments, documents, crewMembers } from "@shared/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import type { ExtractedDocumentData } from "./document-verification-service";

export interface ValidationMismatch {
    field: string;
    entered: string | null;
    scanned: string | null;
}

export interface ValidationResult {
    isValid: boolean;
    mismatches: ValidationMismatch[];
    message?: string;
}

export interface DocumentEditData {
    documentNumber?: string;
    issueDate?: Date | string;
    expiryDate?: Date | string;
    issuingAuthority?: string;
}

export class DocumentEditValidator {
    /**
     * Validates document edits against scanned data
     * @param documentId - ID of the document being edited
     * @param editedData - The new data being submitted
     * @param documentType - Type of document (passport, cdc, coc, medical)
     * @returns ValidationResult indicating if edits are valid
     */
    async validateDocumentEdit(
        documentId: string,
        editedData: DocumentEditData,
        documentType?: string,
        extractedRuntimeData?: ExtractedDocumentData // Optional OCR data from current upload
    ): Promise<ValidationResult> {
        // SKIP VALIDATION for COC and Medical documents
        // These documents should use dashboard data only, not OCR validation
        if (documentType === 'coc' || documentType === 'medical') {
            console.log(`[VALIDATOR] Skipping validation for ${documentType} - dashboard data is source of truth`);
            return {
                isValid: true,
                mismatches: [],
                message: `Validation skipped for ${documentType} - user input accepted as-is`
            };
        }

        console.log(`[VALIDATOR] Running validation for ${documentType || 'unknown'} document`);




        // Fetch ALL NON-SUPERSEDED scanned data for this document, latest first
        // Only validate against active scans (supersededAt IS NULL)
        const allScans = await db
            .select()
            .from(scannedDocuments)
            .where(
                and(
                    eq(scannedDocuments.documentId, documentId),
                    isNull(scannedDocuments.supersededAt) // Only get active scans
                )
            )
            .orderBy(desc(scannedDocuments.createdAt));

        // If no scanned data exists at all, allow the edit
        if (allScans.length === 0) {
            return {
                isValid: true,
                mismatches: [],
                message: "No scanned data available for validation. Edit allowed."
            };
        }

        // Helper to find latest non-null value for a field
        const getLatestField = (field: keyof typeof scannedDocuments.$inferSelect) => {
            const scanWithField = allScans.find(s => s[field] !== null && s[field] !== undefined && s[field] !== 'NONE' && s[field] !== '');
            return scanWithField ? scanWithField[field] : null;
        };

        const latestScannedNumber = extractedRuntimeData?.documentNumber || getLatestField('extractedNumber') as string | null;
        const latestScannedIssueDate = extractedRuntimeData?.issueDate
            ? this.parseRuntimeDate(extractedRuntimeData.issueDate)
            : (getLatestField('extractedIssueDate') as Date | null);
        const latestScannedExpiryDate = extractedRuntimeData?.expiryDate
            ? this.parseRuntimeDate(extractedRuntimeData.expiryDate)
            : (getLatestField('extractedExpiry') as Date | null);
        const latestScannedHolderName = extractedRuntimeData?.holderName || getLatestField('extractedHolderName') as string | null;

        console.log('[VALIDATOR] Latest scanned values found:');
        console.log(`  Number: ${latestScannedNumber}`);
        console.log(`  Issue Date: ${latestScannedIssueDate?.toISOString()}`);
        console.log(`  Expiry Date: ${latestScannedExpiryDate?.toISOString()}`);
        console.log(`  Holder Name: ${latestScannedHolderName}`);

        const mismatches: ValidationMismatch[] = [];

        // SKIP Document Number validation - only validate dates
        // if (editedData.documentNumber !== undefined) {
        //     console.log(`[VALIDATOR] Checking document number: ${editedData.documentNumber} vs ${latestScannedNumber}`);
        //     if (!this.compareDocumentNumber(editedData.documentNumber, latestScannedNumber)) {
        //         console.log('[VALIDATOR] ❌ Document number MISMATCH detected!');
        //         mismatches.push({
        //             field: "documentNumber",
        //             entered: editedData.documentNumber,
        //             scanned: latestScannedNumber
        //         });
        //     } else {
        //         console.log('[VALIDATOR] ✅ Document number matches');
        //     }
        // }

        // Validate Issue Date
        if (editedData.issueDate !== undefined) {
            console.log(`[VALIDATOR] Checking issue date: ${editedData.issueDate} vs ${latestScannedIssueDate?.toISOString()}`);
            if (!this.compareDates(editedData.issueDate, latestScannedIssueDate, 0)) {
                console.log('[VALIDATOR] ❌ Issue date MISMATCH detected!');
                mismatches.push({
                    field: "issueDate",
                    entered: this.formatDate(editedData.issueDate),
                    scanned: this.formatDate(latestScannedIssueDate)
                });
            } else {
                console.log('[VALIDATOR] ✅ Issue date matches');
            }
        }

        // Validate Expiry Date
        if (editedData.expiryDate !== undefined) {
            console.log(`[VALIDATOR] Checking expiry date: ${editedData.expiryDate} vs ${latestScannedExpiryDate?.toISOString()}`);
            if (!this.compareDates(editedData.expiryDate, latestScannedExpiryDate, 0)) {
                console.log('[VALIDATOR] ❌ Expiry date MISMATCH detected!');
                mismatches.push({
                    field: "expiryDate",
                    entered: this.formatDate(editedData.expiryDate),
                    scanned: this.formatDate(latestScannedExpiryDate)
                });
            } else {
                console.log('[VALIDATOR] ✅ Expiry date matches');
            }
        }

        // SKIP Issuing Authority validation - only validate dates
        // if (editedData.issuingAuthority !== undefined) {
        //     console.log(`[VALIDATOR] Checking issuing authority: ${editedData.issuingAuthority} vs ${latestScannedHolderName}`);
        //     if (!this.compareIssuingAuthority(editedData.issuingAuthority, latestScannedHolderName)) {
        //         console.log('[VALIDATOR] ❌ Issuing authority MISMATCH detected!');
        //         mismatches.push({
        //             field: "issuingAuthority",
        //             entered: editedData.issuingAuthority,
        //             scanned: latestScannedHolderName
        //         });
        //     } else {
        //         console.log('[VALIDATOR] ✅ Issuing authority matches');
        //     }
        // }

        console.log(`[VALIDATOR] Total mismatches found: ${mismatches.length}`);

        if (mismatches.length > 0) {
            console.log('[VALIDATOR] ❌ VALIDATION FAILED - Returning error');
            return {
                isValid: false,
                mismatches,
                message: "Document edits do not match scanned data"
            };
        }

        console.log('[VALIDATOR] ✅ VALIDATION PASSED');
        return {
            isValid: true,
            mismatches: [],
            message: "All edits match scanned data"
        };
    }

    /**
     * Compare document numbers (case-insensitive, trimmed)
     */
    private compareDocumentNumber(manual: string | null, scanned: string | null): boolean {
        if (!manual || !scanned) return true; // If either is null, skip validation

        const normalizedManual = manual.trim().toUpperCase();
        const normalizedScanned = scanned.trim().toUpperCase();

        return normalizedManual === normalizedScanned;
    }

    /**
     * Compare dates with tolerance (in days)
     */
    private compareDates(
        manual: Date | string | null | undefined,
        scanned: Date | string | null | undefined,
        toleranceDays: number = 1
    ): boolean {
        if (!manual || !scanned) return true; // If either is null, skip validation

        const manualDate = new Date(manual);
        const scannedDate = new Date(scanned);

        // Check if dates are valid
        if (isNaN(manualDate.getTime()) || isNaN(scannedDate.getTime())) {
            return true; // Skip validation if dates are invalid
        }

        // Calculate difference in days
        const diffMs = Math.abs(manualDate.getTime() - scannedDate.getTime());
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        return diffDays <= toleranceDays;
    }

    /**
     * Compare issuing authority (case-insensitive, trimmed)
     */
    private compareIssuingAuthority(manual: string | null, scanned: string | null): boolean {
        if (!manual || !scanned) return true; // If either is null, skip validation

        const normalizedManual = manual.trim().toUpperCase();
        const normalizedScanned = scanned.trim().toUpperCase();

        return normalizedManual === normalizedScanned;
    }

    /**
     * Format date for display
     */
    private formatDate(date: Date | string | null | undefined): string | null {
        if (!date) return null;

        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return null;
            return d.toISOString().split('T')[0];
        } catch {
            return null;
        }
    }

    /**
     * Parse date string or Date object from runtime extraction
     */
    private parseRuntimeDate(date: string | Date | null | undefined): Date | null {
        if (!date) return null;
        try {
            const d = new Date(date);
            return isNaN(d.getTime()) ? null : d;
        } catch {
            return null;
        }
    }
}

export const documentEditValidator = new DocumentEditValidator();
