import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

export interface ExtractedCrewData {
  name?: string;
  position?: string;
  nationality?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  seamansBookNumber?: string;
  cdcNumber?: string;
  phoneNumber?: string;
  email?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  joinDate?: string;
  leaveDate?: string;
  vessel?: string;
  salary?: string;
  // Ship Owner Details
  shipOwnerName?: string;
  shipOwnerContactPerson?: string;
  shipOwnerPostalAddress?: string;
  // Seafarer Details
  seafarerName?: string;
  capacityRankEmployed?: string;
  seafarerNationality?: string;
  seafarerDatePlaceOfBirth?: string;
  seafarerIndosNumber?: string;
  seafarerPostalAddress?: string;
  seafarerEmail?: string;
  seafarerMobile?: string;
  cdcPlaceOfIssue?: string;
  cdcIssueDate?: string;
  cdcExpiryDate?: string;
  passportPlaceOfIssue?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  nokName?: string;
  nokRelationship?: string;
  nokEmail?: string;
  nokTelephone?: string;
  nokPostalAddress?: string;
  cocGradeNo?: string;
  cocPlaceOfIssue?: string;
  cocIssueDate?: string;
  cocExpiryDate?: string;
  // Medical Certificate Details
  medicalIssuingAuthority?: string;
  medicalApprovalNo?: string;
  medicalIssueDate?: string;
  medicalExpiryDate?: string;
  // Ship Details
  shipName?: string;
  engagementPeriodMonths?: number;
  detectedDocumentType?: string;
  detectedHolderName?: string;
  rawText?: string;
}

export interface ExtractedCrewRecord extends ExtractedCrewData {
  recordId: string;
  displayName: string;
}

export class LocalOCRService {
  private worker: any = null;

