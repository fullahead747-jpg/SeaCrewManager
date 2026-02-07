/**
 * Name Matcher Utility
 * Provides fuzzy name matching capabilities for document owner validation
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits required to change one string into another
 */
function levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create a 2D array for dynamic programming
    const matrix: number[][] = Array(len1 + 1)
        .fill(null)
        .map(() => Array(len2 + 1).fill(0));

    // Initialize first column and row
    for (let i = 0; i <= len1; i++) {
        matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[len1][len2];
}

/**
 * Normalize a name for comparison
 * - Converts to uppercase
 * - Removes extra whitespace
 * - Removes special characters (except spaces)
 * - Handles common name variations
 */
export function normalizeNameForComparison(name: string): string {
    if (!name) return '';

    return name
        .toUpperCase()
        .trim()
        // Remove special characters but keep spaces
        .replace(/[^A-Z\s]/g, '')
        // Replace multiple spaces with single space
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculate similarity percentage between two names
 * Returns a score from 0-100 where 100 is an exact match
 * 
 * Uses Levenshtein distance normalized by the length of the longer string
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;

    const normalized1 = normalizeNameForComparison(name1);
    const normalized2 = normalizeNameForComparison(name2);

    // Exact match after normalization
    if (normalized1 === normalized2) return 100;

    const distance = levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);

    if (maxLength === 0) return 0;

    // Calculate similarity as percentage
    const similarity = ((maxLength - distance) / maxLength) * 100;

    return Math.round(similarity);
}

/**
 * Try different name format permutations to find best match
 * Handles cases like "John Smith" vs "Smith John" or "Smith, John"
 */
export function calculateBestNameMatch(name1: string, name2: string): {
    similarity: number;
    format: string;
} {
    const normalized1 = normalizeNameForComparison(name1);
    const normalized2 = normalizeNameForComparison(name2);

    // Direct comparison
    const directSimilarity = calculateNameSimilarity(normalized1, normalized2);
    console.log(`[NAME-MATCHER] Comparing: "${normalized1}" vs "${normalized2}"`);
    console.log(`   - Direct Similarity: ${directSimilarity}%`);

    // Try reversing name parts (First Last -> Last First)
    const parts1 = normalized1.split(' ');
    const parts2 = normalized2.split(' ');

    let bestSimilarity = directSimilarity;
    let bestFormat = 'direct';

    // If both names have multiple parts, try reversing
    if (parts1.length >= 2 && parts2.length >= 2) {
        // Reverse first name parts (as a new copy)
        const reversed1 = [...parts1].reverse().join(' ');
        const reversedSimilarity = calculateNameSimilarity(reversed1, normalized2);
        console.log(`   - Reversed Similarity: ${reversedSimilarity}%`);

        if (reversedSimilarity > bestSimilarity) {
            bestSimilarity = reversedSimilarity;
            bestFormat = 'reversed';
        }
    }

    // Try comparing just last names (most significant part)
    if (parts1.length >= 2 && parts2.length >= 2) {
        // Use parts1 (not reversed copy)
        const lastName1 = parts1[parts1.length - 1];
        const lastName2 = parts2[parts2.length - 1];
        const lastNameSimilarity = calculateNameSimilarity(lastName1, lastName2);
        console.log(`   - Last Name Similarity: ${lastNameSimilarity}% ("${lastName1}" vs "${lastName2}")`);

        // If last names match well, boost overall score
        if (lastNameSimilarity >= 90 && bestSimilarity >= 70) {
            console.log(`   - Applying Last Name Boost (+10)`);
            bestSimilarity = Math.min(100, bestSimilarity + 10);
            bestFormat = 'last-name-boost';
        }
    }

    console.log(`[NAME-MATCHER] Best Match: ${bestSimilarity}% (Format: ${bestFormat})`);

    return {
        similarity: bestSimilarity,
        format: bestFormat
    };
}

/**
 * Validate if two names likely belong to the same person
 * Returns validation status based on similarity thresholds
 */
export function validateNameMatch(
    expectedName: string,
    extractedName: string
): {
    isValid: boolean;
    similarity: number;
    status: 'match' | 'warning' | 'mismatch';
    confidence: 'high' | 'medium' | 'low';
} {
    const { similarity } = calculateBestNameMatch(expectedName, extractedName);

    let status: 'match' | 'warning' | 'mismatch';
    let confidence: 'high' | 'medium' | 'low';
    let isValid: boolean;

    if (similarity >= 85) {
        status = 'match';
        confidence = 'high';
        isValid = true;
    } else if (similarity >= 70) {
        status = 'warning';
        confidence = 'medium';
        isValid = false; // Requires manual review
    } else {
        status = 'mismatch';
        confidence = 'low';
        isValid = false;
    }

    return {
        isValid,
        similarity,
        status,
        confidence
    };
}
