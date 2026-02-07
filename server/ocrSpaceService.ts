import { ExtractedCrewData } from './localOcrService';

export class OCRSpaceService {
    private apiKey: string;
    private apiUrl = 'https://api.ocr.space/parse/image';

    constructor() {
        this.apiKey = process.env.OCR_SPACE_API_KEY || '';
    }

    isAvailable(): boolean {
        return !!this.apiKey;
    }

    async extractCrewDataFromDocument(
        base64Data: string,
        filename?: string,
        documentType?: string
    ): Promise<ExtractedCrewData> {
        try {
            console.log('[OCR.space] Starting OCR extraction for:', filename);
            console.log('[OCR.space] Document type:', documentType);

            // Prepare the request
            const formData = new FormData();

            // Convert base64 to blob for FormData
            const base64Response = await fetch(`data:application/pdf;base64,${base64Data}`);
            const blob = await base64Response.blob();

            formData.append('file', blob, filename || 'document.pdf');
            formData.append('apikey', this.apiKey);
            formData.append('language', 'eng');
            formData.append('isOverlayRequired', 'false');
            formData.append('detectOrientation', 'true');
            formData.append('scale', 'true');
            formData.append('OCREngine', '2'); // OCR Engine 2 is better for documents

            // Make API request
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`OCR.space API error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.IsErroredOnProcessing) {
                throw new Error(`OCR.space processing error: ${result.ErrorMessage || 'Unknown error'}`);
            }

            if (!result.ParsedResults || result.ParsedResults.length === 0) {
                throw new Error('No text extracted from document');
            }

            // Extract text from all pages
            const extractedText = result.ParsedResults
                .map((page: any) => page.ParsedText)
                .join('\n\n');

            console.log('[OCR.space] Extracted text length:', extractedText.length);
            console.log('[OCR.space] Confidence:', result.ParsedResults[0]?.FileParseExitCode);

            // Parse the extracted text based on document type
            const crewData = this.parseCrewInformation(extractedText, documentType);
            crewData.rawText = extractedText;

            return crewData;
        } catch (error) {
            console.error('[OCR.space] Extraction error:', error);
            throw new Error(`OCR.space processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private parseCrewInformation(text: string, documentType?: string): ExtractedCrewData {
        const data: ExtractedCrewData = {};

        // Normalize text
        const normalizedText = text.replace(/\s+/g, ' ').trim();

        switch (documentType) {
            case 'passport':
                return this.parsePassport(normalizedText);
            case 'cdc':
                return this.parseCDC(normalizedText);
            case 'coc':
                return this.parseCOC(normalizedText);
            case 'medical':
                return this.parseMedical(normalizedText);
            default:
                return this.parseGenericDocument(normalizedText);
        }
    }

    private parsePassport(text: string): ExtractedCrewData {
        const data: ExtractedCrewData = {};

        // Passport number patterns
        const passportPatterns = [
            /(?:Passport\s*(?:No|Number|#)?[:\s]*)?([A-Z]{1,2}\d{7,9})/i,
            /\b([A-Z]\d{7,8})\b/,
            /\b([A-Z]{2}\d{7})\b/
        ];

        for (const pattern of passportPatterns) {
            const match = text.match(pattern);
            if (match) {
                data.passportNumber = match[1].toUpperCase();
                break;
            }
        }

        // 1. IMPROVED DATE EXTRACTION WITH CONTEXT
        const findDateWithContext = (keywords: string[]): string | null => {
            const lines = text.split('\n');
            for (const line of lines) {
                const lowerLine = line.toLowerCase();
                if (keywords.some(k => lowerLine.includes(k))) {
                    const dateMatch = line.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/) ||
                        line.match(/(\d{2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})/i);
                    if (dateMatch) return dateMatch[0];
                }
            }
            return null;
        };

        const issueDate = findDateWithContext(['issue', 'issued', 'date of issue']);
        const expiryDate = findDateWithContext(['expiry', 'expires', 'valid until', 'date of expiry']);
        const birthDate = findDateWithContext(['birth', 'born', 'date of birth']);

        if (issueDate) {
            const iss = new Date(issueDate);
            if (!isNaN(iss.getTime()) && iss.getFullYear() >= 2000) {
                data.passportIssueDate = issueDate;
            } else {
                console.log(`[OCR.space] Discarding suspicious issue date (likely DOB): ${issueDate}`);
            }
        }

        // Expiry date must be in the future (or at least recent)
        if (expiryDate) {
            const exp = new Date(expiryDate);
            const currentYear = new Date().getFullYear();
            if (!isNaN(exp.getTime()) && exp.getFullYear() > currentYear - 5) {
                data.passportExpiryDate = expiryDate;
            } else {
                console.log(`[OCR.space] Discarding suspicious expiry date found via context: ${expiryDate}`);
            }
        }

        if (birthDate) data.dateOfBirth = birthDate;

        // 2. FALLBACK: Filter dates if context search didn't find everything
        if (!data.passportIssueDate || !data.passportExpiryDate) {
            const datePatterns = [
                /(\d{2})[\/-](\d{2})[\/-](\d{4})/g,
                /(\d{2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})/gi
            ];

            const allDates: string[] = [];
            for (const pattern of datePatterns) {
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    allDates.push(match[0]);
                }
            }

            // Exclude DOB if found
            const candidateDates = allDates.filter(d => d !== data.dateOfBirth);

            // Filter dates: usually issue/expiry are the latest ones
            const recentDates = candidateDates.filter(dateStr => {
                const yearMatch = dateStr.match(/(\d{4})/);
                if (yearMatch) {
                    const year = parseInt(yearMatch[1]);
                    return year >= 2000;
                }
                return false;
            });

            // Sort dates chronologically
            recentDates.sort((a, b) => {
                const getYear = (s: string) => {
                    const m = s.match(/(\d{4})/);
                    return m ? parseInt(m[1]) : 0;
                };
                return getYear(a) - getYear(b);
            });

            if (!data.passportIssueDate && recentDates.length >= 2) {
                data.passportIssueDate = recentDates[0];
            }
            if (!data.passportExpiryDate && recentDates.length > 0) {
                data.passportExpiryDate = recentDates[recentDates.length - 1];
            }
        }

        // Name extraction (usually after "Name" or "Surname")
        const nameMatch = text.match(/(?:Name|Surname)[:\s]+([A-Z\s]+?)(?:\n|Date|Sex|Nationality)/i);
        if (nameMatch) {
            data.name = nameMatch[1].trim();
        }

        return data;
    }

    private parseCDC(text: string): ExtractedCrewData {
        const data: ExtractedCrewData = {};

        // CDC number patterns
        const cdcPatterns = [
            /(?:CDC\s*(?:No|Number)?[:\s]*)?([A-Z]{3}\s*\d{6})/i,
            /\b([A-Z]{3}\d{6})\b/,
            /\b([A-Z]{3}\s+\d{6})\b/
        ];

        for (const pattern of cdcPatterns) {
            const match = text.match(pattern);
            if (match) {
                data.cdcNumber = match[1].replace(/\s+/g, ' ').toUpperCase();
                break;
            }
        }

        // 1. IMPROVED DATE EXTRACTION WITH CONTEXT
        const findDateWithContext = (keywords: string[]): string | null => {
            const lines = text.split('\n');
            for (const line of lines) {
                const lowerLine = line.toLowerCase();
                if (keywords.some(k => lowerLine.includes(k))) {
                    const dateMatch = line.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/) ||
                        line.match(/(\d{2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})/i);
                    if (dateMatch) return dateMatch[0];
                }
            }
            return null;
        };

        const issueDate = findDateWithContext(['issue', 'issued', 'date of issue']);
        const expiryDate = findDateWithContext(['expiry', 'expires', 'valid until', 'date of expiry']);
        const birthDate = findDateWithContext(['birth', 'born', 'date of birth']);

        if (issueDate) data.cdcIssueDate = issueDate;
        if (expiryDate) data.cdcExpiryDate = expiryDate;
        if (birthDate) data.dateOfBirth = birthDate;

        // 2. FALLBACK: Filter dates if context search didn't find everything
        if (!data.cdcIssueDate || !data.cdcExpiryDate) {
            const datePatterns = [
                /(\d{2})[\/-](\d{2})[\/-](\d{4})/g,
                /(\d{2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})/gi
            ];

            const allDates: string[] = [];
            for (const pattern of datePatterns) {
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    allDates.push(match[0]);
                }
            }

            // Exclude DOB if found
            const candidateDates = allDates.filter(d => d !== data.dateOfBirth);

            // Filter dates: only keep dates from year 2000 onwards (issue/expiry dates)
            const recentDates = candidateDates.filter(dateStr => {
                const yearMatch = dateStr.match(/(\d{4})/);
                if (yearMatch) {
                    const year = parseInt(yearMatch[1]);
                    return year >= 2000;
                }
                return false;
            });

            // Sort dates chronologically to differentiate Issue and Expiry
            recentDates.sort((a, b) => {
                const getYear = (s: string) => {
                    const m = s.match(/(\d{4})/);
                    return m ? parseInt(m[1]) : 0;
                };
                return getYear(a) - getYear(b);
            });

            console.log('[OCR.space CDC] Fallback dates found:', recentDates);

            if (!data.cdcIssueDate && recentDates.length >= 2) {
                data.cdcIssueDate = recentDates[0];
            }
            if (!data.cdcExpiryDate && recentDates.length > 0) {
                data.cdcExpiryDate = recentDates[recentDates.length - 1]; // Latest date is likely expiry
            }
        }

        // Place of issue
        const placeMatch = text.match(/(?:Place|Issued at)[:\s]+([A-Z\s]+?)(?:\n|Date)/i);
        if (placeMatch) {
            data.cdcPlaceOfIssue = placeMatch[1].trim();
        }

        return data;
    }

