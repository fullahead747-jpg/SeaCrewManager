import { groqOcrService } from '../groqOcrService';
import { geminiOcrService } from '../geminiOcrService';
import { localOcrService } from '../localOcrService';
import * as fs from 'fs';
import * as path from 'path';
import { MRZValidator } from '../utils/mrz-validator';
import { storage } from '../storage';
import { documentFieldAlignment, FieldAlignmentResult } from './document-field-alignment';
import { documentForgeryDetector, ForgeryAnalysisResult } from './document-forgery-detector';
import { documentTypeClassifier, DocumentClassificationResult } from './document-type-classifier';

export interface ProfileComparison {
    personal: FieldComparison[];
    nok: FieldComparison[];
    hasChanges: boolean;
}

export interface DocumentVerificationResult {
    isValid: boolean;
    matchScore: number; // 0-100
    fieldComparisons: FieldComparison[];
    extractedData: ExtractedDocumentData;
    warnings: string[];
    profileComparison?: ProfileComparison;
    // UI Metadata for Manual Correction
    allowManualCorrection: boolean;
    ocrConfidence: number; // Overall OCR confidence score
    // Phase 3: Advanced Features
    forgeryAnalysis?: ForgeryAnalysisResult;
    fieldAlignment?: FieldAlignmentResult;
    typeClassification?: DocumentClassificationResult;
}

export interface FieldComparison {
    field: string;
    existingValue: string | null;
    extractedValue: string | null;
    matches: boolean;
    similarity: number; // 0-100
    displayName: string;
    // Metadata for UI
    isEditable: boolean;
    confidenceLevel: 'high' | 'medium' | 'low';
}

export interface ExtractedDocumentData {
    documentNumber?: string;
    issuingAuthority?: string;
    issueDate?: string;
    expiryDate?: string;
    holderName?: string;
    detectedDocumentType?: string;
    mrzLine1?: string;
    mrzLine2?: string;
    mrzValidation?: {
        isValid: boolean;
        errors: string[];
    };
    // Profile fields
    firstName?: string;
    lastName?: string;
    nationality?: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    email?: string;
    nokName?: string;
    nokRelationship?: string;
    nokPhone?: string;
    nokEmail?: string;
    nokAddress?: string;
}

export interface ExpiryValidationResult {
    status: 'expired' | 'expiring' | 'valid';
    isExpired: boolean;
    isExpiring: boolean;
    daysUntilExpiry: number; // Negative if expired
    expiryDate: Date;
    message: string;
}

export interface ExistingDocumentData {
    documentNumber: string;
    issuingAuthority: string;
    issueDate: string | null;
    expiryDate: string | null;
    type: string;
    holderName?: string; // Added for name validation
}

export interface OwnerValidationResult {
    isValid: boolean;
    similarity: number; // 0-100
    status: 'match' | 'warning' | 'mismatch';
    confidence: 'high' | 'medium' | 'low';
    message: string;
    crewMemberName: string;
    extractedName: string | null;
}

