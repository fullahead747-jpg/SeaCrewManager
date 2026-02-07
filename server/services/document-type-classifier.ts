import * as fs from 'fs';

export interface DocumentClassificationResult {
    detectedType: string;
    confidence: number; // 0-100
    alternativeTypes: Array<{ type: string; confidence: number }>;
    matchedKeywords: string[];
    detectionMethod: 'keywords' | 'visual' | 'hybrid';
}

export interface DocumentTypePattern {
    type: string;
    keywords: string[];
    requiredKeywords: string[];
    visualPatterns?: string[];
}

export class DocumentTypeClassifier {
    private patterns: DocumentTypePattern[] = [
        {
            type: 'passport',
            keywords: [
                'passport', 'republic of india', 'nationality', 'place of birth',
                'place of issue', 'date of issue', 'date of expiry', 'surname',
                'given names', 'sex', 'passport no', 'type p', 'code of issuing state'
            ],
            requiredKeywords: ['passport'],
            visualPatterns: ['MRZ', 'photo']
        },
        {
            type: 'cdc',
            keywords: [
                'continuous discharge certificate', 'cdc', 'seaman', 'seafarer',
                'discharge book', 'rank', 'vessel', 'port of registry', 'flag',
                'sign on', 'sign off', 'capacity', 'seamans book', 'indos'
            ],
            requiredKeywords: ['cdc', 'discharge', 'seaman'],
            visualPatterns: ['table', 'vessel entries']
        },
        {
            type: 'coc',
            keywords: [
                'certificate of competency', 'coc', 'stcw', 'endorsement',
                'master', 'chief engineer', 'officer', 'watchkeeping', 'regulation',
                'capacity', 'limitations', 'grade', 'certificate number'
            ],
            requiredKeywords: ['certificate', 'competency'],
            visualPatterns: ['official seal', 'signature']
        },
        {
            type: 'medical',
            keywords: [
                'medical', 'fitness', 'examination', 'health', 'doctor', 'physician',
                'fit for sea service', 'seafarer medical', 'medical examination',
                'approved doctor', 'medical certificate', 'fit to work', 'restrictions'
            ],
            requiredKeywords: ['medical'],
            visualPatterns: ['doctor signature', 'clinic stamp']
        },
        {
            type: 'visa',
            keywords: [
                'visa', 'entry', 'immigration', 'permit', 'authorized stay',
                'visa type', 'visa number', 'port of entry', 'embassy', 'consulate'
            ],
            requiredKeywords: ['visa'],
            visualPatterns: ['stamp', 'barcode']
        },
        {
            type: 'contract',
            keywords: [
                'employment agreement', 'contract', 'seafarer employment',
                'wages', 'salary', 'duration', 'parties', 'employer', 'employee',
                'terms and conditions', 'sign on', 'sign off', 'vessel name'
            ],
            requiredKeywords: ['contract', 'employment'],
            visualPatterns: ['signatures', 'multiple pages']
        }
    ];

    /**
     * Classify document type based on content analysis
     */
    async classifyDocument(
        filePath: string,
        ocrText?: string
    ): Promise<DocumentClassificationResult> {
        try {
            console.log(`[DOCUMENT-CLASSIFIER] Analyzing: ${filePath}`);

            // If OCR text not provided, we'd need to extract it
            // For now, assume it's provided or use filename hints
            const text = ocrText || '';
            const fileName = filePath.toLowerCase();

            // Extract keywords from text
            const extractedKeywords = this.extractKeywords(text);

            // Score each document type
            const scores = this.patterns.map(pattern => ({
                type: pattern.type,
                confidence: this.calculateTypeConfidence(pattern, extractedKeywords, text, fileName)
            }));

            // Sort by confidence
            scores.sort((a, b) => b.confidence - a.confidence);

            const detectedType = scores[0].type;
            const confidence = scores[0].confidence;
            const alternativeTypes = scores.slice(1, 4); // Top 3 alternatives

            // Determine matched keywords
            const detectedPattern = this.patterns.find(p => p.type === detectedType);
            const matchedKeywords = detectedPattern
                ? detectedPattern.keywords.filter(kw =>
                    extractedKeywords.some(ek => ek.includes(kw) || kw.includes(ek))
                )
                : [];

            const detectionMethod = this.getDetectionMethod(confidence, matchedKeywords.length);

            console.log(`[DOCUMENT-CLASSIFIER] Detected: ${detectedType} (${confidence}% confidence)`);

            return {
                detectedType,
                confidence,
                alternativeTypes,
                matchedKeywords,
                detectionMethod
            };
        } catch (error) {
            console.error('[DOCUMENT-CLASSIFIER] Error:', error);
            return {
                detectedType: 'unknown',
                confidence: 0,
                alternativeTypes: [],
                matchedKeywords: [],
                detectionMethod: 'keywords'
            };
        }
    }