  async initializeWorker() {
    if (!this.worker) {
      this.worker = await createWorker('eng', undefined, {
        logger: m => console.log('Tesseract:', m)
      });
      await this.worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 +-/:@.',
        preserve_interword_spaces: '1'
      });
    }
    return this.worker;
  }

  async extractCrewDataFromDocument(base64Data: string, filename?: string, documentType?: string): Promise<ExtractedCrewData> {
    try {
      console.log('Starting OCR extraction for file:', filename);
      console.log('Base64 data length:', base64Data?.length || 0);

      let extractedText = '';

      // Validate input
      if (!base64Data || base64Data.length === 0) {
        throw new Error('No image data provided');
      }

      // Detect file type from base64 data
      const isPDF = base64Data.startsWith('JVBERi') || filename?.toLowerCase().endsWith('.pdf');

      if (isPDF) {
        // Handle PDF files - extract text directly
        console.log('Processing PDF with pdf-parse...');
        extractedText = await this.extractTextFromPDF(base64Data);
      } else {
        // Handle image
        console.log('Processing image with Tesseract...');
        extractedText = await this.extractTextFromImage(base64Data);
      }

      console.log('Extracted raw text:', extractedText);

      // Parse the extracted text to find crew information
      const crewData = this.parseCrewInformation(extractedText, documentType);
      crewData.rawText = extractedText;
      console.log('Parsed crew data:', crewData);

      // Populate identity fields for verification consistency
      crewData.detectedHolderName = crewData.detectedHolderName || crewData.seafarerName || crewData.name;
      crewData.detectedDocumentType = crewData.detectedDocumentType || 'other';

      return crewData;
    } catch (error) {
      console.error('Local OCR extraction error:', error);
      if (error instanceof Error) {
        throw new Error(`OCR processing failed: ${error.message}`);
      }
      throw new Error('Failed to extract data from document. Please try again or enter the information manually.');
    }
  }

  private async extractTextFromPDF(base64Data: string): Promise<string> {
    try {
      const pdfBuffer = Buffer.from(base64Data, 'base64');
      console.log('PDF buffer size:', pdfBuffer.length);

      // Dynamic import to avoid pdf-parse test file loading issue
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData = await pdfParse(pdfBuffer);
      console.log('PDF text extracted, length:', pdfData.text?.length || 0);

      // Check if the extracted text is meaningful
      const extractedText = pdfData.text || '';
      const meaningfulTextThreshold = 50; // Minimum characters for meaningful text

      if (extractedText.trim().length < meaningfulTextThreshold) {
        console.log('Text too short or empty from pdf-parse, returning empty to try other OCR engines');
        // Return empty string to let the multi-engine OCR system try Groq/Gemini
        // This avoids the canvas library issues in production
        return '';
      }

      return extractedText;
    } catch (error) {
      console.error('PDF extraction error:', error);
      // Return empty string to let the multi-engine OCR system try other engines
      // This avoids canvas library issues in production
      console.log('Returning empty text to try other OCR engines (Groq/Gemini)');
      return '';
    }
  }

  private async extractTextFromPDFImages(pdfBuffer: Buffer): Promise<string> {
    try {
      console.log('Converting PDF pages to images for OCR using pdfjs-dist...');

      // Import required modules
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const { createCanvas } = await import('canvas');

      const uint8Array = new Uint8Array(pdfBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdfDocument = await loadingTask.promise;

      console.log(`PDF loaded, total pages: ${pdfDocument.numPages}`);

      let combinedText = '';
      // Process first 2 pages for Medical documents, otherwise just first page
      const pagesToProcess = Math.min(pdfDocument.numPages, 2);

      for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
        try {
          console.log(`Processing page ${pageNum} for image-based OCR...`);
          const page = await pdfDocument.getPage(pageNum);
          const scale = 2.0;
          const viewport = page.getViewport({ scale });

          // Create canvas with proper dimensions
          const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
          const context = canvas.getContext('2d');

          const renderContext = {
            canvasContext: context as any,
            viewport: viewport
          };

          await page.render(renderContext).promise;
          const imageBase64 = canvas.toBuffer('image/png').toString('base64');
          const pageText = await this.extractTextFromImage(imageBase64);
          combinedText += pageText + '\n';
        } catch (pageErr) {
          console.error(`Error processing page ${pageNum}:`, pageErr);
          // Continue to next page rather than failing entire document
        }
      }

      return combinedText;
    } catch (error) {
      console.error('PDF to image conversion error:', error);
      throw new Error(`Failed to convert PDF to images for OCR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractTextFromImage(base64Data: string): Promise<string> {
    try {
      console.log('Initializing Tesseract worker...');
      // Initialize Tesseract worker
      const worker = await this.initializeWorker();

      console.log('Converting base64 to buffer...');
      // Convert base64 to buffer and optimize image for OCR
      const buffer = Buffer.from(base64Data, 'base64');
      console.log('Buffer size:', buffer.length);

      console.log('Optimizing image for OCR...');
      const optimizedBuffer = await sharp(buffer)
        .resize({ width: 1200, height: 1600, fit: 'inside' })
        .grayscale()
        .normalize()
        .sharpen()
        .threshold(128)
        .png()
        .toBuffer();
      console.log('Optimized buffer size:', optimizedBuffer.length);

      console.log('Starting OCR recognition...');
      // Perform OCR
      const { data: { text } } = await worker.recognize(optimizedBuffer);
      console.log('OCR completed, text length:', text?.length || 0);
      return text || '';
    } catch (error) {
      console.error('Image OCR error:', error);
      throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseCrewInformation(text: string, documentType?: string): ExtractedCrewData {
    const result: ExtractedCrewData = {};

    // If text is empty or very short, return empty result
    if (!text || text.trim().length < 10) {
      console.log('Text too short or empty, no meaningful content extracted');
      return {};
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log('Parsing text with', lines.length, 'lines');
    console.log('All lines for debugging:');
    lines.forEach((line, index) => {
      console.log(`${index}: "${line}"`);
    });

    // Parse the specific structure of this maritime contract
    // Look for EMPLOYEE section and extract name
    const employeeIndex = lines.findIndex(line => line.toUpperCase().trim() === 'EMPLOYEE');
    if (employeeIndex >= 0 && employeeIndex < lines.length - 1) {
      console.log('Found EMPLOYEE section at index:', employeeIndex);
      // Look for name in the lines immediately after EMPLOYEE
      for (let i = employeeIndex + 1; i < Math.min(employeeIndex + 8, lines.length); i++) {
        const line = lines[i].trim();
        console.log(`Checking line ${i} for name: "${line}"`);

        // Look for a line that could be a name - typical format is all caps or title case
        if (line.length > 5 && line.length < 60 &&
          !line.toUpperCase().includes('PASSPORT') &&
          !line.toUpperCase().includes('VESSEL') &&
          !line.toUpperCase().includes('OFFICE') &&
          !line.toUpperCase().includes('NO.') &&
          !line.includes('IMO') &&
          !line.includes('CH ') &&
          !line.includes('The said') &&
          // Check if it looks like a name (letters and spaces only, possibly with dots)
          /^[A-Z][A-Za-z\s.]+$/.test(line)) {
          result.name = line;
          console.log('Extracted name from employee section:', line);
          break;
        }
      }
    }

    // Alternative method: Look for names in common patterns
    if (!result.name) {
      console.log('Trying alternative name extraction methods...');

      // Check if the name appears immediately in the text between EMPLOYEE and PASSPORT NO
      const employeeToPassportMatch = text.match(/EMPLOYEE\s*[\r\n]+(.*?)[\r\n]*PASSPORT\s+NO/i);
      if (employeeToPassportMatch && employeeToPassportMatch[1]) {
        const potentialName = employeeToPassportMatch[1].trim();
        console.log('Found potential name between EMPLOYEE and PASSPORT:', potentialName);

        // Clean and validate the name
        if (potentialName.length > 5 && potentialName.length < 80 &&
          !potentialName.toUpperCase().includes('OFFICE') &&
          !potentialName.toUpperCase().includes('LIMITED') &&
          !potentialName.toUpperCase().includes('FLOOR') &&
          /^[A-Z][A-Za-z\s.]+$/.test(potentialName)) {
          result.name = potentialName;
          console.log('Extracted name using EMPLOYEE-PASSPORT pattern:', potentialName);
        }
      }

      // If still no name, try looking for standalone name lines
      if (!result.name) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Look for lines that could be names - 2-4 words, all caps or title case
          if (line.length > 8 && line.length < 50 &&
            /^[A-Z][A-Z\s]+$/.test(line) &&
            !line.includes('LIMITED') &&
            !line.includes('PRIVATE') &&
            !line.includes('OFFICE') &&
            !line.includes('PASSPORT') &&
            !line.includes('VESSEL') &&
            !line.includes('CONTRACT') &&
            !line.includes('EMPLOYMENT') &&
            !line.includes('MARINE') &&
            !line.includes('OFFSHORE') &&
            !line.includes('BELAPUR') &&
            !line.includes('MUMBAI') &&
            !line.includes('OWNER') &&
            !line.includes('EMPLOVER') &&
            // Should be 2-4 words (typical name structure)
            line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 4) {
            result.name = line;
            console.log('Found potential name as standalone line:', line);
            break;
          }
        }
      }
    }

    // Extract passport number - look for line with "PASSPORT NO" and number
    const passportLine = lines.find(line =>
      line.toUpperCase().includes('PASSPORT') && line.toUpperCase().includes('NO')
    );
    if (passportLine) {
      // Extract numbers from passport line
      const passportMatch = passportLine.match(/(\d{6,10})/);
      if (passportMatch) {
        result.passportNumber = passportMatch[1];
        console.log('Found passport number:', passportMatch[1]);
      }
    }

    // Extract vessel name - look for line with "VESSEL" and name
    const vesselLine = lines.find(line =>
      line.toUpperCase().includes('VESSEL') && !line.toUpperCase().includes('SUCH VESSEL')
    );
    if (vesselLine) {
      // Extract vessel name between VESSEL and IMO
      const vesselMatch = vesselLine.match(/VESSEL\s+([A-Z0-9\s]+?)(?:\s+IMO|$)/i);
      if (vesselMatch) {
        result.vessel = vesselMatch[1].trim();
        console.log('Found vessel name:', vesselMatch[1].trim());
      }
    }

    // Extract position/rank - look for "rank of" pattern
    const rankText = text.toLowerCase();
    const rankMatch = rankText.match(/employed.*?rank\s+of\s+([a-z\s]+?)(?:\s+on\s+board|\s|$)/i);
    if (rankMatch) {
      result.position = rankMatch[1].trim().toUpperCase();
      console.log('Found position/rank:', rankMatch[1].trim().toUpperCase());
    }

    // Extract salary - look for "BASIC PER MONTH" or similar
    const salaryLine = lines.find(line =>
      line.toUpperCase().includes('BASIC') && line.toUpperCase().includes('MONTH')
    );
    if (salaryLine) {
      const salaryMatch = salaryLine.match(/(\d+[,.]?\d*)/);
      if (salaryMatch) {
        result.salary = salaryMatch[1];
        console.log('Found salary:', salaryMatch[1]);
      }
    }

    // Extract nationality - if available in document
    const nationalityMatch = text.match(/nationality[:\s]*([a-z]+)/i);
    if (nationalityMatch) {
      result.nationality = nationalityMatch[1];
      console.log('Found nationality:', nationalityMatch[1]);
    }

    // Extract date of birth - look for DOB patterns
    const dobPatterns = [
      /date\s+of\s+birth[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /dob[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /born[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /birth[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i
    ];

    for (const pattern of dobPatterns) {
      const dobMatch = text.match(pattern);
      if (dobMatch) {
        const date = dobMatch[1];
        const parts = date.split(/[\/\-]/);
        const year = parseInt(parts[2]);

        // Validate reasonable birth year (1950-2005 for working age)
        if (year >= 1950 && year <= 2005) {
          result.dateOfBirth = date;
          console.log('Found date of birth:', date);
          break;
        }
      }
    }

    // Extract dates - look for realistic date patterns
    const allDates = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/g) || [];
    const validDates = allDates.filter(date => {
      const parts = date.split(/[\/\-]/);
      const year = parseInt(parts[2]);
      const month = parseInt(parts[1]);
      const day = parseInt(parts[0]);

      // Basic date validation
      return year >= 2020 && year <= 2030 &&
        month >= 1 && month <= 12 &&
        day >= 1 && day <= 31;
    });

    if (validDates.length >= 1) {
      const type = documentType?.toLowerCase() || '';

      if (type === 'passport') {
        result.passportIssueDate = validDates[0];
        console.log('Found passport issue date:', validDates[0]);
        if (validDates.length >= 2) {
          result.passportExpiryDate = validDates[1];
          console.log('Found passport expiry date:', validDates[1]);
        }
      } else if (type === 'cdc') {
        result.cdcIssueDate = validDates[0];
        console.log('Found cdc issue date:', validDates[0]);
        if (validDates.length >= 2) {
          result.cdcExpiryDate = validDates[1];
          console.log('Found cdc expiry date:', validDates[1]);
        }
      } else if (type.includes('coc')) {
        // Specific patterns for COC documents
        const cocIssueMatch = text.match(/(?:Date\s+of\s+Issue|Issued\s+on)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
        const cocExpiryMatch = text.match(/(?:Date\s+of\s+Expiry|Expires\s+on|Valid\s+until)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
        const cocNumberMatch = text.match(/(?:COC\s+No|Certificate\s+No)[:\s]*([A-Z0-9]+)/i);

        if (cocIssueMatch) {
          result.cocIssueDate = cocIssueMatch[1];
          console.log('Found coc issue date via label:', result.cocIssueDate);
        } else if (validDates.length >= 1) {
          result.cocIssueDate = validDates[0];
          console.log('Found coc issue date via fallback:', validDates[0]);
        }

        if (cocExpiryMatch) {
          result.cocExpiryDate = cocExpiryMatch[1];
          console.log('Found coc expiry date via label:', result.cocExpiryDate);
        } else if (validDates.length >= 2) {
          result.cocExpiryDate = validDates[1];
          console.log('Found coc expiry date via fallback:', validDates[1]);
        }

        if (cocNumberMatch) {
          result.cocGradeNo = cocNumberMatch[1];
          console.log('Found coc number via label:', result.cocGradeNo);
        }
      } else if (type === 'medical') {
        // Specific patterns for Medical certificates
        const medicalIssueMatch = text.match(/(?:Date\s+&\s+Place\s+of\s+Medical\s+Examination|Date\s+of\s+Examination)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
        const medicalExpiryMatch = text.match(/(?:Certificate\s+expires\s+on|Expiry\s+Date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);

        const medicalApprovalMatch = text.match(/(?:Approval\s+No|Certificate\s+No|Serial\s+number)[:\s]*([A-Z0-9]+)/i);
        const medicalAuthorityMatch = text.match(/(?:Issuing\s+Authority|Official\s+Stamp\s+of\s+the|Medical\s+Centre)[:\s]*([A-Z0-9\s]+(?:Ltd|Limited|Centre|Clinic|Hospital))/i);

        if (medicalIssueMatch) {
          result.medicalIssueDate = medicalIssueMatch[1];
          console.log('Found medical issue date via label:', result.medicalIssueDate);
        } else if (validDates.length >= 1) {
          result.medicalIssueDate = validDates[0];
          console.log('Found medical issue date via fallback:', validDates[0]);
        }

        if (medicalExpiryMatch) {
          result.medicalExpiryDate = medicalExpiryMatch[1];
          console.log('Found medical expiry date via label:', result.medicalExpiryDate);
        } else if (validDates.length >= 2) {
          result.medicalExpiryDate = validDates[1];
          console.log('Found medical expiry date via fallback:', validDates[1]);
        }

        if (medicalApprovalMatch) {
          result.medicalApprovalNo = medicalApprovalMatch[1];
          console.log('Found medical approval no:', result.medicalApprovalNo);
        }

        if (medicalAuthorityMatch) {
          result.medicalIssuingAuthority = medicalAuthorityMatch[1].trim();
          console.log('Found medical issuing authority:', result.medicalIssuingAuthority);
        }
      } else {
        result.contractStartDate = validDates[0];
        console.log('Found contract start date:', validDates[0]);
        if (validDates.length >= 2) {
          result.contractEndDate = validDates[1];
          console.log('Found contract end date:', validDates[1]);
        }
      }
    }

    // Extract CDC number if mentioned
    const seamansCdcMatch = text.match(/cdc[:\s]*([a-z0-9]+)/i);
    if (seamansCdcMatch) {
      result.seamansBookNumber = seamansCdcMatch[1];
      console.log('Found seaman CDC number:', seamansCdcMatch[1]);
    }

    // Extract Ship Owner Details - look for "Details of Ship Owner" section
    // Ship Owner Name - Format: "1. Name: GLOBAL CAMBAYMARINE SERVICES PVT. LTD"
    const shipOwnerNamePatterns = [
      /1\.?\s*Name[:\s]+([A-Z][A-Z\s,.&]+(?:PVT|LTD|LIMITED|PRIVATE|COMPANY|CORP|INC|SERVICES)[A-Z\s,.]*)/i,
      /(?:Details\s+of\s+Ship\s+Owner|Ship\s+Owner)[\s\S]*?Name[:\s]+([A-Z][A-Z\s,.&]+(?:PVT|LTD|LIMITED|PRIVATE|COMPANY|CORP|INC|SERVICES)[A-Z\s,.]*)/i,
      /Ship\s*Owner[:\s]+([A-Z][A-Z\s,.&]+(?:PVT|LTD|LIMITED|PRIVATE|COMPANY|CORP|INC|SERVICES)[A-Z\s,.]*)/i
    ];
    for (const pattern of shipOwnerNamePatterns) {
      const match = text.match(pattern);
      if (match) {
        result.shipOwnerName = match[1].replace(/\s+/g, ' ').trim();
        console.log('Found Ship Owner Name:', result.shipOwnerName);
        break;
      }
    }

    // Ship Owner Contact Person - Format: "3. Contact Person: MR. ZOHAR A MALAMPATTIWALA"
    const contactPersonPatterns = [
      /3\.?\s*Contact\s*Person[:\s]+(?:MR\.?|MRS\.?|MS\.?)?\s*([A-Z][A-Za-z\s.]+)/i,
      /Contact\s*Person[:\s]+(?:MR\.?|MRS\.?|MS\.?)?\s*([A-Z][A-Za-z\s.]+)/i
    ];
    for (const pattern of contactPersonPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.shipOwnerContactPerson = match[1].replace(/\s+/g, ' ').trim();
        console.log('Found Ship Owner Contact Person:', result.shipOwnerContactPerson);
        break;
      }
    }

    // Ship Owner Postal Address - Format: "4. Postal Address & e-Mail: 3/684,HUSSAINI VILLA..."
    const postalAddressPatterns = [
      /4\.?\s*Postal\s*Address\s*(?:&\s*e-?Mail)?[:\s]+([^\n]+(?:[\n,][^\n]+)*?)(?=\n\s*(?:\d+\.|II|III|IV|V\.|$))/i,
      /Postal\s*Address\s*(?:&\s*e-?Mail)?[:\s]+([^\n]+(?:[\n,][^\n]+)*?)(?=\n\s*(?:\d+\.|II|III|IV|V\.|$))/i,
      /Postal\s*Address[\s:&eMail-]*([^\n]+(?:[\n,][^\n]+)?)/i
    ];
    for (const pattern of postalAddressPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.shipOwnerPostalAddress = match[1].replace(/\n/g, ', ').replace(/\s+/g, ' ').trim();
        console.log('Found Ship Owner Postal Address:', result.shipOwnerPostalAddress);
        break;
      }
    }

    // Extract Seafarer Details - Parse the V. Details of Seafarers section
    // In this PDF format, labels and values are on separate lines
    // Find the section and extract values by looking for specific patterns

    const seafarerSectionMatch = text.match(/V\.?\s*Details\s+of\s+Seafarers?\s*:?([\s\S]*?)(?:VI\.|$)/i);
    if (seafarerSectionMatch) {
      const seafarerSection = seafarerSectionMatch[1];
      console.log('Found Seafarer Section:', seafarerSection.substring(0, 500));

      // Address / Admin keywords to avoid extracting as names
      const ADDRESS_BLACKLIST = [
        'BIHAR', 'ROHTAS', 'DISTRICT', 'DIST', 'VILLAGE', 'VILL', 'PO', 'PS', 'POST', 'POLICE',
        'STATION', 'TEHSIL', 'TALUKA', 'STATE', 'INDIA', 'INDIAN', 'PIN', 'CODE', 'NEAR',
        'STREET', 'ROAD', 'BLOCK', 'PANCHAYAT', 'MANDAL', 'CITY', 'TOWN', 'DISTRICT',
        'MAHARASHTRA', 'GUJARAT', 'RAJASTHAN', 'KERALA', 'TAMIL', 'NADU', 'KARNATAKA',
        'UTTAR', 'PRADESH', 'WEST', 'BENGAL', 'PATNA', 'MUMBAI', 'DELHI', 'CHANDIGARH',
        'VISAKHAPATNAM', 'HYDERABAD', 'CHENNAI', 'KOLKATA', 'PUNE', 'THANE', 'SURAT'
      ];

      // Extract seafarer name - look for an all-caps name (2-4 words)
      // Hardened regex: Ensure it doesn't contain blacklisted address terms
      const nameMatches = Array.from(seafarerSection.matchAll(/\n([A-Z][A-Z\s]{5,40})\n/g));
      for (const match of nameMatches) {
        const potentialName = match[1].trim();
        const words = potentialName.split(/\s+/);

        // Skip if too many words (likely an address line) or contains blacklisted terms
        const isAddress = words.some((word: string) => ADDRESS_BLACKLIST.includes(word.toUpperCase()));
        const hasNumbers = /\d/.test(potentialName);
        const tooShort = words.length < 1;
        const tooLong = words.length > 5;

        if (!isAddress && !hasNumbers && !tooShort && !tooLong) {
          result.seafarerName = potentialName;
          console.log('Found Seafarer Name (Hardened):', result.seafarerName);
          break; // Stop at first valid-looking name
        }
      }

      // Extract nationality - look for INDIAN or similar
      const natMatch = seafarerSection.match(/\n(INDIAN|FILIPINO|CHINESE|INDONESIAN|AMERICAN|BRITISH|CANADIAN|AUSTRALIAN)\n/i);
      if (natMatch) {
        result.seafarerNationality = natMatch[1].toUpperCase();
        console.log('Found Seafarer Nationality:', result.seafarerNationality);
      }

      // Extract date and place of birth - look for DD-MMM-YYYY & PLACE pattern
      const dobMatch = seafarerSection.match(/(\d{2}-[A-Z]{3}-\d{4}\s*[&]\s*[A-Z\-]+)/i);
      if (dobMatch) {
        result.seafarerDatePlaceOfBirth = dobMatch[1].replace(/\s+/g, ' ').trim();
        console.log('Found Seafarer Date/Place of Birth:', result.seafarerDatePlaceOfBirth);
      }

      // Extract email from seafarer section
      const emailMatch = seafarerSection.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (emailMatch) {
        result.seafarerEmail = emailMatch[1].toLowerCase();
        console.log('Found Seafarer Email:', result.seafarerEmail);
      }

      // Extract mobile - look for 10+ digit number
      const mobileMatch = seafarerSection.match(/\n(\d{10,12})\n/);
      if (mobileMatch) {
        result.seafarerMobile = mobileMatch[1];
        console.log('Found Seafarer Mobile:', result.seafarerMobile);
      }

      // Extract postal address - look for lines with FLT/FLAT/NO or address-like content
      const addressMatch = seafarerSection.match(/((?:FLT|FLAT|NO|HOUSE|PLOT)\.?\s*(?:NO\.?)?\s*\d+[^\n]*(?:\n[^\n@0-9]{10,})*)/i);
      if (addressMatch) {
        result.seafarerPostalAddress = addressMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        console.log('Found Seafarer Postal Address:', result.seafarerPostalAddress);
      }
    }

    // Extract INDOS number - appears near the top or in the seafarer section
    // Format: alphanumeric like 07NL1441
    if (!result.seafarerIndosNumber) {
      const indosMatch = text.match(/(?:INDoS|INDOS)\s*(?:No\.?|Number)?[:\s]*([0-9]{2}[A-Z]{2}[0-9]{4})/i);
      if (indosMatch) {
        result.seafarerIndosNumber = indosMatch[1].toUpperCase();
        console.log('Found Seafarer INDOS Number:', result.seafarerIndosNumber);
      } else {
        // Try to find standalone INDOS format number
        const indosStandalone = text.match(/\b([0-9]{2}[A-Z]{2}[0-9]{4})\b/);
        if (indosStandalone) {
          result.seafarerIndosNumber = indosStandalone[1];
          console.log('Found Seafarer INDOS Number (standalone):', result.seafarerIndosNumber);
        }
      }
    }

    // Extract CDC (Continuous Discharge Certificate) details
    // In the PDF text, CDC data appears BEFORE the "6. CDC No. :" label
    // Format: Lines contain "MUM 132798", "MUMBAI", "28-MAR-202527-MAR-2035" followed later by "6. CDC No. :"

    // Look for CDC number pattern like "MUM 132798" or "DEL 123456" anywhere in text
    const cdcNumberMatch = text.match(/\n([A-Z]{2,4}\s+\d{5,7})\n/);
    if (cdcNumberMatch) {
      result.cdcNumber = cdcNumberMatch[1].trim();
      console.log('Found CDC Number:', result.cdcNumber);
    }

    // Look for concatenated dates pattern: "28-MAR-202527-MAR-2035" anywhere in text
    // This is common when Issue Date and Expiry Date are on same line without separator
    const concatenatedDatesMatch = text.match(/(\d{2}-[A-Z]{3}-\d{4})(\d{2}-[A-Z]{3}-\d{4})/i);
    if (concatenatedDatesMatch) {
      result.cdcIssueDate = concatenatedDatesMatch[1];
      result.cdcExpiryDate = concatenatedDatesMatch[2];
      console.log('Found CDC Issue Date:', result.cdcIssueDate);
      console.log('Found CDC Expiry Date:', result.cdcExpiryDate);
    }

    // Look for Place of Issue - search near CDC number for city names
    // The place of issue is usually a standalone city name on its own line
    const placePatterns = [
      /Place\s+of\s+Issue\s*:?\s*(MUMBAI|CHENNAI|KOLKATA|DELHI|COCHIN|GOA|VISAKHAPATNAM|KANDLA|PATNA|LUCKNOW|KOCHI)/i,
      /\n(MUMBAI|CHENNAI|KOLKATA|DELHI|COCHIN|GOA|VISAKHAPATNAM|KANDLA|PATNA|LUCKNOW|KOCHI)\n(?=\d{2}-[A-Z]{3}-\d{4})/i
    ];
    for (const pattern of placePatterns) {
      const placeMatch = text.match(pattern);
      if (placeMatch) {
        result.cdcPlaceOfIssue = placeMatch[1].toUpperCase();
        console.log('Found CDC Place of Issue:', result.cdcPlaceOfIssue);
        break;
      }
    }

    // If no place found yet, try to find it between CDC number and dates
    if (!result.cdcPlaceOfIssue && result.cdcNumber) {
      const cdcNumIndex = text.indexOf(result.cdcNumber);
      if (cdcNumIndex >= 0) {
        const afterCdcNum = text.substring(cdcNumIndex + result.cdcNumber.length, cdcNumIndex + 100);
        const cityMatch = afterCdcNum.match(/\n(MUMBAI|CHENNAI|KOLKATA|DELHI|COCHIN|GOA|VISAKHAPATNAM|KANDLA|PATNA|LUCKNOW|KOCHI)\n/i);
        if (cityMatch) {
          result.cdcPlaceOfIssue = cityMatch[1].toUpperCase();
          console.log('Found CDC Place of Issue (after CDC number):', result.cdcPlaceOfIssue);
        }
      }
    }

    // Extract Passport details (field "7. Passport No.")
    // PDF structure: labels and values are on SEPARATE lines
    // Lines 74-76: "7. Passport No.   :", "Place of Issue :", "Expiry Date  :"
    // Lines 80-82: "R2826385", "PATNA", "04-JUL-2017"
    // The passport number appears AFTER the "6. CDC No." line in the values section

    // Look for passport number pattern: a letter followed by 7 digits on its own line
    // This should appear AFTER CDC data (MUM 132798, MUMBAI, dates) and BEFORE "6. CDC No.   :"
    const passportNumMatch = text.match(/\n([A-Z]\d{7})\n/);
    if (passportNumMatch) {
      result.passportNumber = passportNumMatch[1].toUpperCase();
      console.log('Found Passport Number:', result.passportNumber);

      // Find the position of passport number in text
      const passportNumIndex = text.indexOf(result.passportNumber);
      if (passportNumIndex > 0) {
        // The values after passport number should be: Place (PATNA), then Issue Date (04-JUL-2017)
        // Look at the next 100 characters after passport number
        const afterPassport = text.substring(passportNumIndex + result.passportNumber.length, passportNumIndex + 150);
        console.log('After passport number:', afterPassport.substring(0, 100));

        // Find city name (Place of Issue) - should be on its own line right after passport number
        const cityMatch = afterPassport.match(/\n([A-Z]{3,15})\n/);
        if (cityMatch && !cityMatch[1].match(/^\d/)) {
          result.passportPlaceOfIssue = cityMatch[1].toUpperCase();
          console.log('Found Passport Place of Issue:', result.passportPlaceOfIssue);
        }

        // Find the issue date - DD-MMM-YYYY format after passport number
        const issueDateMatch = afterPassport.match(/(\d{2}-[A-Z]{3}-\d{4})/i);
        if (issueDateMatch) {
          result.passportIssueDate = issueDateMatch[1].toUpperCase();
          console.log('Found Passport Issue Date:', result.passportIssueDate);
        }

        // The expiry date is typically 10 years after issue date
        // In PDF format, it may appear much later in the document (e.g., in "VI. Details of Employment" section)
        // Search for a date that's ~10 years after the issue date
        if (result.passportIssueDate) {
          const issueYear = parseInt(result.passportIssueDate.match(/\d{4}/)?.[0] || '0');
          const issueMonth = result.passportIssueDate.match(/-([A-Z]{3})-/i)?.[1]?.toUpperCase() || '';
          const issueDay = result.passportIssueDate.match(/^(\d{2})-/)?.[1] || '';
          const expectedExpiryYear = issueYear + 10;

          // First, look for a date with same month and similar day, 10 years later
          // This is the most reliable match (e.g., 03-DEC-2020 -> 02-DEC-2030)
          if (issueMonth) {
            const sameMonthPattern = new RegExp(`(\\d{2}-${issueMonth}-${expectedExpiryYear})`, 'i');
            const sameMonthMatch = text.match(sameMonthPattern);
            if (sameMonthMatch) {
              result.passportExpiryDate = sameMonthMatch[1].toUpperCase();
              console.log('Found Passport Expiry Date (same month):', result.passportExpiryDate);
            }
          }

          // If not found with same month, look for any date in expected year
          if (!result.passportExpiryDate) {
            const expiryPattern = new RegExp(`(\\d{2}-[A-Z]{3}-${expectedExpiryYear})`, 'i');
            const allMatches = text.match(new RegExp(expiryPattern.source, 'gi')) || [];

            // Filter out dates already used for other fields
            for (const dateStr of allMatches) {
              if (dateStr.toUpperCase() !== result.cdcIssueDate &&
                dateStr.toUpperCase() !== result.cdcExpiryDate &&
                dateStr.toUpperCase() !== result.cocIssueDate &&
                dateStr.toUpperCase() !== result.cocExpiryDate) {
                result.passportExpiryDate = dateStr.toUpperCase();
                console.log('Found Passport Expiry Date (calculated):', result.passportExpiryDate);
                break;
              }
            }
          }
        }

        // If still no expiry date found, set it to issue date (will need manual correction)
        if (!result.passportExpiryDate && result.passportIssueDate) {
          result.passportExpiryDate = result.passportIssueDate;
          console.log('Found Passport Expiry Date (same as issue - needs correction):', result.passportExpiryDate);
        }
      }
    }

    // --- MRZ (Machine Readable Zone) Parsing ---
    // Specifically for Passports (Standard Type 3 MRZ)
    // Line 1: P<CODEHOLDER<NAME<<<<
    // Line 2: DOCUMENT<NUM<CHECK digit, NAT, DOB, SEX, EXPIRY, etc.
    const mrzLines = lines.filter(line => {
      const clean = line.replace(/\s/g, '');
      // MRZ lines are typically 44 characters for Type 3 (Passports)
      return clean.includes('<<') || (clean.length >= 30 && /^[A-Z0-9<]+$/.test(clean));
    });

    if (mrzLines.length >= 2) {
      console.log('Detected potential MRZ zone with', mrzLines.length, 'lines');

      // Look for the header line. It usually starts with P< (or o<, O<, oC, OC if OCR fails)
      let line1Index = mrzLines.findIndex(l => {
        const c = l.replace(/\s/g, '').toUpperCase();
        return c.startsWith('P<') || c.startsWith('OC<') || c.startsWith('O<') || (c.includes('<<') && c.length > 35);
      });

      if (line1Index !== -1 && mrzLines[line1Index + 1]) {
        let line1 = mrzLines[line1Index].replace(/\s/g, '').toUpperCase();
        let line2 = mrzLines[line1Index + 1].replace(/\s/g, '').toUpperCase();

        console.log('Parsing MRZ Line 1:', line1);
        console.log('Parsing MRZ Line 2:', line2);

        // Name extraction from Line 1
        // Line 1 format: P<INDUPENDRA<<KUMAR<<<<
        // Index 0: P (Type)
        // Index 1: <
        // Index 2-4: IND (Nationality)
        // Index 5 onwards: Name part
        const namePart = line1.substring(5);
        if (namePart.includes('<<')) {
          const components = namePart.split('<<');
          const surname = components[0].replace(/<+/g, ' ').trim();
          const givenNames = components[1] ? components[1].split('<<')[0].replace(/<+/g, ' ').trim() : '';

          result.detectedHolderName = givenNames ? `${givenNames} ${surname}` : surname;
          result.seafarerName = result.detectedHolderName;
          console.log('Extracted name from MRZ (Normalized):', result.detectedHolderName);
        }

        // Passport Number from Line 2 (first 9 characters + check digit)
        // MRZ Format: PASSPORTNUM(9 chars) + CHECK_DIGIT(1 char)
        // Example: U2701560<2 where '2' is the check digit for 'U2701560<'

        if (line2.length >= 10) {
          // Extract passport number (positions 0-8) and check digit (position 9)
          const passNumWithFiller = line2.substring(0, 9); // May contain '<' fillers
          const checkDigit = line2.charAt(9);

          console.log('[MRZ-PASSPORT] Raw extraction:');
          console.log(`  Passport field: "${passNumWithFiller}"`);
          console.log(`  Check digit: "${checkDigit}"`);

          // Calculate what the check digit should be
          const calculatedCheck = this.calculateMRZCheckDigit(passNumWithFiller);
          console.log(`  Calculated check: "${calculatedCheck}"`);

          // Remove filler characters for the final passport number
          let passNumRaw = passNumWithFiller.replace(/</g, '').trim();

          if (passNumRaw.length >= 7) {
            // Validate checksum
            if (checkDigit === calculatedCheck) {
              // ✓ Checksum PASSED - MRZ data is reliable
              result.passportNumber = passNumRaw;
              console.log(`[MRZ-PASSPORT] ✓ Checksum VALID - Passport number: "${result.passportNumber}"`);
            } else {
              // ✗ Checksum FAILED - Try OCR corrections
              console.warn(`[MRZ-PASSPORT] ✗ Checksum FAILED for "${passNumRaw}"`);
              console.warn(`  Expected check digit: "${calculatedCheck}", Got: "${checkDigit}"`);
              console.warn(`  Attempting OCR error corrections...`);

              // Try to correct common OCR mistakes
              const corrected = this.tryOCRCorrections(passNumWithFiller, checkDigit);

              if (corrected) {
                // Successfully corrected
                const correctedClean = corrected.replace(/</g, '').trim();
                result.passportNumber = correctedClean;
                console.log(`[MRZ-PASSPORT] ✓ CORRECTED passport number: "${result.passportNumber}"`);
              } else {
                // Could not correct - use raw value but flag it
                result.passportNumber = passNumRaw;
                console.warn(`[MRZ-PASSPORT] ⚠️ Using UNVALIDATED passport number: "${result.passportNumber}"`);
                console.warn(`  This may be incorrect - will compare with visual OCR later`);
              }
            }
          } else {
            console.warn(`[MRZ-PASSPORT] Passport number too short (${passNumRaw.length} chars): "${passNumRaw}"`);
          }
        } else {
          console.warn('[MRZ-PASSPORT] MRZ Line 2 too short for passport extraction');
        }


        // Extract DOB and Expiry from Line 2 if length is sufficient
        // POS: passportNum(9) check(1) NAT(3) DOB(6) check(1) SEX(1) EXPIRY(6) ...
        if (line2.length >= 27) {
          const dobPart = line2.substring(13, 19); // YYMMDD
          const sexPart = line2.substring(20, 21);
          const expiryPart = line2.substring(21, 27); // YYMMDD

          console.log('MRZ Parts - DOB:', dobPart, 'Sex:', sexPart, 'Expiry:', expiryPart);

          // Convert YYMMDD to a more readable format if needed, but for now we just log
          result.detectedDocumentType = 'passport';
        }
      }
    }

    // Global Search Fallback: Look for any string matching [A-Z0-9]{7,10} if still not found
    if (!result.passportNumber) {
      console.log('Passport number still not found, performing global regex search...');
      // Look for common passport patterns (1 letter + 7-8 digits)
      // Allow for optional space like "U 2701560" or common misreads like "J"
      const globalMatch = text.match(/\b([A-Z][\s]?\d{7,8})\b/i) || text.match(/\b(\d{7,9})\b/i);
      if (globalMatch) {
        result.passportNumber = globalMatch[1].replace(/\s/g, '').toUpperCase();
        console.log('Found passport number via global search:', result.passportNumber);
      }
    }

    // Extract passport number fallback - look for line with "PASSPORT NO" and number

    // Extract Next of Kin (NOK) details - Section 8
    const nokMatch = text.match(/8\.\s*Next\s*of\s*Kin\s*\(NOK\)\s*:?([\s\S]*?)(?:9\.|VI\.|$)/i);
    if (nokMatch) {
      const nokSection = nokMatch[1];
      console.log('Found NOK section:', nokSection.substring(0, 200));

      // NOK Name - usually appears after "Name" label, format like "MRS. BINITA KUMARI"
      // IMPORTANT: Stop before relationship words (WIFE, HUSBAND, etc.) and address parts
      const nokNameMatch = nokSection.match(/(?:Name[\s:]*\n?|^)([A-Z]{2,4}\.\s*[A-Z][A-Z\s]+?)(?=\n|WIFE|HUSBAND|FATHER|MOTHER|PARENT|BROTHER|SISTER|SON|DAUGHTER|D\.NO|D\.No)/im) ||
        nokSection.match(/\n([A-Z]{2,4}\.\s*[A-Z][A-Z\s]+?)(?=\n(?:WIFE|HUSBAND|FATHER|MOTHER|PARENT|BROTHER|SISTER|SON|DAUGHTER|D\.NO|D\.No|\d))/i);
      if (nokNameMatch) {
        let nokName = nokNameMatch[1].trim().toUpperCase();
        // Remove trailing relationship words if accidentally captured
        nokName = nokName.replace(/\s+(WIFE|HUSBAND|FATHER|MOTHER|PARENT|BROTHER|SISTER|SON|DAUGHTER)\s*$/i, '');
        // Remove trailing 'D' which is start of address
        nokName = nokName.replace(/\s+D\s*$/i, '');
        result.nokName = nokName;
        console.log('Found NOK Name:', result.nokName);
      }

      // Relationship - words like WIFE, HUSBAND, PARENT, FATHER, MOTHER, etc.
      const relationshipMatch = nokSection.match(/\n(WIFE|HUSBAND|FATHER|MOTHER|PARENT|BROTHER|SISTER|SON|DAUGHTER)\n/i);
      if (relationshipMatch) {
        result.nokRelationship = relationshipMatch[1].toUpperCase();
        console.log('Found NOK Relationship:', result.nokRelationship);
      }

      // NOK Email - look for email pattern
      const nokEmailMatch = nokSection.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (nokEmailMatch) {
        result.nokEmail = nokEmailMatch[1].toLowerCase();
        console.log('Found NOK Email:', result.nokEmail);
      }

      // NOK Telephone - look for phone number (Indian format typically 10 digits)
      const nokTelMatch = nokSection.match(/(?:Tel\s*No\.?[\s:]*)?(\d{10,12})/i);
      if (nokTelMatch) {
        result.nokTelephone = nokTelMatch[1];
        console.log('Found NOK Telephone:', result.nokTelephone);
      }

      // NOK Postal Address - from 8a section
      // IMPORTANT: Only extract the actual street address, not name/relationship
      const nokAddressMatch = nokSection.match(/8\s*a\.?\s*NOK['']?s?\s*Postal\s*Address\s*:?\s*([\s\S]*?)(?:\d{10,}|$)/i) ||
        nokSection.match(/Postal\s*Address\s*:?\s*([\s\S]*?)(?:\d{10,}|$)/i);
      if (nokAddressMatch) {
        let addressText = nokAddressMatch[1];

        // Remove name patterns (MRS./MR. followed by name)
        addressText = addressText.replace(/^[\s,]*(?:MRS?\.?|MISS)\s+[A-Z][A-Z\s]+/i, '');

        // Remove relationship words that appear on their own line
        addressText = addressText.replace(/^[\s,]*(WIFE|HUSBAND|FATHER|MOTHER|PARENT|BROTHER|SISTER|SON|DAUGHTER)[\s,]*/gi, '');

        // Clean up the address - join multiple lines
        result.nokPostalAddress = addressText
          .replace(/\n/g, ', ')
          .replace(/,\s*,/g, ',')
          .replace(/^\s*,\s*/, '')
          .replace(/,\s*$/, '')
          .trim()
          .toUpperCase();

        // Additional cleanup: if address still starts with relationship word, remove it
        result.nokPostalAddress = result.nokPostalAddress.replace(/^(WIFE|HUSBAND|FATHER|MOTHER|PARENT|BROTHER|SISTER|SON|DAUGHTER),?\s*/i, '');

        console.log('Found NOK Postal Address:', result.nokPostalAddress);
      }
    }

    // Extract Competency Certificate (COC) details - Section 9
    const cocMatch = text.match(/9\.\s*Details\s*of\s*Competency\s*Certificates?\s*:?([\s\S]*?)(?:10\.|VI\.|VII\.|$)/i) ||
      text.match(/Competency\s*Certificate[s]?\s*:?([\s\S]*?)(?:10\.|VI\.|VII\.|$)/i);
    if (cocMatch) {
      const cocSection = cocMatch[1];
      console.log('Found COC section:', cocSection.substring(0, 300));

      // COC Grade / No - In PDF layout, labels and values are on separate lines
      // Look for patterns like "Mate of a Home-Trade Ship (NCV) / NCVON421" anywhere in the section
      const gradePatterns = [
        // Pattern: "Mate of a Home-Trade Ship (NCV)  /  NCVON421"
        /\b(Mate\s+of\s+[^\/\n]+\s*\/\s*[A-Z0-9]+)/i,
        // Pattern: "Master (F.G.) / 23-MUM-2024"
        /\b(Master\s*(?:\([^)]+\))?\s*\/\s*[\w\-]+)/i,
        // Pattern: "Chief Officer / NCV123"
        /\b(Chief\s*(?:Officer|Engineer)\s*(?:\([^)]+\))?\s*\/\s*[\w\-]+)/i,
        // Pattern: "Second Officer / ABC123"
        /\b((?:Second|Third)\s*(?:Officer|Engineer)\s*(?:\([^)]+\))?\s*\/\s*[\w\-]+)/i,
        // Generic pattern: Any text followed by / and alphanumeric ID (but exclude labels)
        /\n([A-Za-z][A-Za-z\s\(\)\-\.]+\s*\/\s*[A-Z0-9]+)(?:\n|$)/i
      ];

      for (const pattern of gradePatterns) {
        const match = cocSection.match(pattern);
        if (match && match[1]) {
          const gradeValue = match[1].trim();
          // Make sure we're not capturing labels like "COC Grade / No" or "Place of Issue"
          if (!gradeValue.match(/^(COC\s*)?Grade\s*\/?\s*No|Place\s*of\s*Issue|Date\s*of/i)) {
            result.cocGradeNo = gradeValue.toUpperCase();
            console.log('Found COC Grade/No:', result.cocGradeNo);
            break;
          }
        }
      }

      // COC Place of Issue
      const cocPlaceMatch = cocSection.match(/Place\s*of\s*Issue\s*:?\s*([A-Z][A-Z\s]+?)(?:\n|$)/i) ||
        cocSection.match(/\n([A-Z]{3,15})\n.*(?:Issue|Date)/i);
      if (cocPlaceMatch) {
        result.cocPlaceOfIssue = cocPlaceMatch[1].trim().toUpperCase();
        console.log('Found COC Place of Issue:', result.cocPlaceOfIssue);
      }

      // COC Dates - look for DD-MMM-YYYY format
      const cocDates = cocSection.match(/(\d{2}-[A-Z]{3}-\d{4})/gi);
      if (cocDates && cocDates.length >= 1) {
        result.cocIssueDate = cocDates[0].toUpperCase();
        console.log('Found COC Issue Date:', result.cocIssueDate);
        if (cocDates.length >= 2) {
          result.cocExpiryDate = cocDates[1].toUpperCase();
          console.log('Found COC Expiry Date:', result.cocExpiryDate);
        }
      }

      // Alternative date patterns
      if (!result.cocIssueDate) {
        const issueDateMatch = cocSection.match(/(?:Date\s*of\s*Issue|Issue\s*Date)\s*:?\s*(\d{2}[-\/]\w{3}[-\/]\d{4})/i);
        if (issueDateMatch) {
          result.cocIssueDate = issueDateMatch[1].replace(/\//g, '-').toUpperCase();
          console.log('Found COC Issue Date (alt):', result.cocIssueDate);
        }
      }
      if (!result.cocExpiryDate) {
        const expiryDateMatch = cocSection.match(/(?:Date\s*of\s*Expiry|Expiry\s*Date|Valid\s*Till)\s*:?\s*(\d{2}[-\/]\w{3}[-\/]\d{4})/i);
        if (expiryDateMatch) {
          result.cocExpiryDate = expiryDateMatch[1].replace(/\//g, '-').toUpperCase();
          console.log('Found COC Expiry Date (alt):', result.cocExpiryDate);
        }
      }
    }

    // Extract Medical Certificate details - Section 11
    const medicalMatch = text.match(/11\.\s*Details\s*of\s*Medical\s*Certificate\s*:?([\s\S]*?)(?:12\.|VI\.\s*Details|VIII\.|IX\.|$)/i) ||
      text.match(/Medical\s*Certificate\s*:?([\s\S]*?)(?:12\.|VI\.\s*Details|VIII\.|IX\.|$)/i);
    if (medicalMatch) {
      const medicalSection = medicalMatch[1];
      console.log('Found Medical Certificate section:', medicalSection.substring(0, 300));

      // First, find the Approval No pattern (e.g., MAH/NM/22/2015) - alphanumeric with slashes
      const approvalNoMatch = medicalSection.match(/\n([A-Z]{2,5}\/[A-Z]{1,3}\/\d{1,4}\/\d{4})\n/i) ||
        medicalSection.match(/([A-Z]{2,5}\/[A-Z]{1,3}\/\d{1,4}\/\d{4})/i);
      if (approvalNoMatch) {
        result.medicalApprovalNo = approvalNoMatch[1].trim().toUpperCase();
        console.log('Found Medical Approval No:', result.medicalApprovalNo);
      }

      // Issuing Authority - look for DR. pattern, capture name until approval number pattern or date
      // The text structure shows: "DR. DIWAKAR TIWARI ( GLOBUS\nMEDICARE)\nMAH/NM/22/2015"
      const issuingAuthorityMatch = medicalSection.match(/(DR\.?\s+[A-Z][A-Z\s\.\(\)\-]+?)(?:\n[A-Z]{2,5}\/|$)/i);
      if (issuingAuthorityMatch) {
        // Clean up the authority name - remove trailing newlines and join multiline text
        let authority = issuingAuthorityMatch[1]
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toUpperCase();
        result.medicalIssuingAuthority = authority;
        console.log('Found Medical Issuing Authority:', result.medicalIssuingAuthority);
      }

      // Medical Dates - look for Issue Date and Expiry Date patterns
      const issueMatch = medicalSection.match(/Issue\s*Date\s*:?\s*(\d{2}-[A-Z]{3}-\d{4})/i);
      if (issueMatch) {
        result.medicalIssueDate = issueMatch[1].toUpperCase();
        console.log('Found Medical Issue Date:', result.medicalIssueDate);
      }

      const expiryMatch = medicalSection.match(/Expiry\s*Date\s*:?\s*(\d{2}-[A-Z]{3}-\d{4})/i);
      if (expiryMatch) {
        result.medicalExpiryDate = expiryMatch[1].toUpperCase();
        console.log('Found Medical Expiry Date:', result.medicalExpiryDate);
      }

      // If dates not found with labels, try to find DD-MMM-YYYY patterns in the section
      if (!result.medicalIssueDate || !result.medicalExpiryDate) {
        const medicalDates = medicalSection.match(/(\d{2}-[A-Z]{3}-\d{4})/gi);
        if (medicalDates && medicalDates.length >= 1 && !result.medicalIssueDate) {
          result.medicalIssueDate = medicalDates[0].toUpperCase();
          console.log('Found Medical Issue Date (fallback):', result.medicalIssueDate);
        }
        if (medicalDates && medicalDates.length >= 2 && !result.medicalExpiryDate) {
          result.medicalExpiryDate = medicalDates[1].toUpperCase();
          console.log('Found Medical Expiry Date (fallback):', result.medicalExpiryDate);
        }
      }
    }

    // Extract Ship Details - Section IV
    const shipMatch = text.match(/IV\.?\s*Details\s*of\s*Ship\s*:?\s*\(?(?:Place\s*of\s*work)?\)?([\s\S]*?)(?:V\.\s*Details|$)/i);
    if (shipMatch) {
      const shipSection = shipMatch[1];
      console.log('Found Ship section:', shipSection.substring(0, 200));

      // Ship Name - Look for "1. Name:" followed by value on next line(s)
      // In the PDF, the format shows: "1. Name  :" then "AQUA TOW" on a later line
      const shipNameMatch = shipSection.match(/1\.?\s*Name\s*:?\s*\n([A-Z][A-Z\s\-0-9]+)/i) ||
        shipSection.match(/\n([A-Z][A-Z\s]{2,30})\n(?:MUMBAI|CHENNAI|KOLKATA|DELHI)/i);
      if (shipNameMatch) {
        result.shipName = shipNameMatch[1].trim().toUpperCase();
        console.log('Found Ship Name:', result.shipName);
      } else {
        // Alternative: Look for standalone all-caps ship name in the section
        const lines = shipSection.split('\n').filter(l => l.trim().length > 0);
        for (const line of lines) {
          const trimmed = line.trim();
          // Ship names are typically short all-caps words like "AQUA TOW", "MV OCEAN STAR"
          if (/^[A-Z][A-Z\s\-0-9]{2,30}$/.test(trimmed) &&
            !trimmed.includes('NAME') &&
            !trimmed.includes('DETAILS') &&
            !trimmed.includes('PORT') &&
            !trimmed.includes('REGISTRY')) {
            result.shipName = trimmed;
            console.log('Found Ship Name (fallback):', result.shipName);
            break;
          }
        }
      }
    }

    // Fallback: If name not found, use the one extracted earlier
    if (!result.seafarerName && result.name) {
      result.seafarerName = result.name;
      console.log('Using crew name as seafarer name:', result.seafarerName);
    }

    // Extract Capacity / Rank Employed from VI. Details of Employment section
    const capacityRankMatch = text.match(/VI\.?\s*Details\s*of\s*Employment\s*:?([\s\S]*?)(?:VII\.|Page\s+\d|$)/i);
    if (capacityRankMatch) {
      const employmentSection = capacityRankMatch[1];
      // Look for "1. Capacity / Rank Employed" followed by the rank value
      // The rank appears after "Capacity / Rank Employed" label, typically on a separate line
      const rankPatterns = [
        /Capacity\s*\/?\s*Rank\s*Employed[:\s]*([\w\s()/-]+?)(?:\n\d|\n\s*\d|$)/i,
        /(?:Master|Captain|Chief\s+Officer|2nd\s+Officer|3rd\s+Officer|Chief\s+Engineer|2nd\s+Engineer|3rd\s+Engineer|Bosun|AB|OS|Oiler|Fitter|Cook|Steward|Rating)\s*\([^)]+\)/i,
      ];

      // Try to find rank from the employment section values
      // In the document format, values are listed separately after labels
      const employmentLines = employmentSection.split('\n').map(l => l.trim()).filter(l => l);
      for (const line of employmentLines) {
        // Match patterns like "Master (NCV)", "Chief Officer (NCV)", etc.
        const rankMatch = line.match(/^((?:Master|Captain|Chief\s+Officer|2nd\s+Officer|3rd\s+Officer|Chief\s+Engineer|2nd\s+Engineer|3rd\s+Engineer|Bosun|AB|OS|Oiler|Fitter|Cook|Steward|Rating)(?:\s*\([^)]+\))?)$/i);
        if (rankMatch && !result.capacityRankEmployed) {
          result.capacityRankEmployed = rankMatch[1].trim();
          console.log('Found Capacity / Rank Employed:', result.capacityRankEmployed);
          break;
        }
      }
    }

    // Extract Engagement Period (in months) - Format varies by document
    // Pattern 1: "Engagement Period : 3 Months" (same line)
    const engagementPatterns = [
      /Engagement\s*Period\s*:?\s*(\d+)\s*Month/i,
      /Period\s*of\s*Engagement\s*:?\s*(\d+)\s*Month/i,
      /Contract\s*Period\s*:?\s*(\d+)\s*Month/i,
      /Duration\s*:?\s*(\d+)\s*Month/i
    ];
    for (const pattern of engagementPatterns) {
      const engagementMatch = text.match(pattern);
      if (engagementMatch) {
        result.engagementPeriodMonths = parseInt(engagementMatch[1], 10);
        console.log('Found Engagement Period (months):', result.engagementPeriodMonths);
        break;
      }
    }

    // Pattern 2: Handle VI. Details of Employment section where values are separate
    // In this format: labels first, then values (Chief Officer, 3, 2.5, 77, etc.)
    // The "3" after "Chief Officer" is the engagement period months
    if (!result.engagementPeriodMonths) {
      const employmentMatch = text.match(/VI\.?\s*Details\s*of\s*Employment\s*:?([\s\S]*?)(?:VII\.|Page\s+\d|$)/i);
      if (employmentMatch) {
        const employmentSection = employmentMatch[1];
        console.log('Found Employment section for engagement period');

        // Look for the pattern: Rank/Capacity value followed by single digit (months)
        // Format typically: "Chief Officer (NCV)" then "3" (months) then "2.5" (leave days)
        const valuesMatch = employmentSection.match(/(?:Chief|Master|Captain|Officer|Engineer|Mate|Bosun|AB|OS|Oiler|Fitter|Cook|Steward)[^\n]*\n(\d{1,2})\n/i);
        if (valuesMatch) {
          const months = parseInt(valuesMatch[1], 10);
          if (months >= 1 && months <= 24) { // Reasonable range for contract months
            result.engagementPeriodMonths = months;
            console.log('Found Engagement Period from employment section (months):', result.engagementPeriodMonths);
          }
        }
      }
    }

    // Clean up all extracted string values
    Object.keys(result).forEach(key => {
      const value = result[key as keyof ExtractedCrewData];
      if (value && typeof value === 'string') {
        (result as any)[key] = value
          .replace(/\s+/g, ' ')
          .trim();
      }
    });

    // If no name was found, it might be missing from OCR - note this in logs
    if (!result.name) {
      // Note: Employee names are often not detected due to font/format limitations in maritime documents
      // This is expected behavior and users can manually enter names when needed
      console.log('Employee name not detected - this is normal for maritime contract documents');
    }

    console.log('Final parsed crew data:', result);
    return result;
  }

  /**
   * Calculate MRZ check digit using ISO/IEC 7501-1 algorithm
   * @param input - The string to calculate check digit for
   * @returns The check digit as a string (0-9)
   */
  private calculateMRZCheckDigit(input: string): string {
    const weights = [7, 3, 1];
    let sum = 0;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      let value: number;

      if (char === '<') {
        value = 0;
      } else if (char >= '0' && char <= '9') {
        value = parseInt(char);
      } else if (char >= 'A' && char <= 'Z') {
        value = char.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        value = 0;
      }

      sum += value * weights[i % 3];
    }

    return (sum % 10).toString();
  }

  /**
   * Try common OCR character corrections for passport numbers
   * @param passportNum - The passport number to correct
   * @param expectedCheckDigit - The expected check digit from MRZ
   * @returns Corrected passport number or null if no valid correction found
   */
  private tryOCRCorrections(passportNum: string, expectedCheckDigit: string): string | null {
    const corrections = [
      { from: 'V', to: 'U', reason: 'V → U (common OCR confusion)' },
      { from: 'U', to: 'V', reason: 'U → V (reverse confusion)' },
      { from: 'O', to: '0', reason: 'Letter O → Zero' },
      { from: '0', to: 'O', reason: 'Zero → Letter O' },
      { from: 'I', to: '1', reason: 'Letter I → One' },
      { from: '1', to: 'I', reason: 'One → Letter I' },
      { from: 'I', to: 'J', reason: 'I → J (Indian passports)' },
      { from: 'J', to: 'I', reason: 'J → I (reverse)' },
      { from: 'S', to: '5', reason: 'Letter S → Five' },
      { from: '5', to: 'S', reason: 'Five → Letter S' },
      { from: 'B', to: '8', reason: 'Letter B → Eight' },
      { from: '8', to: 'B', reason: 'Eight → Letter B' },
    ];

    // Try single character corrections
    for (const correction of corrections) {
      if (passportNum.includes(correction.from)) {
        const corrected = passportNum.replace(new RegExp(correction.from, 'g'), correction.to);
        if (corrected !== passportNum) {
          const calculatedCheck = this.calculateMRZCheckDigit(corrected);
          if (calculatedCheck === expectedCheckDigit) {
            console.log(`✓ OCR Correction applied: "${passportNum}" → "${corrected}" (${correction.reason})`);
            return corrected;
          }
        }
      }
    }

    // Try positional corrections (only first character)
    for (const correction of corrections) {
      if (passportNum[0] === correction.from) {
        const corrected = correction.to + passportNum.substring(1);
        const calculatedCheck = this.calculateMRZCheckDigit(corrected);
        if (calculatedCheck === expectedCheckDigit) {
          console.log(`✓ OCR Correction applied (first char): "${passportNum}" → "${corrected}" (${correction.reason})`);
          return corrected;
        }
      }
    }

    return null;
  }

  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  async extractCrewDataWithRecord(base64Data: string, filename?: string): Promise<ExtractedCrewRecord> {
    const data = await this.extractCrewDataFromDocument(base64Data, filename);

    // Generate a unique record ID
    const recordId = `crew-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create a display name from the extracted data
    const displayName = data.seafarerName || data.name || 'Unknown Crew Member';

    return {
      ...data,
      recordId,
      displayName,
    };
  }
}

export const localOcrService = new LocalOCRService();