export class DocumentVerificationService {
    /**
     * Validate document expiry date and determine status
     * Returns: expired (< today), expiring (0-90 days), valid (> 90 days)
     */
    validateExpiry(expiryDateStr: string | null | undefined): ExpiryValidationResult {
        // Handle missing expiry date
        if (!expiryDateStr) {
            return {
                status: 'valid',
                isExpired: false,
                isExpiring: false,
                daysUntilExpiry: 999,
                expiryDate: new Date(),
                message: 'No expiry date provided'
            };
        }

        try {
            const expiryDate = new Date(expiryDateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison
            expiryDate.setHours(0, 0, 0, 0);

            // Calculate days until expiry
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            // Determine status
            if (daysUntilExpiry < 0) {
                // Document is expired
                return {
                    status: 'expired',
                    isExpired: true,
                    isExpiring: false,
                    daysUntilExpiry,
                    expiryDate,
                    message: `Document expired ${Math.abs(daysUntilExpiry)} days ago`
                };
            } else if (daysUntilExpiry <= 90) {
                // Document expires within 90 days
                return {
                    status: 'expiring',
                    isExpired: false,
                    isExpiring: true,
                    daysUntilExpiry,
                    expiryDate,
                    message: `Document expires in ${daysUntilExpiry} days`
                };
            } else {
                // Document is valid
                return {
                    status: 'valid',
                    isExpired: false,
                    isExpiring: false,
                    daysUntilExpiry,
                    expiryDate,
                    message: `Document valid for ${daysUntilExpiry} days`
                };
            }
        } catch (error) {
            console.error('Error validating expiry date:', error);
            return {
                status: 'valid',
                isExpired: false,
                isExpiring: false,
                daysUntilExpiry: 0,
                expiryDate: new Date(),
                message: 'Invalid date format'
            };
        }
    }

    /**
     * Validate that extracted holder name matches crew member's name
     * Uses fuzzy matching to handle OCR errors and name variations
     */
    async validateDocumentOwner(
        extractedHolderName: string | null,
        crewMemberId: string,
        extractedDateOfBirth?: string | null
    ): Promise<OwnerValidationResult> {
        try {
            console.log(`[OWNER-VALIDATION] Starting validation for crew member: ${crewMemberId}`);
            console.log(`[OWNER-VALIDATION] Extracted holder name: "${extractedHolderName || 'NULL'}"`);

            // Fetch crew member from database
            const crewMember = await storage.getCrewMember(crewMemberId);

            if (!crewMember) {
                console.error(`[OWNER-VALIDATION] Crew member not found: ${crewMemberId}`);
                return {
                    isValid: false,
                    similarity: 0,
                    status: 'mismatch',
                    confidence: 'low',
                    message: 'Crew member not found in database',
                    crewMemberName: 'Unknown',
                    extractedName: extractedHolderName
                };
            }

            // Construct full name from crew member data
            const crewMemberFullName = `${crewMember.firstName} ${crewMember.lastName}`.trim();
            console.log(`[OWNER-VALIDATION] Expected crew member name: "${crewMemberFullName}"`);

            // Handle case where OCR failed to extract holder name
            if (!extractedHolderName || extractedHolderName === 'NONE' || extractedHolderName.trim() === '') {
                console.warn(`[OWNER-VALIDATION] No holder name extracted from document`);
                return {
                    isValid: false,
                    similarity: 0,
                    status: 'warning',
                    confidence: 'low',
                    message: 'Could not extract holder name from document. Manual verification required.',
                    crewMemberName: crewMemberFullName,
                    extractedName: null
                };
            }

            // Import name matcher utility
            const { validateNameMatch, calculateBestNameMatch } = await import('../utils/name-matcher');

            // Calculate name similarity
            const matchResult = validateNameMatch(crewMemberFullName, extractedHolderName);
            const { similarity } = calculateBestNameMatch(crewMemberFullName, extractedHolderName);

            console.log(`[OWNER-VALIDATION] Name similarity: ${similarity}% (Status: ${matchResult.status})`);

            // Optional: Cross-validate with date of birth if available
            let dobMatch = null;
            if (extractedDateOfBirth && crewMember.dateOfBirth) {
                try {
                    const extractedDob = new Date(extractedDateOfBirth);
                    const crewDob = new Date(crewMember.dateOfBirth);

                    // Compare dates (ignore time)
                    dobMatch = extractedDob.toISOString().split('T')[0] === crewDob.toISOString().split('T')[0];
                    console.log(`[OWNER-VALIDATION] DOB match: ${dobMatch ? 'YES' : 'NO'}`);

                    // If DOB matches, boost confidence even if name similarity is borderline
                    if (dobMatch && similarity >= 70 && similarity < 85) {
                        console.log(`[OWNER-VALIDATION] DOB match confirmed - boosting confidence`);
                        matchResult.status = 'match';
                        matchResult.isValid = true;
                        matchResult.confidence = 'high';
                    }
                } catch (error) {
                    console.warn(`[OWNER-VALIDATION] Failed to compare DOB:`, error);
                }
            }

            // Generate user-friendly message
            let message: string;
            if (matchResult.status === 'match') {
                message = `Document holder name matches crew member "${crewMemberFullName}" (${similarity}% match)`;
            } else if (matchResult.status === 'warning') {
                message = `Document holder name "${extractedHolderName}" may not match crew member "${crewMemberFullName}" (${similarity}% similarity). Please verify this document belongs to the correct person.`;
            } else {
                message = `Document holder name "${extractedHolderName}" does not match crew member "${crewMemberFullName}" (${similarity}% similarity). This document appears to belong to a different person.`;
            }

            console.log(`[OWNER-VALIDATION] Result: ${matchResult.status.toUpperCase()} - ${message}`);

            return {
                isValid: matchResult.isValid,
                similarity,
                status: matchResult.status,
                confidence: matchResult.confidence,
                message,
                crewMemberName: crewMemberFullName,
                extractedName: extractedHolderName
            };
        } catch (error) {
            console.error('[OWNER-VALIDATION] Validation error:', error);
            return {
                isValid: false,
                similarity: 0,
                status: 'warning',
                confidence: 'low',
                message: 'Failed to validate document owner. Manual verification required.',
                crewMemberName: 'Unknown',
                extractedName: extractedHolderName
            };
        }
    }

    /**
     * Verify an uploaded document against existing database record
     */
    async verifyDocument(
        filePath: string,
        existingData: ExistingDocumentData,
        cachedData?: ExtractedDocumentData
    ): Promise<DocumentVerificationResult> {
        try {
            console.log(`[VERIFICATION-START] Processing ${existingData.type} for holder: ${existingData.holderName || 'Unknown'}`);
            console.log(` - Expected DocNum: ${existingData.documentNumber}`);
            console.log(` - Expected Expiry: ${existingData.expiryDate || 'NONE'}`);

            // Phase 3: Run forgery detection early in pipeline
            let forgeryAnalysis: ForgeryAnalysisResult | undefined;
            try {
                forgeryAnalysis = await documentForgeryDetector.detectForgery(filePath);
                console.log(`[PHASE3-FORGERY] Risk: ${forgeryAnalysis.riskLevel} (${forgeryAnalysis.riskScore}/100)`);
            } catch (error) {
                console.warn('[PHASE3-FORGERY] Detection failed:', error);
            }

            // Phase 3: Extract data with field alignment analysis
            const { extractedData, fieldAlignment } = await this.extractDocumentDataWithAlignment(filePath, existingData.type, existingData);

            // FALLBACK TO CACHE: If we have cached data from a previous successful scan, 
            // we PRIORITIZE it over the real-time extraction. This is because real-time OCR 
            // can be inconsistent or misread fields on the same document (lighting, etc).
            if (cachedData) {
                if (cachedData.documentNumber) {
                    console.log(`[VERIFICATION-CACHE] Using cached documentNumber: ${cachedData.documentNumber}`);
                    extractedData.documentNumber = cachedData.documentNumber;
                }
                if (cachedData.expiryDate) {
                    console.log(`[VERIFICATION-CACHE] Using cached expiryDate: ${cachedData.expiryDate}`);
                    extractedData.expiryDate = cachedData.expiryDate;
                }
                if (cachedData.issueDate) {
                    console.log(`[VERIFICATION-CACHE] Using cached issueDate: ${cachedData.issueDate}`);
                    extractedData.issueDate = cachedData.issueDate;
                }
                if (cachedData.holderName) {
                    console.log(`[VERIFICATION-CACHE] Using cached holderName: ${cachedData.holderName}`);
                    extractedData.holderName = cachedData.holderName;
                }
            }

            console.log(`[VERIFICATION-DATA] Extracted from document:`);
            console.log(` - DocNum: ${extractedData.documentNumber || 'NOT FOUND'}`);
            console.log(` - Expiry: ${extractedData.expiryDate || 'NOT FOUND'}`);
            console.log(` - Name:   ${extractedData.holderName || 'NOT FOUND'}`);

            // Compare fields
            const fieldComparisons = this.compareFields(existingData, extractedData);

            // Calculate overall match score
            const matchScore = this.calculateMatchScore(fieldComparisons);

            // Determine if valid (>= 75% match and NO critical mismatches)
            let isValid = matchScore >= 75;

            // LOOSE VALIDATION FOR CACHED DOCUMENTS:
            // If we have cached data and the critical fields match, we should be much more lenient.
            // This is because we've ALREADY validated this file before, so if the user's manual 
            // entry matches our "known good" scan, we should trust it.
            if (cachedData && !isValid && matchScore >= 40) {
                const criticalFields = ['documentNumber', 'expiryDate'];
                const criticalMatched = fieldComparisons
                    .filter(c => criticalFields.includes(c.field))
                    .every(c => c.matches);

                if (criticalMatched) {
                    console.log(`[VERIFICATION-CACHE] Critical fields matched via DB cache. Accepting document with lower match score (${matchScore}/100)`);
                    isValid = true;
                }
            }

            // STRICT PASSPORT/CDC/COC RULES: Critical fields MUST match
            const criticalFields = ['documentNumber', 'expiryDate', 'issueDate', 'holderName'];
            const criticalMismatches = fieldComparisons.filter(c =>
                criticalFields.includes(c.field) && !c.matches && c.existingValue && c.extractedValue
            );

            if (criticalMismatches.length > 0) {
                console.warn(`[STRICT-VALIDATION] Rejected due to critical field mismatches: ${criticalMismatches.map(m => m.field).join(', ')}`);
                isValid = false;
            }

            // REJECTION IF CRITICAL FIELDS NOT EXTRACTED (Loophole fix)
            const typeLower = existingData.type.toLowerCase();
            const isCriticalDoc = ['passport', 'cdc', 'coc', 'medical'].some(t => typeLower.includes(t));
            if (isCriticalDoc) {
                const missingCritical = fieldComparisons.filter(c =>
                    criticalFields.includes(c.field) && (!c.extractedValue || c.extractedValue === 'NONE')
                );
                if (missingCritical.length > 0) {
                    console.warn(`[STRICT-VALIDATION] Rejected because critical fields could not be read: ${missingCritical.map(m => m.field).join(', ')}`);
                    isValid = false;
                }
            }

            if (extractedData.mrzValidation && !extractedData.mrzValidation.isValid) {
                console.warn(`[STRICT-VALIDATION] Rejected due to invalid MRZ: ${extractedData.mrzValidation.errors.join(', ')}`);
                isValid = false;
            }

            // Phase 3: High forgery risk should flag for manual review
            if (forgeryAnalysis && forgeryAnalysis.riskLevel === 'high') {
                console.warn('[PHASE3-FORGERY] High risk detected - flagging for manual review');
                isValid = false;
            }

            // BYPASS FOR PHOTOS & NON-CRITICAL DOCS: These don't have document numbers or dates to match predictably
            const bypassTypes = ['photo', 'nok', 'next of kin', 'contract', 'agreement', 'letter', 'other'];
            if (bypassTypes.some(t => existingData.type.toLowerCase().includes(t))) {
                console.log(`[VERIFICATION-BYPASS] Bypassing strict OCR matching for document type: ${existingData.type}`);
                isValid = true;
            }

            console.log(`[VERIFICATION-RESULT] Score: ${matchScore}, isValid: ${isValid}`);
            if (!isValid) {
                console.warn(`[VERIFICATION-FAILURE] Reasons:`);
                if (matchScore < 75) console.warn(` - Low match score (${matchScore} < 75)`);
                if (criticalMismatches.length > 0) console.warn(` - Critical Mismatches: ${criticalMismatches.map(m => m.field).join(', ')}`);
                if (extractedData.mrzValidation && !extractedData.mrzValidation.isValid) console.warn(` - MRZ Invalid: ${extractedData.mrzValidation.errors.join(', ')}`);
                if (forgeryAnalysis && forgeryAnalysis.riskLevel === 'high') console.warn(` - High Forgery Risk`);
            }

            // Generate warnings for mismatches
            const warnings = this.generateWarnings(fieldComparisons, extractedData);

            // Add forgery warnings
            if (forgeryAnalysis && forgeryAnalysis.warnings.length > 0) {
                warnings.push(...forgeryAnalysis.warnings);
            }

            // Calculate overall OCR confidence
            const confValues = { high: 100, medium: 70, low: 30 };
            const avgConfidence = fieldComparisons.length > 0
                ? fieldComparisons.reduce((acc, c) => acc + confValues[c.confidenceLevel], 0) / fieldComparisons.length
                : 0;

            return {
                isValid,
                matchScore,
                fieldComparisons,
                extractedData,
                warnings,
                allowManualCorrection: matchScore >= 40,
                ocrConfidence: Math.round(avgConfidence),
                forgeryAnalysis,
                fieldAlignment
            };
        } catch (error) {
            console.error('Document verification error:', error);
            throw new Error(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'} `);
        }
    }

    /**
     * Extract data from uploaded document using multiple OCR engines in parallel
     */
    public async extractDocumentData(
        filePath: string,
        documentType: string,
        nationalityHint?: string,
        expectedData?: ExistingDocumentData
    ): Promise<ExtractedDocumentData> {
        try {
            console.log(`[MULTI-ENGINE-OCR] Starting extraction for ${documentType} from ${filePath}`);
            const fileBuffer = fs.readFileSync(filePath);
            const base64Data = fileBuffer.toString('base64');

            // 1. Initiate parallel extraction with timeouts
            const ocrTasks: Promise<ExtractedDocumentData>[] = [];
            const AI_TIMEOUT_MS = 90000; // 90 seconds for AI (Gemini/Groq)
            const TRADITIONAL_TIMEOUT_MS = 30000; // 30 seconds for Traditional

            const withTimeout = async (promise: Promise<ExtractedDocumentData>, engineName: string, ms: number) => {
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`${engineName} timed out after ${ms}ms`)), ms)
                );
                return Promise.race([promise, timeoutPromise]);
            };