    /**
     * Extract keywords from OCR text
     */
    private extractKeywords(text: string): string[] {
        if (!text) return [];

        // Normalize text
        const normalized = text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Split into words and filter common words
        const words = normalized.split(' ');
        const commonWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
            'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
        ]);

        const keywords = words.filter(word =>
            word.length > 2 && !commonWords.has(word)
        );

        // Also extract bigrams (two-word phrases)
        const bigrams: string[] = [];
        for (let i = 0; i < words.length - 1; i++) {
            const bigram = `${words[i]} ${words[i + 1]}`;
            if (bigram.length > 5) {
                bigrams.push(bigram);
            }
        }

        return [...keywords, ...bigrams];
    }

    /**
     * Calculate confidence score for a document type
     */
    private calculateTypeConfidence(
        pattern: DocumentTypePattern,
        extractedKeywords: string[],
        fullText: string,
        fileName: string
    ): number {
        let score = 0;
        const normalizedText = fullText.toLowerCase();

        // Check filename hints (10 points)
        if (fileName.includes(pattern.type)) {
            score += 10;
        }

        // Check required keywords (must have at least one) - 40 points
        const hasRequiredKeyword = pattern.requiredKeywords.some(required =>
            normalizedText.includes(required) ||
            extractedKeywords.some(ek => ek.includes(required) || required.includes(ek))
        );

        if (hasRequiredKeyword) {
            score += 40;
        } else {
            // If no required keywords, confidence is very low
            return Math.min(score, 20);
        }

        // Count matching keywords (up to 40 points)
        let matchCount = 0;
        pattern.keywords.forEach(keyword => {
            if (normalizedText.includes(keyword)) {
                matchCount++;
            } else {
                // Check for partial matches in extracted keywords
                const partialMatch = extractedKeywords.some(ek =>
                    ek.includes(keyword) || keyword.includes(ek)
                );
                if (partialMatch) {
                    matchCount += 0.5;
                }
            }
        });

        const keywordScore = Math.min(40, (matchCount / pattern.keywords.length) * 40);
        score += keywordScore;

        // Bonus for multiple keyword matches (10 points)
        if (matchCount >= 3) {
            score += 10;
        }

        // Penalty for very short text (might not have enough info)
        if (normalizedText.length < 100) {
            score *= 0.8;
        }

        return Math.min(100, Math.round(score));
    }

    /**
     * Determine detection method based on results
     */
    private getDetectionMethod(
        confidence: number,
        matchedKeywordsCount: number
    ): 'keywords' | 'visual' | 'hybrid' {
        if (matchedKeywordsCount >= 3) {
            return 'keywords';
        } else if (confidence > 60) {
            return 'hybrid';
        } else {
            return 'visual';
        }
    }

    /**
     * Validate detected type against expected type
     */
    validateTypeMatch(
        detectedType: string,
        expectedType: string
    ): { matches: boolean; warning?: string } {
        const normalizedDetected = detectedType.toLowerCase();
        const normalizedExpected = expectedType.toLowerCase();

        // Direct match
        if (normalizedDetected === normalizedExpected) {
            return { matches: true };
        }

        // Check for common aliases
        const aliases: Record<string, string[]> = {
            'passport': ['passport', 'travel document'],
            'cdc': ['cdc', 'continuous discharge certificate', 'discharge book', 'seamans book'],
            'coc': ['coc', 'certificate of competency', 'competency certificate', 'stcw'],
            'medical': ['medical', 'medical certificate', 'health certificate', 'fitness certificate'],
            'visa': ['visa', 'entry permit'],
            'contract': ['contract', 'employment agreement', 'sea agreement']
        };

        for (const [type, typeAliases] of Object.entries(aliases)) {
            if (typeAliases.includes(normalizedDetected) && typeAliases.includes(normalizedExpected)) {
                return { matches: true };
            }
        }

        // No match
        return {
            matches: false,
            warning: `Document appears to be a ${detectedType}, but was uploaded as ${expectedType}. Please verify the document type.`
        };
    }

    /**
     * Get document type from filename hints
     */
    getTypeFromFilename(fileName: string): string | null {
        const normalized = fileName.toLowerCase();

        for (const pattern of this.patterns) {
            if (normalized.includes(pattern.type)) {
                return pattern.type;
            }
        }

        return null;
    }
}

export const documentTypeClassifier = new DocumentTypeClassifier();