    private parseCOC(text: string): ExtractedCrewData {
        const data: ExtractedCrewData = {};

        // COC number patterns
        const cocPatterns = [
            /(?:Certificate\s*(?:No|Number)?[:\s]*)?([A-Z0-9\/\-]+)/i,
            /\b([A-Z]{2,}\d{4,})\b/
        ];

        for (const pattern of cocPatterns) {
            const match = text.match(pattern);
            if (match && match[1].length > 5) {
                data.cocGradeNo = match[1].toUpperCase();
                break;
            }
        }

        // Grade/Rank extraction - store in capacity field
        const gradeMatch = text.match(/(?:Grade|Rank|Capacity)[:\s]+([A-Z\s\(\)\/]+?)(?:\n|Certificate)/i);
        if (gradeMatch) {
            data.capacityRankEmployed = gradeMatch[1].trim();
        }

        // Date extraction
        const findDateWithContext = (keywords: string[]): string | null => {
            const lines = text.split('\n');
            for (const line of lines) {
                const lowerLine = line.toLowerCase();
                if (keywords.some(k => lowerLine.includes(k))) {
                    const dateMatch = line.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/) ||
                        line.match(/(\d{2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})/i);
                    if (dateMatch) return dateMatch[0];
                }
            }
            return null;
        };

