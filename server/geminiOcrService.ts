import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExtractedCrewData } from './groqOcrService';

export class GeminiOCRService {
    private genAI: GoogleGenerativeAI | null = null;

    private getClient(): GoogleGenerativeAI {
        if (!this.genAI) {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error('GEMINI_API_KEY is not set');
            }
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
        return this.genAI;
    }

    isAvailable(): boolean {
        const key = process.env.GEMINI_API_KEY;
        return !!key && key.length > 10;
    }

    async extractCrewDataFromDocument(base64Data: string, filename?: string, expectedType?: string): Promise<ExtractedCrewData> {
        try {
            console.log('Starting Gemini OCR extraction for file:', filename);

            const genAI = this.getClient();

            // Use gemini-1.5-pro for PASSPORT/CDC/COC (high precision needed), flash for medical/others
            const isHighPrecisionDoc = expectedType && ['passport', 'cdc', 'coc'].some(t => expectedType.toLowerCase().includes(t));
            const modelName = isHighPrecisionDoc ? "gemini-1.5-pro-latest" : "gemini-1.5-flash-latest";

            console.log(`[OCR-GEMINI] Using model: ${modelName} for ${expectedType}`);
            const model = genAI.getGenerativeModel({ model: modelName });

            let typeSpecificPrompt = "";
            if (expectedType) {
                const type = expectedType.toLowerCase();
                if (type === 'passport') {
                    typeSpecificPrompt = `
CRITICAL: This document is a PASSPORT. Follow these steps IN ORDER:

**STEP 1 - MANDATORY: EXTRACT MRZ LINES (Machine Readable Zone)**
   ⚠️  THIS IS THE MOST IMPORTANT STEP - DO NOT SKIP! ⚠️
   - Look at the BOTTOM of the passport for 2 lines of machine-readable text
   - These lines contain <<< symbols and use a special OCR font
   - Extract BOTH lines EXACTLY as shown (44 characters each):
     * Line 1: Starts with 'P<' (example: P<INDKUMAR<<UPENDRA<<<<<<<<<<<<<<<<<<<<<<<<)
     * Line 2: Contains passport data (example: U2701560<2IND7309066M3012025<<<<<<<<<<<<<<<8)
   - PRESERVE ALL CHARACTERS including '<' symbols
   - Store in "mrzLine1" and "mrzLine2" fields
   - ⚠️  If you cannot find MRZ lines, validation will FAIL!

**STEP 2: PASSPORT NUMBER (TOP RIGHT CORNER)**
   - Look in the TOP RIGHT area (labeled "Passport No." or similar)
   - Common formats: Letter+7digits (J2701560), 2Letters+7digits, all digits
   - PAY ATTENTION to confusions: J vs I, U vs V, 0 vs O, 1 vs I
   - Store in "passportNo" field

**STEP 3: DATES (CRITICAL - DO NOT CONFUSE)**
   - Date of Expiry: Look for labels like "Date of expiry", "Date d'expiration", "Expiry Date", or "समाप्ति की तिथि".
   - Date of Issue: Look for labels like "Date of issue", "Date de délivrance", "Issue Date", or "जारी करने की तिथि".
   - ⚠️  INDIAN PASSPORT LAYOUT HINT: Date of birth is usually at the TOP or LEFT of the date section. Date of Expiry is usually below or to the RIGHT.
   - ⚠️  CRITICAL: Do NOT confuse "Date of Birth" (DOB) with "Date of Expiry".
   - ⚠️  MRZ CHECK: The 7 characters in MRZ Line 2 (positions 9-14) MUST match the Date of Expiry. Use this to cross-verify.
   - Place of Issue: Extracted from the field labeled "Place of issue" or near the passport number.

**STEP 4: HOLDER NAME (CRITICAL - READ CAREFULLY)**
   - Passports have TWO separate name fields:
     * "Given Name(s)" or "Prénoms" - This is the FIRST NAME (e.g., "VINEET", "JOHN", "MARY")
     * "Surname" or "Nom" - This is the LAST NAME/FAMILY NAME
   - IMPORTANT: Look for the field LABELED "Given Name" or "Given Name(s)" or similar
   - DO NOT extract text from address fields, place of birth, or location fields
   - DO NOT include words like: BIHAR, ROHTAS, PATNA, DISTRICT, STATE, CITY names
   - Combine Given Name + Surname to create the full holder name
   - Example: If Given Name = "VINEET" and Surname = "KUMAR", then detectedHolderName = "VINEET KUMAR"
   - Store the FULL NAME (Given Name + Surname) in "detectedHolderName" field
`;
                } else if (type === 'cdc') {
                    typeSpecificPrompt = "\nCRITICAL: This document is a CDC (Continuous Discharge Certificate). Extract the 'CDC No.', 'Place of Issue', 'Date of Issue', and 'Date of Expiry'. Also extract the person's name as 'detectedHolderName'. Dates are often in DD-MM-YYYY or DD MMM YYYY format.\n⚠️ IMPORTANT: CDC documents do NOT have a Date of Birth field. Only extract Issue Date and Expiry Date. Leave 'dob' as null.";
                } else if (type === 'medical') {
                    typeSpecificPrompt = "\nCRITICAL: This document is a MEDICAL CERTIFICATE. \n⚠️ IMPORTANT: Dates and detail can often be on the SECOND or subsequent pages. Please search ALL pages for 'Date of Medical Examination' and 'Expiry Date'.\nExtract the 'Issuing Authority' (e.g., Balaji Medical Centre), 'Approval No', 'Issue Date', and 'Expiry Date'. Ensure all dates are found precisely. Dates can be DD/MM/YYYY or DD-MM-YYYY.\nMedical certificates do NOT have a Date of Birth field. Only extract Issue Date and Expiry Date. Leave 'dob' as null.";
                } else if (type.includes('coc')) {
                    typeSpecificPrompt = "\nCRITICAL: This document is a COC (Certificate of Competency). \n⚠️ IMPORTANT: Search ALL pages for certificates. Extract the 'COC Grade/Number', 'Place of Issue', 'Date of Issue', and 'Date of Expiry'. Also extract the person's name as 'detectedHolderName'.\n⚠️ IMPORTANT: COC documents do NOT have a Date of Birth field. Only extract Issue Date and Expiry Date. Leave 'dob' as null.";
                }
            }

            const prompt = `You are an expert at extracting structured data from maritime contract documents.${typeSpecificPrompt}

Analyze this document image and extract the following seafarer details with 100% CHARACTER-LEVEL PRECISION. 

CRITICAL ACCURACY REQUIREMENTS:
1. For Passport Numbers: Read each character CAREFULLY. Common mistakes to avoid:
   - Confusing 'J' with 'I' or '1'
   - Confusing 'U' with 'V'  
   - Confusing '0' (zero) with 'O' (letter O)
   - Confusing '5' with 'S'
2. For MRZ Lines: Extract EXACTLY 44 characters per line, including all '<' filler characters
3. For Dates: Extract in the exact format shown (DD-MM-YYYY, DD MMM YYYY, or DD/MM/YYYY)

EXTRACTION PRIORITY:
1. Document Number (Passport/CDC/COC) - HIGHEST PRIORITY
2. Issue Date and Expiry Date - CRITICAL
3. MRZ Lines (for passports) - IMPORTANT for validation
4. Holder Name - IMPORTANT
5. Other fields - STANDARD

Return ONLY a valid JSON object with these exact keys (use "NONE" or null for any field not found):
{
  "seafarerName": "full name of seafarer (STRICT: exclude village, district, state, or city names)",
  "rank": "rank or capacity",
  "nationality": "seafarer's nationality",
  "dob": "date of birth (ONLY for PASSPORTS - leave as null for CDC/COC/Medical documents)",
  "indosNo": "INDoS identification number",
  "postalAddress": "full address",
  "email": "email address",
  "mobile": "mobile number",
  "cdcNo": "EXTRACT THIS CAREFULLY - The CDC / Seaman Book Number",
  "cdcPlace": "place of issue of CDC",
  "cdcIssueDate": "date of issue of CDC",
  "cdcExpiryDate": "date of expiry of CDC",
  "passportNo": "EXTRACT THIS CAREFULLY - The Passport Number",
  "passportPlace": "place of issue of passport",
  "passportIssueDate": "date of issue of passport",
  "passportExpiryDate": "date of expiry of passport",
  "nokName": "Next of Kin name",
  "nokRelationship": "relationship",
  "nokEmail": "nok email",
  "nokPhone": "nok telephone",
  "nokAddress": "nok postal address",
  "cocGrade": "COC Grade and Number",
  "cocPlace": "COC place of issue",
  "cocIssueDate": "COC date of issue",
  "cocExpiryDate": "COC date of expiry",
  "medicalAuthority": "Medical issuing authority",
  "medicalApprovalNo": "Medical approval number",
  "medicalIssueDate": "Medical date of issue",
  "medicalExpiryDate": "Medical date of expiry",
  "shipName": "extracted ship name or null",
  "detectedDocumentType": "one of: passport, cdc, coc, medical, or other",
  "detectedHolderName": "The FULL NAME combining Given Name + Surname (NEVER include address/location data)",
  "firstName": "For PASSPORTS: Extract the Given Name field ONLY (e.g., VINEET, JOHN, MARY)",
  "lastName": "For PASSPORTS: Extract the Surname field ONLY (e.g., KUMAR, SMITH, JONES)",
  "mrzLine1": "The first line of the Machine Readable Zone (MRZ) - usually 44 chars for passports",
  "mrzLine2": "The second line of the Machine Readable Zone (MRZ) - usually 44 chars for passports"
}

Strict Constraint: Do NOT include location data like "BIHAR", "ROHTAS", "PATNA", "MAHARASHTRA", "DISTRICT", etc. in name fields.
Dates Tip: Dates can be in formats like DD-MM-YYYY, DD MMM YYYY, or DD/MM/YYYY. Extract them as seen.

Important: Return ONLY the JSON object, no additional text or explanation.`;

            // Detect MIME type
            const isPDF = base64Data.startsWith('JVBERi') || filename?.toLowerCase().endsWith('.pdf');
            const mimeType = isPDF ? "application/pdf" : "image/jpeg";

            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                }
            ]);

            const response = await result.response;
            let text = response.text();

            console.log('--- GEMINI RAW RESPONSE ---');
            console.log(text);
            console.log('---------------------------');

            // Robust JSON extraction
            let jsonStr = text;

            // 1. Try to find content between { and }
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonStr = text.substring(firstBrace, lastBrace + 1);
            } else {
                // 2. Fallback regex
                const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (jsonMatch) {
                    jsonStr = jsonMatch[1].trim();
                }
            }

            let parsed;
            try {
                parsed = JSON.parse(jsonStr);
            } catch (pErr) {
                console.error('[OCR-GEMINI] JSON Parse Error. Raw string:', jsonStr);
                throw new Error('Failed to parse Gemini JSON response');
            }

            // Map to ExtractedCrewData interface
            const extractedData: ExtractedCrewData = {
                seafarerName: parsed.seafarerName || undefined,
                capacityRankEmployed: (parsed.rank || parsed.capacityRankEmployed) || undefined,
                seafarerNationality: (parsed.nationality || parsed.seafarerNationality) || undefined,
                seafarerDatePlaceOfBirth: (parsed.dob || parsed.seafarerDatePlaceOfBirth) || undefined,
                seafarerIndosNumber: (parsed.indosNo || parsed.seafarerIndosNumber) || undefined,
                seafarerPostalAddress: (parsed.postalAddress || parsed.seafarerPostalAddress) || undefined,
                seafarerEmail: (parsed.email || parsed.seafarerEmail) || undefined,
                seafarerMobile: (parsed.mobile || parsed.seafarerMobile) || undefined,

                cdcNumber: (parsed.cdcNo || parsed.cdcNumber) || undefined,
                cdcPlaceOfIssue: (parsed.cdcPlace || parsed.cdcPlaceOfIssue) || undefined,
                cdcIssueDate: (parsed.cdcIssueDate || parsed.cdcIssueDate) || undefined,
                cdcExpiryDate: (parsed.cdcExpiryDate || parsed.cdcExpiryDate) || undefined,

                passportNumber: (parsed.passportNo || parsed.passportNumber) || undefined,
                passportPlaceOfIssue: (parsed.passportPlace || parsed.passportPlaceOfIssue) || undefined,
                passportIssueDate: (parsed.passportIssueDate || parsed.issueDate || parsed.passportIssueData) || undefined,
                passportExpiryDate: (parsed.passportExpiryDate || parsed.expiryDate || parsed.passportExpiryData) || undefined,

                nokName: parsed.nokName || undefined,
                nokRelationship: (parsed.nokRelationship || parsed.relationship) || undefined,
                nokEmail: parsed.nokEmail || undefined,
                nokTelephone: (parsed.nokPhone || parsed.nokTelephone || parsed.telephone) || undefined,
                nokPostalAddress: (parsed.nokAddress || parsed.nokPostalAddress) || undefined,

                cocGradeNo: (parsed.cocGrade || parsed.cocGradeNo || parsed.cocNumber) || undefined,
                cocPlaceOfIssue: (parsed.cocPlace || parsed.cocPlaceOfIssue) || undefined,
                cocIssueDate: (parsed.cocIssueDate || parsed.cocIssueDate) || undefined,
                cocExpiryDate: (parsed.cocExpiryDate || parsed.cocExpiryDate) || undefined,

                medicalIssuingAuthority: (parsed.medicalAuthority || parsed.medicalIssuingAuthority || parsed.issuingAuthority) || undefined,
                medicalApprovalNo: (parsed.medicalApprovalNo || parsed.approvalNo || parsed.medicalApprovalNo) || undefined,
                medicalIssueDate: (parsed.medicalIssueDate || parsed.medicalIssueDate || parsed.issueDate) || undefined,
                medicalExpiryDate: (parsed.medicalExpiryDate || parsed.medicalExpiryDate || parsed.expiryDate) || undefined,

                shipName: parsed.shipName || undefined,
                detectedDocumentType: parsed.detectedDocumentType || undefined,
                detectedHolderName: parsed.detectedHolderName || undefined,
                firstName: parsed.firstName || undefined,
                lastName: parsed.lastName || undefined,
                mrzLine1: parsed.mrzLine1 || undefined,
                mrzLine2: parsed.mrzLine2 || undefined,
                rawText: text
            };

            console.log('Extracted data from Gemini:', extractedData);
            return extractedData;

        } catch (error) {
            console.error('Gemini OCR error:', error);
            throw new Error(`Gemini processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export const geminiOcrService = new GeminiOCRService();
