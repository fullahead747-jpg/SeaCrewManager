import Groq from 'groq-sdk';
import { fromPath } from 'pdf2pic';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

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
  shipOwnerName?: string;
  shipOwnerContactPerson?: string;
  shipOwnerPostalAddress?: string;
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
  medicalIssuingAuthority?: string;
  medicalApprovalNo?: string;
  medicalIssueDate?: string;
  medicalExpiryDate?: string;
  shipName?: string;
  engagementPeriodMonths?: number;
  detectedDocumentType?: string;
  detectedHolderName?: string;
  firstName?: string;  // Given name from passport
  lastName?: string;   // Surname from passport
  mrzLine1?: string;
  mrzLine2?: string;
  rawText?: string;
}

export interface ExtractedCrewRecord extends ExtractedCrewData {
  recordId: string;
  displayName: string;
}

export class GroqOCRService {
  private client: Groq | null = null;

  private getClient(): Groq {
    if (!this.client) {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error('GROQ_API_KEY is not set');
      }
      this.client = new Groq({ apiKey });
    }
    return this.client;
  }

  isAvailable(): boolean {
    const key = process.env.GROQ_API_KEY;
    const available = !!key && key.length > 10;
    if (!available) {
      console.warn('Groq OCR is NOT available. Key length:', key?.length || 0);
    }
    return available;
  }

  private async convertPDFToImage(base64Data: string): Promise<string> {
    console.log('[OCR-GROQ] Converting PDF to image for Groq vision processing...');

    try {
      const tempDir = join(tmpdir(), 'seacrew-pdf-conversion');
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }

      const pdfPath = join(tempDir, `temp-${Date.now()}.pdf`);
      // Remove data:application/pdf;base64, prefix if present
      const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');
      const pdfBuffer = Buffer.from(cleanBase64, 'base64');
      writeFileSync(pdfPath, pdfBuffer);

      const options = {
        density: 150,
        saveFilename: `page-${Date.now()}`,
        savePath: tempDir,
        format: 'jpeg',
        width: 1200,
        height: 1600
      };

      const convert = fromPath(pdfPath, options);
      const result = await convert(1, { responseType: 'base64' });

      // Clean up temp files
      try { unlinkSync(pdfPath); } catch (e) { }
      if (result.path && existsSync(result.path)) {
        try { unlinkSync(result.path); } catch (e) { }
      }

      console.log('[OCR-GROQ] PDF converted to image successfully');
      return result.base64 || '';
    } catch (error) {
      console.warn('[OCR-GROQ] PDF to image conversion failed (likely missing GraphicsMagick):', error);
      throw error;
    }
  }

  async extractCrewDataFromDocument(base64Data: string, filename?: string, expectedType?: string): Promise<ExtractedCrewData> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Groq API key is not configured');
      }

      console.log('Starting Groq Vision OCR extraction for file:', filename);

      let processedBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const isPDF = base64Data.startsWith('JVBERi') ||
        base64Data.includes('data:application/pdf;base64') ||
        filename?.toLowerCase().endsWith('.pdf');

      if (isPDF) {
        console.warn('[OCR-GROQ] PDF detected. Groq Vision requires image format. Attempting conversion...');
        try {
          processedBase64 = await this.convertPDFToImage(base64Data);
        } catch (convError) {
          console.error('[OCR-GROQ] PDF conversion failed. Skipping Groq for this PDF.');
          // Don't throw, just return empty data or let it fail gracefully so others can continue
          return { rawText: 'Groq skipped: PDF conversion failed' };
        }
      }

      const client = this.getClient();
      const model = "meta-llama/llama-4-scout-17b-16e-instruct";

      let typeSpecificPrompt = "";
      if (expectedType) {
        const type = expectedType.toLowerCase();
        if (type === 'passport') {
          typeSpecificPrompt = `
CRITICAL: This document is a PASSPORT. Extract MRZ lines, passport number, dates, and name correctly.`;
        } else if (type === 'cdc') {
          typeSpecificPrompt = "\nCRITICAL: This document is a CDC. Extract CDC No, Dates, and Name.";
        } else if (type === 'medical') {
          typeSpecificPrompt = "\nCRITICAL: This document is a MEDICAL CERTIFICATE. Extract Authority, Dates, and Name.";
        } else if (type.includes('coc')) {
          typeSpecificPrompt = "\nCRITICAL: This document is a COC. Extract Grade/No, Dates, and Name.";
        }
      }

      const prompt = `You are an expert at extracting structured data from maritime documents.${typeSpecificPrompt}
Analyze this document image and extract details. 
Return ONLY a valid JSON object with these keys: seafarerName, rank, nationality, dob, cdcNo, passportNo, cocGrade, medicalApprovalNo, detectedDocumentType, detectedHolderName, mrzLine1, mrzLine2.
Return ONLY valid JSON.`;

      console.log(`[OCR-GROQ] Sending request to Groq (${model})...`);

      const response = await client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are an expert OCR engine. Return only JSON data."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${processedBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content || '{}';
      console.log('--- GROQ RAW RESPONSE ---');
      console.log(content);
      console.log('-------------------------');

      // Robust JSON extraction
      let jsonStr = content;
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = content.substring(firstBrace, lastBrace + 1);
      }

      try {
        const parsed = JSON.parse(jsonStr);
        return {
          seafarerName: parsed.seafarerName || undefined,
          capacityRankEmployed: (parsed.rank || parsed.capacityRankEmployed) || undefined,
          seafarerNationality: (parsed.nationality || parsed.seafarerNationality) || undefined,
          seafarerDatePlaceOfBirth: (parsed.dob || parsed.seafarerDatePlaceOfBirth) || undefined,
          cdcNumber: (parsed.cdcNo || parsed.cdcNumber) || undefined,
          passportNumber: (parsed.passportNo || parsed.passportNumber) || undefined,
          cocGradeNo: (parsed.cocGrade || parsed.cocGradeNo) || undefined,
          medicalApprovalNo: (parsed.medicalApprovalNo || parsed.medicalApprovalNo) || undefined,
          detectedDocumentType: parsed.detectedDocumentType || undefined,
          detectedHolderName: parsed.detectedHolderName || undefined,
          mrzLine1: parsed.mrzLine1 || undefined,
          mrzLine2: parsed.mrzLine2 || undefined,
          rawText: content
        };
      } catch (parseError) {
        console.error('Failed to parse Groq response as JSON:', parseError);
        throw new Error('Failed to parse AI response');
      }

    } catch (error) {
      console.error('Groq Vision OCR error:', error);
      throw new Error(`Groq Vision processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractCrewDataWithRecord(base64Data: string, filename?: string): Promise<ExtractedCrewRecord> {
    const data = await this.extractCrewDataFromDocument(base64Data, filename);
    const recordId = `crew-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const displayName = data.seafarerName || data.name || 'Unknown Crew Member';
    return {
      ...data,
      recordId,
      displayName,
    };
  }
}

export const groqOcrService = new GroqOCRService();