        const issueDate = findDateWithContext(['issue', 'issued', 'date of issue']);
        const expiryDate = findDateWithContext(['expiry', 'expires', 'valid until', 'date of expiry']);

        if (issueDate) data.cocIssueDate = issueDate;
        if (expiryDate) data.cocExpiryDate = expiryDate;

        if (!data.cocIssueDate || !data.cocExpiryDate) {
            const datePattern = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g;
            const allDates: string[] = [];
            let match;
            while ((match = datePattern.exec(text)) !== null) {
                allDates.push(match[0]);
            }

            const recentDates = allDates.filter(d => {
                const yr = d.match(/(\d{4})/);
                return yr ? parseInt(yr[1]) >= 2000 : false;
            }).sort((a, b) => {
                const getYear = (s: string) => {
                    const m = s.match(/(\d{4})/);
                    return m ? parseInt(m[1]) : 0;
                };
                return getYear(a) - getYear(b);
            });

            if (!data.cocIssueDate && recentDates.length >= 2) data.cocIssueDate = recentDates[0];
            if (!data.cocExpiryDate && recentDates.length > 0) data.cocExpiryDate = recentDates[recentDates.length - 1];
        }

        return data;
    }

    private parseMedical(text: string): ExtractedCrewData {
        const data: ExtractedCrewData = {};

        // Medical certificate number
        const medicalMatch = text.match(/(?:Certificate\s*(?:No|Number)?[:\s]*)?([A-Z0-9\/\-]+)/i);
        if (medicalMatch) {
            data.medicalApprovalNo = medicalMatch[1].toUpperCase();
        }

        // Date extraction
        const findDateWithContext = (keywords: string[]): string | null => {
            const lines = text.split('\n');
            for (const line of lines) {
                const lowerLine = line.toLowerCase();
                if (keywords.some(k => lowerLine.includes(k))) {
                    const dateMatch = line.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/) ||
                        line.match(/(\d{2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})/i);
                    if (dateMatch) return dateMatch[0];
                }
            }
            return null;
        };

        const issueDate = findDateWithContext(['issue', 'issued', 'date of issue', 'examination']);
        const expiryDate = findDateWithContext(['expiry', 'expires', 'valid until', 'date of expiry']);

        if (issueDate) data.medicalIssueDate = issueDate;
        if (expiryDate) data.medicalExpiryDate = expiryDate;

        if (!data.medicalIssueDate || !data.medicalExpiryDate) {
            const datePattern = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g;
            const allDates: string[] = [];
            let match;
            while ((match = datePattern.exec(text)) !== null) {
                allDates.push(match[0]);
            }

            const recentDates = allDates.filter(d => {
                const yr = d.match(/(\d{4})/);
                return yr ? parseInt(yr[1]) >= 2000 : false;
            }).sort((a, b) => {
                const getYear = (s: string) => {
                    const m = s.match(/(\d{4})/);
                    return m ? parseInt(m[1]) : 0;
                };
                return getYear(a) - getYear(b);
            });

            if (!data.medicalIssueDate && recentDates.length >= 2) data.medicalIssueDate = recentDates[0];
            if (!data.medicalExpiryDate && recentDates.length > 0) data.medicalExpiryDate = recentDates[recentDates.length - 1];
        }

        return data;
    }

    private parseGenericDocument(text: string): ExtractedCrewData {
        const data: ExtractedCrewData = {};

        // Extract any dates found
        const datePattern = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g;
        const dates: string[] = [];
        let match;
        while ((match = datePattern.exec(text)) !== null) {
            dates.push(match[0]);
        }

        if (dates.length > 0) {
            data.passportIssueDate = dates[0];
            if (dates.length > 1) {
                data.passportExpiryDate = dates[1];
            }
        }

        return data;
    }
}

export const ocrSpaceService = new OCRSpaceService();
