/**
 * Utility for validating and correcting common OCR mistakes in document numbers
 */

export interface DocumentNumberValidation {
    original: string;
    corrected: string;
    confidence: 'high' | 'medium' | 'low';
    corrections: string[];
    warnings: string[];
}

export class DocumentNumberValidator {
    /**
     * Common OCR character confusions
     */
    private static readonly COMMON_CONFUSIONS = {
        // Letter to Number
        'O': '0',  // Letter O to Zero
        'I': '1',  // Letter I to One
        'l': '1',  // Lowercase L to One
        'S': '5',  // Letter S to Five
        'Z': '2',  // Letter Z to Two
        'B': '8',  // Letter B to Eight

        // Number to Letter (less common but possible)
        '0': 'O',
        '1': 'I',
        '5': 'S',
    };

    /**
     * Passport number patterns by country
     * Format: [prefix pattern, total length, description]
     */
    private static readonly PASSPORT_PATTERNS: {
        [key: string]: {
            patterns: RegExp[];
            description: string;
        };
    } = {
            'IND': { // India
                patterns: [
                    /^[A-Z]\d{7}$/,     // Letter + 7 digits (e.g., J2701560)
                    /^[A-Z]{2}\d{7}$/,  // 2 Letters + 7 digits
                ],
                description: 'Indian passport: 1-2 letters + 7 digits'
            },
            'USA': {
                patterns: [
                    /^\d{9}$/,          // 9 digits
                ],
                description: 'US passport: 9 digits'
            },
            'GBR': {
                patterns: [
                    /^\d{9}$/,          // 9 digits
                    /^[A-Z]{2}\d{7}$/,  // 2 letters + 7 digits
                ],
                description: 'UK passport: 9 digits or 2 letters + 7 digits'
            },
            'DEFAULT': {
                patterns: [
                    /^[A-Z0-9]{6,9}$/,  // 6-9 alphanumeric characters
                ],
                description: 'Standard passport: 6-9 alphanumeric'
            }
        };

    /**
     * Validate and potentially correct a passport number
     */
    static validatePassportNumber(
        number: string,
        nationality?: string,
        mrzNumber?: string
    ): DocumentNumberValidation {
        const result: DocumentNumberValidation = {
            original: number,
            corrected: number,
            confidence: 'high',
            corrections: [],
            warnings: []
        };

        if (!number || number === 'NONE') {
            result.confidence = 'low';
            result.warnings.push('No passport number provided');
            return result;
        }

        // Clean the number (remove spaces, special chars except alphanumeric)
        const cleaned = number.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (cleaned !== number) {
            result.corrected = cleaned;
            result.corrections.push(`Removed non-alphanumeric characters`);
        }

        // Check against MRZ if available
        if (mrzNumber && mrzNumber !== 'NONE') {
            const cleanedMrz = mrzNumber.replace(/</g, '').trim();
            if (cleanedMrz && cleanedMrz !== cleaned) {
                result.warnings.push(`Visual number (${cleaned}) differs from MRZ (${cleanedMrz})`);
                result.confidence = 'medium';

                // If MRZ is more standard-looking, suggest it
                if (this.matchesPattern(cleanedMrz, nationality)) {
                    result.warnings.push(`MRZ number appears more valid - consider using: ${cleanedMrz}`);
                }
            }
        }

        // Validate against known patterns
        const countryCode = nationality?.substring(0, 3).toUpperCase() || 'DEFAULT';
        const patterns = this.PASSPORT_PATTERNS[countryCode] || this.PASSPORT_PATTERNS['DEFAULT'];

        const matches = patterns.patterns.some(pattern => pattern.test(result.corrected));
        if (!matches) {
            result.warnings.push(`Number doesn't match expected pattern: ${patterns.description}`);
            result.confidence = 'medium';
        }

        // Check for common OCR mistakes
        const potentialCorrections = this.suggestCorrections(result.corrected, nationality);
        if (potentialCorrections.length > 0) {
            result.warnings.push(`Potential OCR corrections available: ${potentialCorrections.join(', ')}`);
        }

        return result;
    }