            // Task A: Groq Vision (AI Engine)
            if (groqOcrService.isAvailable()) {
                ocrTasks.push((async () => {
                    try {
                        console.log('[OCR-GROQ] Starting Groq Vision extraction...');
                        const task = (async () => {
                            const groqData = await groqOcrService.extractCrewDataFromDocument(base64Data, path.basename(filePath), documentType);
                            return await this.mapOcrDataToDocument(groqData, documentType, nationalityHint, expectedData);
                        })();
                        return await withTimeout(task, 'Groq Vision', AI_TIMEOUT_MS);
                    } catch (error) {
                        console.error('[OCR-GROQ] Failed:', error);
                        throw error;
                    }
                })());
            }


            // Task B: Gemini Vision (AI Engine 2)
            if (geminiOcrService.isAvailable()) {
                ocrTasks.push((async () => {
                    try {
                        console.log('[OCR-GEMINI] Starting Gemini Vision extraction...');
                        const task = (async () => {
                            const geminiData = await geminiOcrService.extractCrewDataFromDocument(base64Data, path.basename(filePath), documentType);
                            return await this.mapOcrDataToDocument(geminiData, documentType, nationalityHint, expectedData);
                        })();
                        return await withTimeout(task, 'Gemini Vision', AI_TIMEOUT_MS);
                    } catch (error) {
                        console.error('[OCR-GEMINI] Failed:', error);
                        throw error;
                    }
                })());
            }

            // Task C: Traditional OCR (OCR.space or Tesseract)
            ocrTasks.push((async () => {
                try {
                    const task = (async () => {
                        const { ocrSpaceService } = await import('../ocrSpaceService');
                        let rawData;
                        if (ocrSpaceService.isAvailable()) {
                            try {
                                console.log('[OCR-TRADITIONAL] Using OCR.space cloud...');
                                rawData = await ocrSpaceService.extractCrewDataFromDocument(base64Data, path.basename(filePath), documentType);
                            } catch (error) {
                                console.error('[OCR-TRADITIONAL] OCR.space failed, falling back to local:', error);
                                rawData = await localOcrService.extractCrewDataFromDocument(base64Data, filePath, documentType);
                            }
                        } else {
                            console.log('[OCR-TRADITIONAL] Using local Tesseract...');
                            rawData = await localOcrService.extractCrewDataFromDocument(base64Data, filePath, documentType);
                        }
                        return await this.mapOcrDataToDocument(rawData, documentType, nationalityHint, expectedData);
                    })();
                    return await withTimeout(task, 'Traditional OCR', TRADITIONAL_TIMEOUT_MS);
                } catch (error) {
                    console.error('[OCR-TRADITIONAL] Failed:', error);
                    throw error;
                }
            })());


            // 2. Wait for all results
            const results = await Promise.allSettled(ocrTasks);
            const validResults = results
                .filter(r => r.status === 'fulfilled')
                .map(r => (r as PromiseFulfilledResult<ExtractedDocumentData>).value);

            if (validResults.length === 0) {
                throw new Error('All OCR engines failed to extract data');
            }


            // 3. Simple case: only one engine worked
            if (validResults.length === 1) {
                console.log('[MULTI-ENGINE-OCR] Single engine success, returning result');
                console.log(`[MULTI-ENGINE-OCR] Document Number in result: "${validResults[0].documentNumber}"`);
                return validResults[0];
            }

            // 4. Multi-engine case: Merge results (Task 2.1 Voting Logic)
            console.log(`[MULTI-ENGINE-OCR] Merging ${validResults.length} engine results...`);
            const mergedResult = this.mergeOcrResults(validResults[0], validResults[1]);

            // Phase 3: Store multi-engine extraction for field alignment analysis
            (mergedResult as any)._multiEngineData = {
                groqResult: validResults[0],
                traditionalResult: validResults[1],
                mergedResult
            };

