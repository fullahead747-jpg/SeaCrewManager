import { ExtractedDocumentData } from './document-verification-service';

export interface FieldPosition {
    field: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    page?: number;
}

export interface FieldConfidence {
    field: string;
    value: string | null | undefined;
    confidence: number; // 0-100
    source: 'groq' | 'ocrspace' | 'tesseract' | 'mrz' | 'merged';
    position?: FieldPosition;
}

export interface FieldAlignmentResult {
    fieldConfidences: FieldConfidence[];
    overallConfidence: number; // 0-100
    lowConfidenceFields: string[];
    suggestions: string[];
    alignmentScore: number; // 0-100
}

export interface MultiEngineExtraction {
    groqResult?: ExtractedDocumentData;
    traditionalResult?: ExtractedDocumentData;
    mergedResult: ExtractedDocumentData;
}

export class DocumentFieldAlignment {
    /**
     * Analyze field alignment from multiple OCR engine results
     */
    analyzeFieldAlignment(
        extraction: MultiEngineExtraction,
        documentType: string
    ): FieldAlignmentResult {
        const fieldConfidences: FieldConfidence[] = [];
        const criticalFields = this.getCriticalFields(documentType);

        // Analyze each critical field
        criticalFields.forEach(fieldName => {
            const confidence = this.getFieldConfidenceScore(
                fieldName,
                extraction.groqResult,
                extraction.traditionalResult,
                extraction.mergedResult
            );
            fieldConfidences.push(confidence);
        });

        // Calculate overall confidence
        const overallConfidence = this.calculateOverallConfidence(fieldConfidences);

        // Identify low confidence fields (< 60%)
        const lowConfidenceFields = fieldConfidences
            .filter(fc => fc.confidence < 60)
            .map(fc => fc.field);

        // Generate suggestions for manual review
        const suggestions = this.suggestFieldCorrections(fieldConfidences, documentType);

        // Calculate alignment score based on engine agreement
        const alignmentScore = this.calculateAlignmentScore(
            extraction.groqResult,
            extraction.traditionalResult,
            criticalFields
        );

        return {
            fieldConfidences,
            overallConfidence,
            lowConfidenceFields,
            suggestions,
            alignmentScore
        };
    }

    /**
     * Get confidence score for a specific field based on multi-engine extraction
     */
    private getFieldConfidenceScore(
        fieldName: string,
        groqResult?: ExtractedDocumentData,
        traditionalResult?: ExtractedDocumentData,
        mergedResult?: ExtractedDocumentData
    ): FieldConfidence {
        const groqValue = groqResult ? this.getFieldValue(groqResult, fieldName) : null;
        const tradValue = traditionalResult ? this.getFieldValue(traditionalResult, fieldName) : null;
        const mergedValue = mergedResult ? this.getFieldValue(mergedResult, fieldName) : null;

        let confidence = 0;
        let source: 'groq' | 'ocrspace' | 'tesseract' | 'mrz' | 'merged' = 'merged';

        // Case 1: Both engines agree - HIGH confidence
        if (groqValue && tradValue && this.valuesMatch(groqValue, tradValue)) {
            confidence = 95;
            source = 'merged';
        }
        // Case 2: Only one engine extracted - MEDIUM confidence
        else if (groqValue && !tradValue) {
            confidence = 70;
            source = 'groq';
        }
        else if (!groqValue && tradValue) {
            confidence = 65;
            source = 'ocrspace';
        }
        // Case 3: Both extracted but disagree - LOW confidence
        else if (groqValue && tradValue && !this.valuesMatch(groqValue, tradValue)) {
            confidence = 40;
            source = 'merged';
        }
        // Case 4: Neither extracted - VERY LOW confidence
        else {
            confidence = 0;
            source = 'merged';
        }

        // Boost confidence if MRZ validated
        if (mergedResult?.mrzValidation?.isValid && this.isMrzField(fieldName)) {
            confidence = Math.min(100, confidence + 20);
            source = 'mrz';
        }

        // Assess value quality
        const qualityBoost = this.assessValueQuality(mergedValue);
        confidence = Math.min(100, confidence + qualityBoost);

        return {
            field: fieldName,
            value: mergedValue,
            confidence: Math.round(confidence),
            source
        };
    }

    /**
     * Calculate overall confidence across all fields
     */
    private calculateOverallConfidence(fieldConfidences: FieldConfidence[]): number {
        if (fieldConfidences.length === 0) return 0;

        // Weight critical fields more heavily
        const weights: Record<string, number> = {
            documentNumber: 2.0,
            expiryDate: 1.8,
            holderName: 1.5,
            issueDate: 1.2,
            issuingAuthority: 1.0
        };

        let totalWeight = 0;
        let weightedSum = 0;

        fieldConfidences.forEach(fc => {
            const weight = weights[fc.field] || 1.0;
            totalWeight += weight;
            weightedSum += fc.confidence * weight;
        });

        return Math.round(weightedSum / totalWeight);
    }