    /**
     * Check if a number matches expected patterns
     */
    private static matchesPattern(number: string, nationality?: string): boolean {
        const countryCode = nationality?.substring(0, 3).toUpperCase() || 'DEFAULT';
        const patterns = this.PASSPORT_PATTERNS[countryCode] || this.PASSPORT_PATTERNS['DEFAULT'];
        return patterns.patterns.some(pattern => pattern.test(number));
    }

    /**
     * Suggest corrections based on common OCR mistakes
     */
    private static suggestCorrections(number: string, nationality?: string): string[] {
        const suggestions: string[] = [];
        const countryCode = nationality?.substring(0, 3).toUpperCase() || 'DEFAULT';
        const patterns = this.PASSPORT_PATTERNS[countryCode] || this.PASSPORT_PATTERNS['DEFAULT'];

        // Try common character substitutions
        const chars = number.split('');

        // For Indian passports (Letter + digits), check if first char should be a letter
        if (countryCode === 'IND' && /^\d/.test(number)) {
            // First character is a digit, might be confused letter
            const firstChar = chars[0];
            if (firstChar === '1') {
                const corrected = 'I' + number.substring(1);
                if (patterns.patterns.some(p => p.test(corrected))) {
                    suggestions.push(corrected);
                }
            } else if (firstChar === '0') {
                const corrected = 'O' + number.substring(1);
                if (patterns.patterns.some(p => p.test(corrected))) {
                    suggestions.push(corrected);
                }
            }
        }

        // Check for J vs I confusion (common in Indian passports)
        if (number.includes('I') || number.includes('J')) {
            const withJ = number.replace(/I/g, 'J');
            const withI = number.replace(/J/g, 'I');

            if (withJ !== number && patterns.patterns.some(p => p.test(withJ))) {
                suggestions.push(withJ);
            }
            if (withI !== number && patterns.patterns.some(p => p.test(withI))) {
                suggestions.push(withI);
            }
        }

        // Check for U vs V confusion
        if (number.includes('U') || number.includes('V')) {
            const withU = number.replace(/V/g, 'U');
            const withV = number.replace(/U/g, 'V');

            if (withU !== number && patterns.patterns.some(p => p.test(withU))) {
                suggestions.push(withU);
            }
            if (withV !== number && patterns.patterns.some(p => p.test(withV))) {
                suggestions.push(withV);
            }
        }

        return suggestions.filter(s => s !== number);
    }

    /**
     * Validate CDC number format
     */
    static validateCDCNumber(number: string): DocumentNumberValidation {
        const result: DocumentNumberValidation = {
            original: number,
            corrected: number,
            confidence: 'high',
            corrections: [],
            warnings: []
        };

        if (!number || number === 'NONE') {
            result.confidence = 'low';
            result.warnings.push('No CDC number provided');
            return result;
        }

        // CDC numbers are typically alphanumeric, varying formats by country
        const cleaned = number.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (cleaned !== number) {
            result.corrected = cleaned;
            result.corrections.push(`Removed non-alphanumeric characters`);
        }

        // Basic validation: should be at least 5 characters
        if (cleaned.length < 5) {
            result.warnings.push('CDC number seems too short (expected at least 5 characters)');
            result.confidence = 'low';
        }

        return result;
    }

    /**
     * Validate COC number format
     */
    static validateCOCNumber(number: string): DocumentNumberValidation {
        const result: DocumentNumberValidation = {
            original: number,
            corrected: number,
            confidence: 'high',
            corrections: [],
            warnings: []
        };

        if (!number || number === 'NONE') {
            result.confidence = 'low';
            result.warnings.push('No COC number provided');
            return result;
        }

        // COC numbers vary widely, just basic cleanup
        const cleaned = number.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (cleaned !== number) {
            result.corrected = cleaned;
            result.corrections.push(`Removed non-alphanumeric characters`);
        }

        return result;
    }
}