            return mergedResult;

        } catch (error) {
            console.error('OCR extraction error:', error);
            throw new Error('Failed to extract data from document using multi-engine pipeline');
        }
    }

    /**
     * Phase 3: Extract document data with field alignment analysis
     */
    public async extractDocumentDataWithAlignment(
        filePath: string,
        documentType: string,
        expectedData?: ExistingDocumentData
    ): Promise<{ extractedData: ExtractedDocumentData; fieldAlignment?: FieldAlignmentResult }> {
        const extractedData = await this.extractDocumentData(filePath, documentType, undefined, expectedData);

        // Check if we have multi-engine data for alignment analysis
        const multiEngineData = (extractedData as any)._multiEngineData;

        let fieldAlignment: FieldAlignmentResult | undefined;
        if (multiEngineData) {
            try {
                fieldAlignment = documentFieldAlignment.analyzeFieldAlignment(
                    multiEngineData,
                    documentType
                );
                console.log(`[PHASE3-ALIGNMENT] Overall confidence: ${fieldAlignment.overallConfidence}%, Alignment score: ${fieldAlignment.alignmentScore}%`);
            } catch (error) {
                console.warn('[PHASE3-ALIGNMENT] Analysis failed:', error);
            }

            // Clean up temporary data
            delete (extractedData as any)._multiEngineData;
        }

        return { extractedData, fieldAlignment };
    }

    /**
     * Merge results from multiple OCR engines (Voting Logic)
     */
    private mergeOcrResults(resultA: ExtractedDocumentData, resultB: ExtractedDocumentData): ExtractedDocumentData {
        const merged: ExtractedDocumentData = { ...resultA };

        // Prefer MRZ validated data from either engine
        const getPreferred = (valA: string | undefined, valB: string | undefined, field: string) => {
            if (!valA && valB) return valB;
            if (valA && !valB) return valA;
            if (!valA && !valB) return undefined;

            // If Document Number or Expiry, check MRZ
            if (field === 'documentNumber' || field === 'expiryDate') {
                const mrzA = resultA.mrzValidation?.isValid;
                const mrzB = resultB.mrzValidation?.isValid;
                if (mrzB && !mrzA) return valB;
                if (mrzA && !mrzB) return valA;
            }

            // Confidence based choice
            const confA = this.assessConfidence(valA);
            const confB = this.assessConfidence(valB);

            if (confB === 'high' && confA !== 'high') return valB;
            if (confA === 'high' && confB !== 'high') return valA;

            // Tie-break: prefer resultA (usually Groq if it was first in array)
            return valA;
        };

        merged.documentNumber = getPreferred(resultA.documentNumber, resultB.documentNumber, 'documentNumber');
        merged.expiryDate = getPreferred(resultA.expiryDate, resultB.expiryDate, 'expiryDate');
        merged.issueDate = getPreferred(resultA.issueDate, resultB.issueDate, 'issueDate');
        merged.holderName = getPreferred(resultA.holderName, resultB.holderName, 'holderName');
        merged.issuingAuthority = getPreferred(resultA.issuingAuthority, resultB.issuingAuthority, 'issuingAuthority');

        // Prefer the most complete MRZ
        if (!merged.mrzLine1 && resultB.mrzLine1) merged.mrzLine1 = resultB.mrzLine1;
        if (!merged.mrzLine2 && resultB.mrzLine2) merged.mrzLine2 = resultB.mrzLine2;
        if (!merged.mrzValidation && resultB.mrzValidation) merged.mrzValidation = resultB.mrzValidation;

        console.log('[MULTI-ENGINE-OCR] Merge complete');
        return merged;
    }

    /**
     * Harvest all plausible dates from raw OCR text as a fallback
     */
    private harvestDates(text: string): Date[] {
        const dates: Date[] = [];
        // Regex 1: Numeric dates (DD/MM/YYYY, etc)
        const dateRegex1 = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b|\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g;
        // Regex 2: Month name dates (DD-MMM-YYYY, DD JAN 2031, etc)
        const dateRegex2 = /\b(\d{1,2})[\/\-\.\s](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)[\/\-\.\s](\d{4})\b/gi;

        let match;
        while ((match = dateRegex1.exec(text)) !== null) {
            const parsed = this.parseRobustDate(match[0]);
            if (parsed) dates.push(parsed);
        }

        while ((match = dateRegex2.exec(text)) !== null) {
            const parsed = this.parseRobustDate(match[0]);
            if (parsed) dates.push(parsed);
        }

        return dates;
    }

    /**
     * Map OCR extracted data to document fields based on document type
     */
    private async mapOcrDataToDocument(
        ocrData: any,
        documentType: string,
        nationalityHint?: string,
        expectedData?: ExistingDocumentData
    ): Promise<ExtractedDocumentData> {
        const type = documentType.toLowerCase();
        let data: ExtractedDocumentData = {};

        // 1. Initial Mapping based on document type
        if (type === 'passport') {
            data = {
                documentNumber: ocrData.passportNumber,
                issuingAuthority: ocrData.passportPlaceOfIssue,
                issueDate: ocrData.passportIssueDate,
                expiryDate: ocrData.passportExpiryDate,
                holderName: this.cleanExtractedName(ocrData.detectedHolderName || ocrData.seafarerName || ocrData.name)
            };
        } else if (type === 'cdc') {
            data = {
                documentNumber: ocrData.cdcNumber,
                issuingAuthority: ocrData.cdcPlaceOfIssue,
                issueDate: ocrData.cdcIssueDate,
                expiryDate: ocrData.cdcExpiryDate,
                holderName: this.cleanExtractedName(ocrData.detectedHolderName || ocrData.seafarerName || ocrData.name)
            };
        } else if (type.includes('coc')) {
            data = {
                documentNumber: ocrData.cocGradeNo || ocrData.cocNumber || ocrData.cocGrade,
                issuingAuthority: ocrData.cocPlaceOfIssue,
                issueDate: ocrData.cocIssueDate,
                expiryDate: ocrData.cocExpiryDate,
                holderName: this.cleanExtractedName(ocrData.detectedHolderName || ocrData.seafarerName || ocrData.name)
            };
        } else if (type === 'medical') {
            data = {
                documentNumber: ocrData.medicalApprovalNo,
                issuingAuthority: ocrData.medicalIssuingAuthority,
                issueDate: ocrData.medicalIssueDate,
                expiryDate: ocrData.medicalExpiryDate,
                holderName: this.cleanExtractedName(ocrData.detectedHolderName || ocrData.seafarerName || ocrData.name),
                detectedDocumentType: ocrData.detectedDocumentType
            };
        } else {
            // Generic mapping
            data = {
                documentNumber: ocrData.documentNumber || ocrData.passportNo || ocrData.cdcNo || ocrData.cocGrade || ocrData.medicalApprovalNo,
                issuingAuthority: ocrData.issuingAuthority || ocrData.passportPlace || ocrData.cdcPlace || ocrData.cocPlace || ocrData.medicalAuthority,
                issueDate: ocrData.issueDate || ocrData.passportIssueDate || ocrData.cdcIssueDate || ocrData.cocIssueDate || ocrData.medicalIssueDate,
                expiryDate: ocrData.expiryDate || ocrData.passportExpiryDate || ocrData.cdcExpiryDate || ocrData.cocExpiryDate || ocrData.medicalExpiryDate,
                holderName: this.cleanExtractedName(ocrData.detectedHolderName || ocrData.seafarerName || ocrData.name),
                detectedDocumentType: ocrData.detectedDocumentType
            };
        }

        // 2. Map Profile data for synchronization
        data.firstName = ocrData.firstName || undefined;
        data.lastName = ocrData.lastName || undefined;

        if (!data.firstName && (ocrData.seafarerName || ocrData.name)) {
            const fullName = ocrData.seafarerName || ocrData.name;
            const parts = fullName.trim().split(' ');
            data.firstName = parts[0];
            data.lastName = parts.slice(1).join(' ');
        }

        data.nationality = ocrData.seafarerNationality || ocrData.nationality || nationalityHint;
        console.log(`[MAP-OCR-DATA] Nationality assigned: "${data.nationality}" (Hint was: "${nationalityHint}")`);
        data.dateOfBirth = ocrData.seafarerDatePlaceOfBirth || ocrData.dateOfBirth || ocrData.dob;
        data.phoneNumber = ocrData.seafarerMobile || ocrData.phoneNumber;
        data.email = ocrData.seafarerEmail || ocrData.email;

        // NOK data
        data.nokName = ocrData.nokName;
        data.nokRelationship = ocrData.nokRelationship;
        data.nokPhone = ocrData.nokTelephone || ocrData.nokPhone;
        data.nokEmail = ocrData.nokEmail;
        data.nokAddress = ocrData.nokPostalAddress || ocrData.nokAddress;

        // 3. Add MRZ lines if extracted
        data.mrzLine1 = ocrData.mrzLine1;
        data.mrzLine2 = ocrData.mrzLine2;

        // 4. Apply MRZ validation if lines are present
        if (data.mrzLine1 && data.mrzLine2 && data.mrzLine1 !== 'NONE' && data.mrzLine2 !== 'NONE') {
            // Clean MRZ lines: Remove common OCR noise at start/end
            const cleanMRZ = (line: string) => {
                // Remove non-MRZ characters at start (like "- ", "P ", etc)
                let cleaned = line.replace(/^[^P<0-9A-Z]+/, '').trim().toUpperCase();
                // Ensure it's at least 44 characters (TD3 format)
                if (cleaned.length < 44) {
                    cleaned = cleaned.padEnd(44, '<');
                } else if (cleaned.length > 44) {
                    cleaned = cleaned.substring(0, 44);
                }
                return cleaned;
            };

            const l1 = cleanMRZ(data.mrzLine1);
            const l2 = cleanMRZ(data.mrzLine2);

            console.log(`[MRZ-CLEANUP] Line 1: "${l1}" (Length: ${l1.length})`);
            console.log(`[MRZ-CLEANUP] Line 2: "${l2}" (Length: ${l2.length})`);

            const mrzResult = MRZValidator.validateTD3(l1, l2);
            data.mrzValidation = {
                isValid: mrzResult.isValid,
                errors: mrzResult.errors
            };

            if (mrzResult.data) {
                const fv = mrzResult.fieldValidation;
                console.log(`[MRZ-VALIDATION] Reviewing individual MRZ fields for ${type}. Overall isValid: ${mrzResult.isValid}`);

                // PRIORITY: Use MRZ passport number as PRIMARY source (more reliable than visual OCR)
                if (fv.documentNumber && mrzResult.data.documentNumber) {
                    const cleanNum = mrzResult.data.documentNumber.replace(/</g, '');
                    const visualNum = data.documentNumber;

                    if (cleanNum) {
                        // MRZ checksum passed - this is the most reliable source
                        if (cleanNum !== visualNum) {
                            console.log(`[MRZ-PRIORITY] ⚠️  Visual OCR vs MRZ mismatch detected!`);
                            console.log(`   Visual OCR extracted: "${visualNum}"`);
                            console.log(`   MRZ extracted: "${cleanNum}" (Checksum: ✓ PASSED)`);

                            // Calculate similarity and analyze differences
                            const similarity = this.calculateSimilarity(visualNum || '', cleanNum);
                            const diff = this.findCharacterDifferences(visualNum || '', cleanNum);

                            console.log(`   Similarity: ${similarity}%`);
                            if (diff.length > 0) {
                                console.log(`   📝 Character differences: ${diff.join(', ')}`);
                            }

                            // Check if differences are known OCR confusions
                            const isKnownConfusion = this.isKnownOCRConfusion(diff);

                            if (isKnownConfusion && similarity >= 85) {
                                // High similarity + known confusion pattern = trust MRZ
                                console.log(`   🎯 Using MRZ number (known OCR confusion pattern detected)`);
                                data.documentNumber = cleanNum;
                            } else if (similarity >= 95) {
                                // Very high similarity = trust MRZ
                                console.log(`   🎯 Using MRZ number (very high similarity)`);
                                data.documentNumber = cleanNum;
                            } else if (similarity < 70) {
                                // Low similarity = significant mismatch, flag for review
                                console.warn(`   ⚠️ SIGNIFICANT MISMATCH - flagging for manual review`);
                                console.warn(`   Using Visual OCR as safer default: "${visualNum}"`);
                                // Keep visual OCR value but this should trigger a warning in the UI
                                data.documentNumber = visualNum || cleanNum;
                            } else {
                                // Medium similarity = prefer MRZ but note the discrepancy
                                console.log(`   🎯 Using MRZ number (checksum validated)`);
                                data.documentNumber = cleanNum;
                            }
                        } else {
                            console.log(`[MRZ-PRIORITY] ✓ Visual OCR matches MRZ: "${cleanNum}" (Checksum: ✓ PASSED)`);
                            data.documentNumber = cleanNum;
                        }
                    }
                } else if (!fv.documentNumber && data.documentNumber) {
                    // MRZ checksum failed, but we have visual OCR
                    console.log(`[MRZ-PRIORITY] ⚠️  MRZ checksum FAILED - using Visual OCR: "${data.documentNumber}"`);
                    console.log(`   Confidence: MEDIUM (no MRZ validation)`);
                }

                if (fv.expiryDate && mrzResult.data.expiryDate) {
                    const mrzExpiry = MRZValidator.mrzDateToDate(mrzResult.data.expiryDate, true);
                    if (mrzExpiry) {
                        const isoDate = mrzExpiry.toISOString();
                        if (isoDate !== data.expiryDate) {
                            console.log(` - Expiry: Visual="${data.expiryDate}" -> MRZ="${isoDate}" (Checksum Passed)`);
                            data.expiryDate = isoDate;
                        }
                    }
                }

                if (fv.dateOfBirth && mrzResult.data.dateOfBirth) {
                    const dob = MRZValidator.mrzDateToDate(mrzResult.data.dateOfBirth, false);
                    if (dob) {
                        data.dateOfBirth = dob.toISOString();
                        console.log(` - DOB: MRZ="${data.dateOfBirth.split('T')[0]}" (Checksum Passed)`);
                    }
                }

                if (mrzResult.data.holderName && mrzResult.data.holderName.length > 5) {
                    if (mrzResult.data.holderName !== data.holderName) {
                        console.log(` - HolderName: Visual="${data.holderName}" -> MRZ="${mrzResult.data.holderName}" (Parsed from MRZ)`);
                    }
                }
            }
        }

        // 5. DATE DISAMBIGUATION & TARGETED HARVESTING
        // Check if OCR incorrectly prioritized DOB as Expiry/Issue date OR if expiry is missing
        const isCriticalType = ['passport', 'cdc', 'coc', 'medical'].some(t => type.includes(t));
        if (isCriticalType) {
            const currentYear = new Date().getFullYear();
            const birthDate = data.dateOfBirth;
            const targetExpiry = expectedData?.expiryDate;

            let isSuspicious = false;
            let reason = '';

            if (data.expiryDate) {
                const expiryObj = new Date(data.expiryDate);
                const expiryYear = expiryObj.getFullYear();
                const isMatchingDOB = birthDate && this.dateMatch(birthDate, data.expiryDate);
                const isSuspiciouslyOld = !isNaN(expiryYear) && expiryYear < currentYear - 5;

                if (isMatchingDOB) {
                    isSuspicious = true;
                    reason = 'Matches DOB';
                } else if (isSuspiciouslyOld) {
                    isSuspicious = true;
                    reason = `Suspiciously old year: ${expiryYear}`;
                }
            } else {
                isSuspicious = true;
                reason = 'Missing from structured extraction';
            }

            if (isSuspicious) {
                console.log(`[DATE-SANITY] ⚠️ OCR ${data.expiryDate ? 'misidentified' : 'missed'} Expiry Date for ${type}. Reason: ${reason}`);

                // Priority 1: Correct using MRZ if valid (only for Passport/CDC if MRZ exists)
                if (data.mrzValidation?.isValid) {
                    console.log(`   Corrected using MRZ validation.`);
                    // MRZ correction already applied in Phase 4 above
                }
                // Priority 2: Targeted Harvesting from raw text
                else if (ocrData.rawText) {
                    console.log(`   Attempting Targeted Harvesting from raw text for ${type}...`);
                    const candidates = this.harvestDates(ocrData.rawText);

                    if (targetExpiry) {
                        const preciseMatch = candidates.find(c => this.dateMatch(targetExpiry, c.toISOString()));
                        if (preciseMatch) {
                            console.log(`   🎯 Targeted Harvest Success! Found date matching user input: ${preciseMatch.toISOString()}`);
                            data.expiryDate = preciseMatch.toISOString();
                            isSuspicious = false;
                        }
                    }

                    if (isSuspicious) {
                        const futureDates = candidates.filter(d =>
                            d.getFullYear() > currentYear &&
                            (!birthDate || !this.dateMatch(birthDate, d.toISOString()))
                        );

                        if (futureDates.length > 0) {
                            futureDates.sort((a, b) => b.getTime() - a.getTime());
                            const harvested = futureDates[0].toISOString();
                            console.log(`   🎯 Harvested latest plausible future date for ${type}: ${harvested}`);
                            data.expiryDate = harvested;
                            isSuspicious = false;
                        }
                    }
                }

                if (isSuspicious && data.expiryDate) {
                    console.warn(`   Unsetting suspicious expiry date for ${type}: ${data.expiryDate}`);
                    data.expiryDate = undefined;
                }
            }
        }

        return data;
    }


    /**
     * Match dates with tolerance for different formats (DD-MM-YYYY, YYYY-MM-DD, etc.)
     */
    private dateMatch(date1: string | null | undefined, date2: string | null | undefined): boolean {
        if (!date1 || !date2) return false;

        const d1 = this.parseRobustDate(date1);
        const d2 = this.parseRobustDate(date2);

        if (!d1 || !d2) {
            console.log(`[DATE-MATCH] One or both dates failed robust parsing: d1="${date1}"->${d1}, d2="${date2}"->${d2}`);
            return false;
        }

        // 1-Day Tolerance to handle timezone offsets (e.g., IST vs UTC shifts)
        const timeDiff = Math.abs(d1.getTime() - d2.getTime());
        const oneDayMs = 24 * 60 * 60 * 1000;

        // Check if dates match EXACTLY or within 1.05 days (to be safe)
        const matches = timeDiff <= oneDayMs * 1.05;

        if (!matches) {
            console.log(`[DATE-MATCH-FAILURE] Diff: ${Math.round(timeDiff / oneDayMs * 100) / 100} days. d1: ${d1.toISOString().split('T')[0]}, d2: ${d2.toISOString().split('T')[0]}`);
        }

        return matches;
    }

    /**
     * Match dates with tolerance for different formats (DD-MM-YYYY, YYYY-MM-DD, etc.)
     */
    private parseRobustDate(dateStr: string): Date | null {

        // Try standard Date constructor first (handles ISO)
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;

        // Clean the string: remove common OCR noise and fix OCR character substitutions
        let cleaned = dateStr
            .replace(/[^0-9A-Z\-\/\.\s]/gi, ' ')  // Keep only valid date chars
            .replace(/O/gi, '0')  // OCR: O → 0
            .replace(/I/gi, '1')  // OCR: I → 1
            .replace(/l/g, '1')   // OCR: lowercase L → 1
            .trim();

        if (!cleaned) return null;

        // Try parsing with cleaned string
        const cleanedDate = new Date(cleaned);
        if (!isNaN(cleanedDate.getTime())) return cleanedDate;

        // Split by common separators
        const parts = cleaned.split(/[\-\/\.\s]+/).filter(p => p.length > 0);
        if (parts.length < 3) return null;

        const months: Record<string, number> = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11,
            'JANUARY': 0, 'FEBRUARY': 1, 'MARCH': 2, 'APRIL': 3, 'JUNE': 5,
            'JULY': 6, 'AUGUST': 7, 'SEPTEMBER': 8, 'OCTOBER': 9, 'NOVEMBER': 10, 'DECEMBER': 11
        };

        const getMonth = (m: string): number | null => {
            const val = parseInt(m, 10);
            if (!isNaN(val)) return val - 1;
            const upper = m.toUpperCase();
            if (months[upper] !== undefined) return months[upper];
            // Handle some common OCR errors for months
            if (upper.startsWith('JA')) return 0;
            if (upper.startsWith('FE')) return 1;
            if (upper.startsWith('MA')) return upper.includes('R') ? 2 : 4;
            if (upper.startsWith('AP')) return 3;
            if (upper.startsWith('JU')) return upper.includes('N') ? 5 : 6;
            if (upper.startsWith('AU')) return 7;
            if (upper.startsWith('SE')) return 8;
            if (upper.startsWith('OC')) return 9;
            if (upper.startsWith('NO')) return 10;
            if (upper.startsWith('DE')) return 11;
            return null;
        };

        // Try DD-MM-YYYY or DD-MMM-YYYY
        if (parts[0].length <= 2 && parts[2].length === 4) {
            const day = parseInt(parts[0], 10);
            const month = getMonth(parts[1]);
            const year = parseInt(parts[2], 10);

            if (month !== null && !isNaN(day) && !isNaN(year)) {
                const testDate = new Date(year, month, day);
                if (testDate.getFullYear() === year && testDate.getMonth() === month && testDate.getDate() === day) {
                    console.log(`[DATE-PARSE] Successfully parsed "${dateStr}" as DD-MM-YYYY: ${testDate.toISOString().split('T')[0]}`);
                    return testDate;
                }
            }
        }

        // Try YYYY-MM-DD
        if (parts[0].length === 4 && parts[2].length <= 2) {
            const year = parseInt(parts[0], 10);
            const month = getMonth(parts[1]);
            const day = parseInt(parts[2], 10);

            if (month !== null && !isNaN(day) && !isNaN(year)) {
                const testDate = new Date(year, month, day);
                if (testDate.getFullYear() === year && testDate.getMonth() === month && testDate.getDate() === day) {
                    console.log(`[DATE-PARSE] Successfully parsed "${dateStr}" as YYYY-MM-DD: ${testDate.toISOString().split('T')[0]}`);
                    return testDate;
                }
            }
        }

        console.log(`[DATE-PARSE] Failed to parse date: "${dateStr}"`);
        return null;
    }

    /**
     * Compare existing data with extracted data
     */
    private compareFields(
        existing: ExistingDocumentData,
        extracted: ExtractedDocumentData
    ): FieldComparison[] {
        const comparisons: FieldComparison[] = [];

        // Document Number (CRITICAL FIELD)
        comparisons.push({
            field: 'documentNumber',
            displayName: 'Document Number',
            existingValue: existing.documentNumber,
            extractedValue: extracted.documentNumber || null,
            matches: this.fuzzyMatchWithContext(existing.documentNumber, extracted.documentNumber, 'critical'),
            similarity: this.calculateSimilarity(existing.documentNumber, extracted.documentNumber),
            isEditable: true,
            confidenceLevel: this.assessConfidence(extracted.documentNumber)
        });

        // Issuing Authority
        comparisons.push({
            field: 'issuingAuthority',
            displayName: 'Issuing Authority',
            existingValue: existing.issuingAuthority,
            extractedValue: extracted.issuingAuthority || null,
            matches: this.fuzzyMatch(existing.issuingAuthority, extracted.issuingAuthority),
            similarity: this.calculateSimilarity(existing.issuingAuthority, extracted.issuingAuthority),
            isEditable: true,
            confidenceLevel: this.assessConfidence(extracted.issuingAuthority)
        });

        // Expiry Date
        if (existing.expiryDate) {
            comparisons.push({
                field: 'expiryDate',
                displayName: 'Expiry Date',
                existingValue: existing.expiryDate,
                extractedValue: extracted.expiryDate || null,
                matches: this.dateMatch(existing.expiryDate, extracted.expiryDate),
                similarity: this.dateMatch(existing.expiryDate, extracted.expiryDate) ? 100 : 0,
                isEditable: true,
                confidenceLevel: this.assessConfidence(extracted.expiryDate)
            });
        }

        // Issue Date
        if (existing.issueDate) {
            comparisons.push({
                field: 'issueDate',
                displayName: 'Issue Date',
                existingValue: existing.issueDate,
                extractedValue: extracted.issueDate || null,
                matches: this.dateMatch(existing.issueDate, extracted.issueDate),
                similarity: this.dateMatch(existing.issueDate, extracted.issueDate) ? 100 : 0,
                isEditable: true,
                confidenceLevel: this.assessConfidence(extracted.issueDate)
            });
        }



        // Document Type Check
        const expectedType = existing.type.toLowerCase();
        const detectedType = extracted.detectedDocumentType?.toLowerCase() || 'other';

        // Map internal types to common OCR terms
        const typeMapping: Record<string, string[]> = {
            'passport': ['passport'],
            'cdc': ['cdc', 'seaman'],
            'coc': ['coc', 'competency', 'stcw'],
            'medical': ['medical', 'health']
        };

        const typeMatches = typeMapping[expectedType]?.some(t => detectedType.includes(t)) || false;

        comparisons.push({
            field: 'documentType',
            displayName: 'Document Type',
            existingValue: expectedType,
            extractedValue: detectedType,
            matches: typeMatches,
            similarity: typeMatches ? 100 : 0,
            isEditable: false, // Type is detected, not typically manually corrected here
            confidenceLevel: detectedType !== 'other' ? 'high' : 'low'
        });

        return comparisons;
    }

    /**
     * Global Search: Check if document number is unique across all crew members
     */
    public async isDocumentNumberUnique(
        documentNumber: string,
        currentCrewMemberId?: string,
        currentDocumentId?: string
    ): Promise<{ isUnique: boolean; ownerName?: string }> {
        if (!documentNumber) return { isUnique: true };

        const normalizedNum = documentNumber.replace(/[\s\-\/\.]/g, '').toUpperCase();
        const allDocuments = await storage.getDocuments();

        const duplicate = allDocuments.find(doc => {
            if (currentDocumentId && doc.id === currentDocumentId) return false;

            const docNum = doc.documentNumber.replace(/[\s\-\/\.]/g, '').toUpperCase();
            return docNum === normalizedNum && doc.crewMemberId !== currentCrewMemberId;
        });

        if (duplicate) {
            const crewMember = await storage.getCrewMember(duplicate.crewMemberId);
            return {
                isUnique: false,
                ownerName: crewMember ? `${crewMember.firstName} ${crewMember.lastName}` : 'another crew member'
            };
        }

        return { isUnique: true };
    }

    /**
     * Calculate overall match score from field comparisons
     */
    private calculateMatchScore(comparisons: FieldComparison[]): number {
        if (comparisons.length === 0) return 0;

        // Weight document number and expiry date more heavily
        const weights: Record<string, number> = {
            documentNumber: 2.0,
            expiryDate: 1.5,
            issuingAuthority: 1.0,
            issueDate: 0.5
        };

        let totalWeight = 0;
        let weightedScore = 0;

        comparisons.forEach(comp => {
            const weight = weights[comp.field] || 1.0;
            totalWeight += weight;
            weightedScore += comp.similarity * weight;
        });

        return Math.round(weightedScore / totalWeight);
    }

    /**
     * Generate warning messages for mismatches
     */
    private generateWarnings(
        comparisons: FieldComparison[],
        extracted?: ExtractedDocumentData
    ): string[] {
        const warnings: string[] = [];

        comparisons.forEach(comp => {
            if (!comp.matches && comp.extractedValue) {
                if (comp.field === 'holderName') {
                    warnings.push(
                        `Identity Mismatch: This document appears to belong to "${comp.extractedValue}", not "${comp.existingValue}".`
                    );
                } else {
                    warnings.push(
                        `${comp.displayName} mismatch: Expected "${comp.existingValue}", found "${comp.extractedValue}"`
                    );
                }
            } else if (!comp.extractedValue) {
                warnings.push(`${comp.displayName} could not be extracted from the document`);
            }
        });

        if (extracted && extracted.mrzValidation && !extracted.mrzValidation.isValid) {
            warnings.push(`MRZ validation failed: ${extracted.mrzValidation.errors.join(', ')} `);
        }

        return warnings;
    }

    /**
     * Bidirectional OCR character normalization
     * Handles common OCR misrecognitions by normalizing both directions
     */
    private ocrNormalize(str: string): string {
        return str
            .replace(/[O0]/g, 'Ø')      // O and 0 → Ø
            .replace(/[I1L]/g, '|')     // I, 1, L → |
            .replace(/[S5]/g, '$')      // S and 5 → $
            .replace(/[Z2]/g, 'Ƶ')      // Z and 2 → Ƶ
            .replace(/[G6]/g, 'Ǥ')      // G and 6 → Ǥ
            .replace(/[UJ]/g, 'Ʉ')      // U and J → Ʉ
            .replace(/[B8]/g, 'Ɓ')      // B and 8 → Ɓ
            .replace(/[VY]/g, 'Ʋ')      // V and Y → Ʋ
            .replace(/[CG]/g, 'Ƈ')      // C and G → Ƈ
            .toUpperCase();
    }

    /**
     * Fuzzy string matching with specialized handling for document numbers.
     */
    private fuzzyMatch(str1: string | null | undefined, str2: string | null | undefined): boolean {
        if (!str1 || !str2) return false;

        const normalize = (s: string) => s.replace(/[\s\-\/\.]/g, '').toUpperCase();
        let n1 = normalize(str1);
        let n2 = normalize(str2);

        // Treat N/A, NONE, and empty values as equivalent
        const isEmpty = (val: string) => !val || val === 'NONE' || val === 'NA' || val === 'NULL';
        if (isEmpty(n1) && isEmpty(n2)) return true;

        if (n1 === n2) return true;

        const ocr1 = this.ocrNormalize(n1);
        const ocr2 = this.ocrNormalize(n2);

        if (ocr1 === ocr2) return true;
        if (n1.includes(n2) || n2.includes(n1)) return true;

        const similarity = this.calculateSimilarity(str1, str2);
        return similarity >= 85;
    }

    /**
     * Context-aware fuzzy matching
     */
    private fuzzyMatchWithContext(
        str1: string | null | undefined,
        str2: string | null | undefined,
        fieldType: 'critical' | 'standard'
    ): boolean {
        if (!str1 || !str2) return false;

        const normalize = (s: string) => s.replace(/[\s\-\/\.]/g, '').toUpperCase();
        const n1 = normalize(str1);
        const n2 = normalize(str2);

        // Treat N/A, NONE, and empty values as equivalent even for critical fields
        const isEmpty = (val: string) => !val || val === 'NONE' || val === 'NA' || val === 'NULL';
        if (isEmpty(n1) && isEmpty(n2)) return true;

        if (n1 === n2) return true;

        if (fieldType === 'critical') {
            const ocr1 = this.ocrNormalize(n1);
            const ocr2 = this.ocrNormalize(n2);

            if (ocr1 === ocr2) return true;

            const ocrSimilarity = this.calculateSimilarity(ocr1, ocr2);
            if (ocrSimilarity >= 90) return true;

            const regularSimilarity = this.calculateSimilarity(str1, str2);
            if (regularSimilarity >= 95) return true;

            return false;
        }

        return this.fuzzyMatch(str1, str2);
    }

    /**
     * Calculate string similarity using Levenshtein distance
     */
    private calculateSimilarity(str1: string | null | undefined, str2: string | null | undefined): number {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 100;

        const normalize = (s: string) => s.replace(/\s+/g, '').toUpperCase();
        const s1 = normalize(str1);
        const s2 = normalize(str2);

        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;

        if (longer.length === 0) return 100;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return Math.round(((longer.length - editDistance) / longer.length) * 100);
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];
        for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
        for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }

    /**
     * Find character differences between two strings
     */
    private findCharacterDifferences(str1: string, str2: string): string[] {
        if (!str1 || !str2) return [];
        const diffs: string[] = [];
        const maxLen = Math.max(str1.length, str2.length);
        for (let i = 0; i < maxLen; i++) {
            const char1 = (str1[i] || '').toUpperCase();
            const char2 = (str2[i] || '').toUpperCase();
            if (char1 !== char2) diffs.push(`pos ${i}: ${char1 || '∅'}→${char2 || '∅'}`);
        }
        return diffs;
    }

    /**
     * Check if character differences match known OCR confusion patterns
     */
    private isKnownOCRConfusion(differences: string[]): boolean {
        const knownConfusions = [
            ['U', 'V'], ['V', 'U'], ['I', 'J'], ['J', 'I'], ['I', '1'], ['1', 'I'],
            ['O', '0'], ['0', 'O'], ['S', '5'], ['5', 'S'], ['B', '8'], ['8', 'B'], ['Z', '2'], ['2', 'Z']
        ];
        for (const diff of differences) {
            const match = diff.match(/pos \d+: (.)→(.)/);
            if (match) {
                const [, char1, char2] = match;
                if (knownConfusions.some(([a, b]) => (char1 === a && char2 === b) || (char1 === b && char2 === a))) return true;
            }
        }
        return false;
    }

    /**
     * Assess OCR confidence
     */
    private assessConfidence(value: string | null | undefined): 'high' | 'medium' | 'low' {
        if (!value || value === 'NONE' || value.trim() === '') return 'low';
        const clean = value.replace(/[\s\-\/\.]/g, '');
        if (/^[A-Z0-9]+$/.test(clean) && clean.length >= 5 && clean.length <= 25) return 'high';
        return value.length >= 3 ? 'medium' : 'low';
    }

    /**
     * Deep cleaned names
     */
    private cleanExtractedName(name: string | null | undefined): string | undefined {
        if (!name || name === 'NONE' || name === 'null') return undefined;
        return name.toUpperCase().replace(/MS\.\s|MR\.\s|MRS\.\s|DR\.\s/g, '').replace(/[^A-Z]/g, ' ').replace(/\s+/g, ' ').trim() || undefined;
    }

    /**
     * Fuzzy name match
     */
    private fuzzyNameMatch(name1: string | null | undefined, name2: string | null | undefined): boolean {
        if (!name1 || !name2) return false;
        const n1 = this.cleanExtractedName(name1) || '';
        const n2 = this.cleanExtractedName(name2) || '';
        if (this.calculateSimilarity(n1, n2) >= 85) return true;
        const p1 = n1.split(' ').sort().join(' ');
        const p2 = n2.split(' ').sort().join(' ');
        return this.calculateSimilarity(p1, p2) >= 90;
    }

    /**
     * Compare extracted data against the seafarer's actual profile
     */
    async compareProfile(crewId: string, extractedData: ExtractedDocumentData): Promise<ProfileComparison> {
        const crewMember = await storage.getCrewMember(crewId);
        if (!crewMember) {
            throw new Error(`Crew member ${crewId} not found`);
        }

        const personal: FieldComparison[] = [];
        const nok: FieldComparison[] = [];

        // Personal Details Comparison
        personal.push(this.compareSingleField('firstName', crewMember.firstName, extractedData.firstName, 'First Name'));
        personal.push(this.compareSingleField('lastName', crewMember.lastName, extractedData.lastName, 'Last Name'));
        personal.push(this.compareSingleField('nationality', crewMember.nationality, extractedData.nationality, 'Nationality'));

        const dbDob = crewMember.dateOfBirth
            ? (typeof crewMember.dateOfBirth === 'string' ? crewMember.dateOfBirth : crewMember.dateOfBirth.toISOString())
            : null;
        personal.push(this.compareSingleField('dateOfBirth', dbDob, extractedData.dateOfBirth, 'Date of Birth'));
        personal.push(this.compareSingleField('phoneNumber', crewMember.phoneNumber, extractedData.phoneNumber, 'Phone Number'));
        personal.push(this.compareSingleField('email', crewMember.email, extractedData.email, 'Email'));

        // NOK Details Comparison
        const emContact = (crewMember.emergencyContact as any) || {};
        nok.push(this.compareSingleField('nokName', emContact.name, extractedData.nokName, 'NOK Name'));
        nok.push(this.compareSingleField('nokRelationship', emContact.relationship, extractedData.nokRelationship, 'NOK Relationship'));
        nok.push(this.compareSingleField('nokPhone', emContact.phone, extractedData.nokPhone, 'NOK Phone'));
        nok.push(this.compareSingleField('nokEmail', emContact.email, extractedData.nokEmail, 'NOK Email'));
        nok.push(this.compareSingleField('nokAddress', emContact.postalAddress, extractedData.nokAddress, 'NOK Address'));

        const hasChanges = personal.some(c => !c.matches && c.extractedValue && c.extractedValue !== 'NONE' && c.extractedValue.length > 2) ||
            nok.some(c => !c.matches && c.extractedValue && c.extractedValue !== 'NONE' && c.extractedValue.length > 2);

        return { personal, nok, hasChanges };
    }

    private compareSingleField(field: string, existing: string | null | undefined, extracted: string | null | undefined, displayName: string): FieldComparison {
        // Use fuzzy matching for names and other text fields
        let matches = false;
        if (field.toLowerCase().includes('name') || field === 'firstName' || field === 'lastName') {
            matches = this.fuzzyNameMatch(existing, extracted);
        } else if (field.toLowerCase().includes('date')) {
            matches = this.dateMatch(existing, extracted);
        } else {
            matches = this.fuzzyMatch(existing, extracted);
        }

        return {
            field,
            existingValue: existing || null,
            extractedValue: extracted || null,
            matches,
            similarity: this.calculateSimilarity(existing || '', extracted || ''),
            displayName,
            isEditable: true,
            confidenceLevel: this.assessConfidence(extracted)
        };
    }
}

export const documentVerificationService = new DocumentVerificationService();

