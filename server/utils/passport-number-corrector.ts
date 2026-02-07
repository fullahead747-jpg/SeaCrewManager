/**
 * Post-processing correction for common OCR mistakes in passport numbers
 * This is a FREE alternative to Google Cloud Vision API
 */

export interface CorrectionResult {
    original: string;
    corrected: string;
    confidence: 'high' | 'medium' | 'low';
    corrections: string[];
    reasoning: string[];
}

export class PassportNumberCorrector {
    /**
     * Correct common OCR mistakes in passport numbers
     */
    static correctPassportNumber(
        ocrNumber: string,
        nationality?: string,
        contextData?: {
            holderName?: string;
            issueDate?: string;
            expiryDate?: string;
        }
    ): CorrectionResult {
        const result: CorrectionResult = {
            original: ocrNumber,
            corrected: ocrNumber,
            confidence: 'high',
            corrections: [],
            reasoning: []
        };

        if (!ocrNumber || ocrNumber === 'NONE') {
            result.confidence = 'low';
            return result;
        }

        console.log(`[PASSPORT-CORRECTOR] Input: "${ocrNumber}", Nationality: "${nationality}"`);

        // Clean the number
        let corrected = ocrNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase();

        // INDIAN PASSPORT SPECIFIC CORRECTIONS
        const isIndian = nationality && (
            nationality.toUpperCase().includes('IND') ||
            nationality.toUpperCase() === 'INDIAN' ||
            nationality.toUpperCase() === 'INDIA'
        );

        console.log(`[PASSPORT-CORRECTOR] Is Indian: ${isIndian}`);

        if (isIndian) {
            // Indian passports: Letter + 7 digits (e.g., U2701560, J2701560)
            const indianPattern = /^([A-Z])(\d{7})$/;
            const match = corrected.match(indianPattern);

            console.log(`[PASSPORT-CORRECTOR] Indian pattern match: ${!!match}, Corrected: "${corrected}"`);

            if (match) {
                const firstChar = match[1];
                const digits = match[2];

                console.log(`[PASSPORT-CORRECTOR] First char: "${firstChar}", Digits: "${digits}"`);

                // J/U confusion is VERY common in Indian passports
                if (firstChar === 'J') {
                    // Check if this might be 'U' instead
                    // Indian passports commonly start with: U, J, K, L, M, N, P, R, S, T, V, Z
                    // J is less common than U for recent passports

                    result.reasoning.push('Indian passport detected with first character "J"');
                    result.reasoning.push('J/U confusion is common in OCR');
                    result.reasoning.push('U is more common than J for Indian passports');

                    // High confidence correction: J → U
                    corrected = 'U' + digits;
                    result.corrections.push(`Changed first character: J → U (common OCR confusion)`);
                    result.confidence = 'high';

                    console.log(`[PASSPORT-CORRECTOR] ✅ Applied J→U correction: "${corrected}"`);
                } else if (firstChar === 'I' || firstChar === '1') {
                    // I/1 confusion - could be J or U
                    result.reasoning.push('Indian passport detected with ambiguous first character (I or 1)');
                    result.reasoning.push('Could be J, U, or I - needs manual verification');

                    // Medium confidence: assume U (most common)
                    corrected = 'U' + digits;
                    result.corrections.push(`Changed first character: ${firstChar} → U (assumed most common)`);
                    result.confidence = 'medium';

                    console.log(`[PASSPORT-CORRECTOR] ✅ Applied ${firstChar}→U correction: "${corrected}"`);
                }

                result.corrected = corrected;
                return result;
            }
        }

        // GENERAL CORRECTIONS (all nationalities)

        // Pattern: Letter + digits
        const letterDigitPattern = /^([A-Z]{1,2})(\d+)$/;
        const generalMatch = corrected.match(letterDigitPattern);

        if (generalMatch) {
            const letters = generalMatch[1];
            const digits = generalMatch[2];
            let modified = false;

            // Check for common confusions in first character
            if (letters.length === 1) {
                const char = letters[0];

                // J/I/1 confusion
                if (char === '1') {
                    corrected = 'I' + digits;
                    result.corrections.push('Changed first character: 1 → I');
                    result.confidence = 'medium';
                    modified = true;
                }

                // O/0 confusion
                if (char === '0') {
                    corrected = 'O' + digits;
                    result.corrections.push('Changed first character: 0 → O');
                    result.confidence = 'medium';
                    modified = true;
                }
            }

            if (modified) {
                result.reasoning.push('Applied general OCR confusion corrections');
            }
        }

        result.corrected = corrected;
        return result;
    }

    /**
     * Validate and suggest corrections based on multiple sources
     */
    static validateWithContext(
        ocrNumber: string,
        mrzNumber?: string,
        manualNumber?: string,
        nationality?: string
    ): CorrectionResult {
        // Start with basic correction
        const result = this.correctPassportNumber(ocrNumber, nationality);

        // If we have MRZ number, use it as reference
        if (mrzNumber && mrzNumber !== 'NONE') {
            const cleanMrz = mrzNumber.replace(/</g, '').trim();

            if (cleanMrz && cleanMrz !== result.corrected) {
                result.reasoning.push(`MRZ number differs: "${cleanMrz}" vs corrected "${result.corrected}"`);

                // MRZ is more reliable - use it
                result.corrected = cleanMrz;
                result.corrections.push(`Used MRZ number instead: ${cleanMrz}`);
                result.confidence = 'high';
            }
        }

        // If we have manual entry, compare
        if (manualNumber && manualNumber !== 'NONE') {
            if (manualNumber !== result.corrected) {
                result.reasoning.push(`Manual entry differs: "${manualNumber}" vs corrected "${result.corrected}"`);

                // Check if it's just a J/U difference
                if (manualNumber.substring(1) === result.corrected.substring(1)) {
                    const manualFirst = manualNumber[0];
                    const correctedFirst = result.corrected[0];
                    result.reasoning.push(`Only first character differs: ${correctedFirst} vs ${manualFirst}`);

                    // Trust manual entry for first character
                    result.corrected = manualNumber;
                    result.corrections.push(`Used manual entry for first character: ${manualFirst}`);
                    result.confidence = 'high';
                }
            }
        }

        return result;
    }
}