    /**
     * Calculate alignment score based on engine agreement
     */
    private calculateAlignmentScore(
        groqResult?: ExtractedDocumentData,
        traditionalResult?: ExtractedDocumentData,
        criticalFields?: string[]
    ): number {
        if (!groqResult || !traditionalResult) return 50; // Only one engine available

        const fields = criticalFields || [
            'documentNumber',
            'expiryDate',
            'issueDate',
            'holderName',
            'issuingAuthority'
        ];

        let agreements = 0;
        let totalComparisons = 0;

        fields.forEach(field => {
            const val1 = this.getFieldValue(groqResult, field);
            const val2 = this.getFieldValue(traditionalResult, field);

            if (val1 || val2) {
                totalComparisons++;
                if (val1 && val2 && this.valuesMatch(val1, val2)) {
                    agreements++;
                }
            }
        });

        if (totalComparisons === 0) return 0;

        return Math.round((agreements / totalComparisons) * 100);
    }

    /**
     * Suggest fields that need manual review
     */
    private suggestFieldCorrections(
        fieldConfidences: FieldConfidence[],
        documentType: string
    ): string[] {
        const suggestions: string[] = [];

        fieldConfidences.forEach(fc => {
            if (fc.confidence < 60) {
                const fieldDisplay = this.getFieldDisplayName(fc.field);

                if (fc.confidence === 0) {
                    suggestions.push(
                        `${fieldDisplay} could not be extracted. Please verify and enter manually.`
                    );
                } else if (fc.confidence < 40) {
                    suggestions.push(
                        `${fieldDisplay} has very low confidence (${fc.confidence}%). Multiple OCR engines disagreed. Please review carefully.`
                    );
                } else {
                    suggestions.push(
                        `${fieldDisplay} has low confidence (${fc.confidence}%). Please verify the extracted value.`
                    );
                }
            }
        });

        // Add MRZ-specific suggestions
        const mrzFields = fieldConfidences.filter(fc =>
            this.isMrzField(fc.field) && fc.source !== 'mrz' && fc.confidence < 80
        );

        if (mrzFields.length > 0 && documentType.toLowerCase() === 'passport') {
            suggestions.push(
                'MRZ validation was not used for some fields. Ensure the MRZ zone is clearly visible in the scan.'
            );
        }

        return suggestions;
    }

    /**
     * Get critical fields for a document type
     */
    private getCriticalFields(documentType: string): string[] {
        const baseFields = [
            'documentNumber',
            'expiryDate',
            'issueDate',
            'holderName',
            'issuingAuthority'
        ];

        const type = documentType.toLowerCase();

        if (type === 'passport') {
            return [...baseFields, 'nationality', 'dateOfBirth'];
        } else if (type === 'cdc') {
            return [...baseFields, 'nationality'];
        } else if (type.includes('coc')) {
            return [...baseFields];
        } else if (type === 'medical') {
            return [...baseFields];
        }

        return baseFields;
    }

    /**
     * Get field value from extracted data
     */
    private getFieldValue(data: ExtractedDocumentData, fieldName: string): string | null {
        const value = (data as any)[fieldName];
        if (!value || value === 'NONE' || value === '---') return null;
        return String(value).trim();
    }

    /**
     * Check if two field values match (with fuzzy logic)
     */
    private valuesMatch(val1: string, val2: string): boolean {
        const normalize = (s: string) => s.replace(/[\s\-\/\.]/g, '').toUpperCase();
        const n1 = normalize(val1);
        const n2 = normalize(val2);

        // Exact match
        if (n1 === n2) return true;

        // Allow small differences for long values
        if (n1.length > 8 && n2.length > 8) {
            const similarity = this.calculateSimilarity(n1, n2);
            return similarity >= 90;
        }

        return false;
    }

    /**
     * Calculate string similarity (simple version)
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 100;

        let matches = 0;
        for (let i = 0; i < shorter.length; i++) {
            if (shorter[i] === longer[i]) matches++;
        }

        return (matches / longer.length) * 100;
    }

    /**
     * Assess quality of extracted value
     */
    private assessValueQuality(value: string | null | undefined): number {
        if (!value || value === 'NONE') return 0;

        let boost = 0;

        // Clean alphanumeric values get boost
        if (/^[A-Z0-9\s\-\/\.]+$/i.test(value)) {
            boost += 5;
        }

        // Reasonable length gets boost
        if (value.length >= 5 && value.length <= 30) {
            boost += 5;
        }

        // No excessive special characters
        const specialChars = (value.match(/[^A-Z0-9\s]/gi) || []).length;
        if (specialChars <= 3) {
            boost += 5;
        }

        return boost;
    }

    /**
     * Check if field is MRZ-validated
     */
    private isMrzField(fieldName: string): boolean {
        return ['documentNumber', 'expiryDate', 'dateOfBirth', 'holderName'].includes(fieldName);
    }

    /**
     * Get display name for field
     */
    private getFieldDisplayName(fieldName: string): string {
        const displayNames: Record<string, string> = {
            documentNumber: 'Document Number',
            expiryDate: 'Expiry Date',
            issueDate: 'Issue Date',
            holderName: 'Holder Name',
            issuingAuthority: 'Issuing Authority',
            nationality: 'Nationality',
            dateOfBirth: 'Date of Birth'
        };

        return displayNames[fieldName] || fieldName;
    }
}

export const documentFieldAlignment = new DocumentFieldAlignment();
