
function parseRobustDate(dateStr: string): Date | null {
    if (!dateStr || dateStr === 'NONE') return null;

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
                return testDate;
            }
        }
    }

    return null;
}

function dateMatch(date1: string | null | undefined, date2: string | null | undefined): boolean {
    if (!date1 || !date2) return false;

    const d1 = parseRobustDate(date1);
    const d2 = parseRobustDate(date2);

    if (!d1 || !d2) {
        console.log(`Parse failed: d1=${d1}, d2=${d2}`);
        return false;
    }

    console.log(`Comparing: ${d1.toISOString()} vs ${d2.toISOString()}`);

    const matches = (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );

    return matches;
}

// Test Cases
const existingISO = "2027-07-03T00:00:00.000Z"; // From DB/Frontend
const ocrString1 = "03-07-2027"; // DD-MM-YYYY
const ocrString2 = "03 JUL 2027"; // DD-MMM-YYYY
const ocrString3 = "2027-07-03"; // YYYY-MM-DD
const mismatchedDate = "2028-01-01T00:00:00.000Z"; // User changed it
const invalidDate = "invalid-date";

console.log("1. ISO vs DD-MM-YYYY: ", dateMatch(existingISO, ocrString1)); // Should be true
console.log("2. ISO vs DD-MMM-YYYY: ", dateMatch(existingISO, ocrString2)); // Should be true
console.log("3. ISO vs YYYY-MM-DD: ", dateMatch(existingISO, ocrString3)); // Should be true
console.log("4. ISO vs Mismatched: ", dateMatch(mismatchedDate, ocrString1)); // Should be FALSE
console.log("5. ISO vs Invalid: ", dateMatch(existingISO, invalidDate)); // Should be FALSE
console.log("6. ISO vs Null: ", dateMatch(existingISO, null)); // Should be FALSE
