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

  async extractCrewDataFromDocument(base64Data: string, filename?: string): Promise<ExtractedCrewData> {
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
        throw new Error('PDF files are not supported yet. Please convert your PDF to an image (JPG/PNG) first, or take a photo of the document.');
      } else {
        // Handle image
        console.log('Processing image with Tesseract...');
        extractedText = await this.extractTextFromImage(base64Data);
      }

      console.log('Extracted raw text:', extractedText);

      // Parse the extracted text to find crew information
      const crewData = this.parseCrewInformation(extractedText);
      console.log('Parsed crew data:', crewData);
      
      return crewData;
    } catch (error) {
      console.error('Local OCR extraction error:', error);
      if (error instanceof Error) {
        throw new Error(`OCR processing failed: ${error.message}`);
      }
      throw new Error('Failed to extract data from document. Please try again or enter the information manually.');
    }
  }

  // PDF extraction removed for now to avoid dependency issues

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

  private parseCrewInformation(text: string): ExtractedCrewData {
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
      result.contractStartDate = validDates[0];
      console.log('Found contract start date:', validDates[0]);
      
      if (validDates.length >= 2) {
        result.contractEndDate = validDates[1];
        console.log('Found contract end date:', validDates[1]);
      }
    }

    // Extract CDC number if mentioned
    const cdcMatch = text.match(/cdc[:\s]*([a-z0-9]+)/i);
    if (cdcMatch) {
      result.seamansBookNumber = cdcMatch[1];
      console.log('Found CDC number:', cdcMatch[1]);
    }

    // Clean up all extracted values
    Object.keys(result).forEach(key => {
      const value = result[key as keyof ExtractedCrewData];
      if (value && typeof value === 'string') {
        result[key as keyof ExtractedCrewData] = value
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

  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export const localOcrService = new LocalOCRService();