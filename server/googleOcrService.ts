import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import path from 'path';
import fs from 'fs';

// Resolve the credentials file path robustly for Windows
function resolveCredentialsPath(): string | null {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) return null;
  return path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath);
}

/**
 * Extract a value following a label in raw OCR text.
 * Searches for the label and captures the text on the same line (or next non-empty line).
 */
function extract(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) {
      const val = match[1].trim().replace(/\s+/g, ' ');
      if (val.length > 1 && val !== ':') return val;
    }
  }
  return undefined;
}

/**
 * Parse all seafarer fields from raw text extracted by Google Document AI.
 * Focuses strictly on fields required by the "Add New Crew Member" form.
 */
function parseAoaFields(text: string): Record<string, string | number> {
  const t = text;
  const result: Record<string, string | number> = {};

  // Simple, safe extract function for single patterns
  const extract = (scope: string, patterns: RegExp[]): string | undefined => {
    for (const pattern of patterns) {
      const match = scope.match(pattern);
      if (match?.[1]?.trim()) {
        const val = match[1].trim().replace(/\s+/g, ' ');
        if (val.length >= 1 && !/^[:.\-\s]+$/.test(val)) {
          if (val === ':') return undefined;
          return val;
        }
      }
    }
    return undefined;
  };

  // 1. Scopes - avoid catastrophic backtracking by targeting bounded blocks of text
  // IMPORTANT: No 'm' flag so '$' matches end of string, not end of line.
  // 1. Scopes
  const sfScopeMatch = t.match(/(?:Details of Seafarer[s]?|Section V)([\s\S]{0,4000}?)(?:Details of Employment|Section VI|SIGNED|WITNESS|Signature|$)/i);
  const sfScope = sfScopeMatch ? sfScopeMatch[1] : t;

  // NOK usually starts after the Seafarer Identity section.
  const nokHeaderIndex = t.search(/(?:Next of Kin\s*\(?NOK\)?|8\.\s+Next of Kin)/i);
  const nokScope = nokHeaderIndex !== -1
    ? t.substring(nokHeaderIndex, Math.min(t.length, nokHeaderIndex + 3000))
    : t;

  // Medical Certificate Section
  // This can be tricky as the header might appear after the data.
  const medicalHeaderIndex = t.search(/(?:Details of Medical Certificate|Section 11|11\.\s)/i);
  const medicalScope = medicalHeaderIndex !== -1
    ? t.substring(Math.max(0, medicalHeaderIndex - 400), Math.min(t.length, medicalHeaderIndex + 500))
    : t;

  // COC section scope
  const cocScopeMatch = t.match(/(?:COC Grade \/ No\.)([\s\S]{0,1000}?)(?:Medical|Section 11|11\.|$)/i);
  const cocScope = cocScopeMatch ? cocScopeMatch[0] : t;

  // Passport scope: from "7. Passport No." to "8 a. NOK Address"
  const passportScopeMatch = t.match(/(?:7\.\s+Passport\s*No\.?)[\s\S]{0,1000}?(?=8\s*a\.|9\.\s|Section VI|$)/i);
  const passportScope = passportScopeMatch ? passportScopeMatch[0] : sfScope;

  // CDC scope: from "6. CDC No." up to Medical section to catch scattered expiry
  const cdcScopeMatch = t.match(/(?:6\.\s+CDC\s*No\.?)[\s\S]{0,1500}?(?=Details of Medical|Section 11|11\.\s|Section VI|$)/i);
  const cdcScope = cdcScopeMatch ? cdcScopeMatch[0] : sfScope;

  // ── Seafarer Identity ──────────────────────────────────────────────────
  const fullName = extract(sfScope, [
    /1\.\s+Name[:\s]+([A-Z][A-Z .]{3,})/im,
    /(?:Full\s*Name|Seafarer['s]?\s*Name|Name of Seafarer)[:\s]+([A-Z][A-Z .]{3,})/im,
  ]);

  if (fullName) {
    result.seafarerName = fullName;
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      result.firstName = parts.slice(0, -1).join(' ');
      result.lastName = parts[parts.length - 1];
    } else {
      result.firstName = fullName;
      result.lastName = '';
    }
  }

  result.rank = extract(t, [
    /(?:Capacity\s*\/\s*Rank\s*Employed|Rank|Designation)[:\s]+([A-Za-z0-9][A-Za-z0-9 .()/-]{2,})/im,
    /2\.\s+Capacity[:\s]+([A-Za-z0-9][A-Za-z0-9 .()/-]{2,})/im,
  ]) || '';

  result.nationality = extract(sfScope, [
    /Nationality\s*:\s*([A-Za-z][A-Za-z]+)/i,
    /2\.\s+Nationality[:\s]+([A-Za-z][A-Za-z]{2,})/im,
    /3\.\s+Nationality[:\s]+([A-Za-z][A-Za-z]{2,})/im,
  ]) || '';

  const dobPlace = extract(sfScope, [
    /(?:Date\s*(?:&|and)\s*Pla[cs]e of Birth|DOB)[:\s]+([^:\n]{5,100})/im,
    /(?:3|4)\.\s+Date\s*&\s*Pla[cs]e of Birth[:\s]+([^:\n]{5,100})/im,
  ]);
  if (dobPlace) {
    result.seafarerDatePlaceOfBirth = dobPlace;
    const dobMatch = dobPlace.match(/(\d{1,2}[-/ .]\w+[-/ .]\d{4}|\d{4}-\d{2}-\d{2})/);
    if (dobMatch) result.dateOfBirth = dobMatch[1];
  }

  result.email = extract(sfScope, [
    /Email\s*:\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-+\\x20]+\.[a-zA-Z]{2,})/i,
    /(?:Email|E-mail)[:\s]*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/im,
  ]) || '';

  result.phoneNumber = extract(sfScope, [
    /(?:Tel|Telephone|Mobile|Cell|Phone)[:\s]*([\d+\-() ]{7,20})/im,
  ]) || '';

  result.seafarerIndosNumber = extract(sfScope, [
    /(?:INDoS|INDOS|INDoS\s*No\.?)[:\s]+([A-Za-z0-9]{8,15})/im,
    /(?:4|5)\.\s+INDoS\s*No\.?[:\s]+([A-Za-z0-9]{8,15})/im,
  ]) || '';

  // Generic document number extraction for miscellaneous types (like COE)
  result.documentNumber = extract(t, [
    /(?:Endorsement|Certificate|Document|COE|Ref)\s*(?:No\.?|Number)[:\s]*([A-Z0-9\-\/]{5,})/i,
    /No\.?\s*:\s*([A-Z0-9\-\/]{5,})/i,
  ]) || '';

  // ── Next of Kin (NOK) / Emergency Contact ──────────────────────────────
  result.emergencyContactName = extract(nokScope, [
    /(?:Name|Full\s*Name)[:\s]*([A-Z][A-Z .]{3,})/i,
    /Name[\s:]*\n?([A-Z][A-Z .]{3,})/im,
  ]) || '';

  result.emergencyContactRelationship = extract(nokScope, [/(?:Relationship|Relation)[:\s]*([A-Za-z]{3,})/im]) || '';

  // Extract phone/email from nokScope strictly to avoid mixing with Seafarer's
  result.emergencyContactPhone = extract(nokScope, [
    /(?:NOK's Postal Address|Address)[\s\S]{0,300}?(?:Tel|Mobile|Phone|Contact|Tel\.?\s*No\.?|Mobile\.?|Cell)[:\s]+([\d+\-() ]{7,20})/im,
    /(?:Tel|Mobile|Phone|Contact|Tel\.?\s*No\.?|Mobile\.?|Cell)[:\s]+([\d+\-() ]{7,20})/im,
    /Tel No\.?[:\s]*([\d+\-() ]{7,20})/im,
    /Mobile[:\s]*([\d+\-() ]{7,20})/im,
  ]) || '';

  result.emergencyContactEmail = extract(nokScope, [
    /(?:NOK|Kin)[\s\S]{0,500}?(?:Email|e-Mail)[:\s]*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
    /(?:Email|e-Mail)[:\s]*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
    /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/
  ]) || '';

  // Extract NOK Address searching strictly after the NOK Name section
  let nokAddressRaw = '';
  // The address often follows "NOK's Postal Address" or just appears as a block with a PIN near the end
  const addressBlockMatch = nokScope.match(/(?:8\s*a\.\s*)?NOK's Postal Address[\s\S]{0,500}?(?:[:\s])([\s\S]{20,500}?(?:PIN(?: CODE)?[:\s-]*\d{6}|[A-Z]{3,}\s+INDIA))/im);

  if (addressBlockMatch) {
    nokAddressRaw = addressBlockMatch[1];
  } else {
    // Fallback: search for any block with PIN in the NOK scope, but try to avoid the Seafarer address
    const pinMatches = Array.from(nokScope.matchAll(/([\s\S]{20,300}?(?:PIN(?: CODE)?[:\s-]*\d{6}|[A-Z]{3,}\s+INDIA))/gim));
    if (pinMatches.length > 0) {
      // If there are multiple, the one following "NOK" or "8 a." is usually correct.
      // We pick the last one if it's near the end of our scope which is usually NOK.
      nokAddressRaw = pinMatches[pinMatches.length - 1][1];
    }
  }

  if (nokAddressRaw) {
    result.emergencyContactPostalAddress = nokAddressRaw
      .split('\n')
      .map(line => line.trim())
      .filter(line => {
        const l = line.toLowerCase();
        // Skip purely label lines
        if (l === 'name' || l === 'relationship' || l === 'address' || l === 'mobile' || l === 'e-mail' || l === 'email' || l === 'tel no.' || l === 'pin code') return false;
        // Skip key-value lines (usually capture noise) except for PIN:
        if (l.includes(':') && !l.includes('pin')) return false;
        // Skip lines containing these keywords anywhere (noise)
        if (l.includes('passport') || l.includes('cdc no') || l.includes('iso') || l.includes('date') || l.includes('relationship')) return false;
        // Skip NOK Name line (often starts with title)
        if (l.startsWith('mr.') || l.startsWith('mrs.') || l.startsWith('ms.') || l.startsWith('shri') || l.startsWith('name ')) return false;
        // Skip lines that are just section numbers
        if (l.match(/^(?:7|8|9|10|11)\./) || l.match(/^[0-9]\s/)) return false;
        return line.length > 5;
      })
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // ── Passport Details ───────────────────────────────────────────────────
  result.passportNumber = extract(passportScope, [
    /Passport\s*No\.?[:\s]+([A-Za-z]{1,2}\d{6,9})/i,
    /7\.\s+Passport\s*No\.?[:\s]+([A-Za-z]{1,2}\d{6,9})/i,
  ]) || '';

  result.passportPlaceOfIssue = extract(passportScope, [
    /(?:Issue[d]?\s*at|Place\s*of\s*Issue)[:\s]+([A-Z][A-Z ]{3,})/im,
  ]) || '';

  result.cdcNumber = extract(cdcScope, [
    /CDC\s*No\.?[\s\S]{0,100}?([A-Za-z0-9]{2,4}\s?\d{4,10})/i,
    /6\.\s+CDC\s*No\.?[\s\S]{0,100}?([A-Za-z0-9]{2,4}\s?\d{4,10})/i,
  ]) || '';

  result.cdcPlaceOfIssue = extract(cdcScope, [
    /(?:Issue[d]?\s*at|Place\s*of\s*Issue)[:\s]+(?:\d+\s+|[A-Z]{3}\s+\d+\s+)?([A-Za-z][A-Za-z ]{3,})/im,
  ]) || '';

  // Handle Interleaved CDC/Passport Dates
  // Limit scope to end before Section 9 (COC) to avoid picking up irrelevant dates
  const cdcStart = t.indexOf('6. CDC No.');
  const cocStart = t.indexOf('9. Details of Competency Certificates');
  const dateExtractionScope = cocStart !== -1 ? t.substring(cdcStart, cocStart) : t.substring(cdcStart);

  const allExpiries = Array.from(dateExtractionScope.matchAll(/(?:Expiry|Expiration|Valid\s*Till)(?:\s*Date)?[:\s]*[\s\S]{0,10}?(?:\n|^)?(\d{1,2}[-/ .]\w+[-/ .]\d{2,4})/gim)).map(m => ({ val: m[1], idx: m.index }));
  const allIssues = Array.from(dateExtractionScope.matchAll(/(?:Issue\s*Date|Date\s*of\s*Issue)[:\s]*[\s\S]{0,10}?(?:\n|^)?(\d{1,2}[-/ .]\w+[-/ .]\d{2,4})/gim)).map(m => ({ val: m[1], idx: m.index }));

  const getYear = (d: string) => {
    const m = d?.match(/\d{4}/);
    return m ? parseInt(m[0]) : 0;
  };

  const cdcHeader = dateExtractionScope.indexOf('6. CDC No.');
  const passHeader = dateExtractionScope.indexOf('7. Passport No.');

  // Assign issues first based on proximity to headers
  allIssues.sort((a, b) => a.idx - b.idx).forEach(issue => {
    if (Math.abs(issue.idx - cdcHeader) < Math.abs(issue.idx - passHeader) || passHeader === -1) {
      if (!result.cdcIssueDate) result.cdcIssueDate = issue.val;
    } else if (passHeader !== -1) {
      if (!result.passportIssueDate) result.passportIssueDate = issue.val;
    }
  });

  // Assign expiries based on 10-year rule relative to the issues
  const usedExpiries = new Set<number>();

  // Try CDC pairing first
  if (result.cdcIssueDate) {
    const issueYear = getYear(result.cdcIssueDate as string);
    // Prefer match that is ~10 years after issue (± 2 years for flexibility)
    const match = allExpiries
      .filter(exp => !usedExpiries.has(exp.idx))
      .map(exp => ({ exp, drift: Math.abs(getYear(exp.val) - issueYear - 10) }))
      .sort((a, b) => a.drift - b.drift)[0]?.exp;

    if (match && Math.abs(getYear(match.val) - issueYear - 10) <= 2) {
      result.cdcExpiryDate = match.val;
      usedExpiries.add(match.idx);
    }
  }

  // Try Passport pairing next
  if (result.passportIssueDate) {
    const issueYear = getYear(result.passportIssueDate as string);
    const match = allExpiries
      .filter(exp => !usedExpiries.has(exp.idx))
      .map(exp => ({ exp, drift: Math.abs(getYear(exp.val) - issueYear - 10) }))
      .sort((a, b) => a.drift - b.drift)[0]?.exp;

    if (match && Math.abs(getYear(match.val) - issueYear - 10) <= 2) {
      result.passportExpiryDate = match.val;
      usedExpiries.add(match.idx);
    }
  }

  // Final fallback for any remaining missing expiries - strictly within this limited scope
  const remainingExpiries = allExpiries.filter(exp => !usedExpiries.has(exp.idx));
  if (!result.cdcExpiryDate && remainingExpiries[0]) result.cdcExpiryDate = remainingExpiries[0].val;
  if (!result.passportExpiryDate && (remainingExpiries[1] || remainingExpiries[0])) {
    result.passportExpiryDate = (remainingExpiries[1] || remainingExpiries[0]).val;
  }

  // ── COC Details ────────────────────────────────────────────────────────
  result.cocGradeNo = extract(cocScope, [
    /COC Grade \/ No\.[\s:]*\n?([A-Za-z][A-Za-z0-9/() .-]+)/im,
    /(?:COC\s*(?:Grade|No\.?|Number)|Grade\s*of\s*Certificate)[:\s]+([A-Za-z][A-Za-z0-9/() .-]+)/im,
    /9\.\s+Grade\s*of\s*Cert\.?[:\s]+([A-Za-z0-9/() .-]+)/im,
  ]) || '';

  result.cocPlaceOfIssue = extract(cocScope, [
    /(?:Issue[d]?\s*at|Place\s*of\s*Issue)[:\s]+(?:\d+\s+|[A-Z]{3}\s+\d+\s+)?(MMD\([A-Z]\)|[A-Za-z][A-Za-z ]{3,})/im,
  ]) || '';

  result.cocIssueDate = extract(cocScope, [
    /(?:Issue\s*Date|Date\s*of\s*Issue)[:\s]+(\d{1,2}[-/ .]\w+[-/ .]\d{2,4})/im,
  ]) || '';

  result.cocExpiryDate = extract(cocScope, [
    /(?:Expiry|Expiration|Valid\s*Till|Date\s*of\s*Expiry)[:\s]+(\d{1,2}[-/ .]\w+[-/ .]\d{2,4})/im,
  ]) || '';

  // ── Medical Details ────────────────────────────────────────────────────
  // In some documents (like AOA), labels are listed first, then values follow in a block.
  // We try to find the authority name specifically by looking for typical names/centers.
  const medicalIssuingAuthority = extract(medicalScope, [
    /((?:DR\.|MR\.|MRS\.|SHRI)[\s\S]{10,200}?(?:DIAGNOSTIC CENTRE|CLINIC|HOSPITAL|CENTRE|MEDICAL|HEALTHCARE)[)]?)/i,
    /([A-Z. ]+(?:DIAGNOSTIC CENTRE|CLINIC|HOSPITAL|CENTRE|MEDICAL|HEALTHCARE|DR\.)[\s\S]{5,100}?(?=[)]?\s*\n\d|\nApproval|:|$))/i,
    /(?:Issuing Authority|Doctor|Approved by)[\s:]*(?:\n[^:\n]+){0,5}?\n([A-Z][A-Z . ()\n]{5,100})(?=\n|$)/im,
  ]);

  if (medicalIssuingAuthority) {
    // Clean up: remove header garbage if it got caught
    result.medicalIssuingAuthority = medicalIssuingAuthority
      .replace(/Details of Medical Certificate|Section 11|11\./gi, '')
      .replace(/Issuing Authority|Doctor|Approved by|Date of Issue|Date of Expiry|Approval No/gi, '')
      .trim();
  } else {
    result.medicalIssuingAuthority = '';
  }

  result.medicalApprovalNo = extract(medicalScope, [
    /([A-Z]{3}\/[A-Z]{3}\/\d{1,4}\/\d{4})/i, // Specific pattern: MAH/MUM/327/2023
    /Approval No\.?\s+([A-Z0-9/.-]{3,})/i,
    /(?:Approval\s*No\.?|Cert\s*No\.?)[:\s]+([A-Za-z0-9/.-]{3,})/im,
  ]) || '';

  result.medicalIssueDate = extract(medicalScope, [
    /Issue Date:?\s*(\d{1,2}[-/.][A-Z]{3}[-/.][\d]{4})/i,
    /(\d{1,2}[-/.][A-Z]{3}[-/.][\d]{4})\s+Approval No/i,
    /(\d{1,2}[-/.][A-Z]{3}[-/.][\d]{4})(?=\s+Approval No)/i,
    /(?:Issue\s*Date|Date\s*of\s*Issue)[:\s]+(\d{1,2}[-/ .]\w+[-/ .]\d{2,4})/im,
  ]) || '';

  result.medicalExpiryDate = extract(medicalScope, [
    /Expiry Date:?\s*(\d{1,2}[-/.][A-Z]{3}[-/.][\d]{4})/i,
    /Expiry Date[:\s]*(\d{1,2}[-/ .]\w+[-/ .]\d{2,4})/i,
    /(?:Expiry|Expiration|Valid\s*Till)[:\s]+(\d{1,2}[-/ .]\w+[-/ .]\d{2,4})/im,
  ]) || '';

  // ── Employment Terms (for auto-filling) ────────────────────────────────
  const empScopeMatch = t.match(/(?:Details of Employment|Section VI)([\s\S]{0,2000}?)(?:Additional terms|Section VII|Confirmation|VIII\.)/i);
  const empScope = empScopeMatch ? empScopeMatch[1] : t;

  const jd = extract(t, [
    /(?:Date of (?:Joining|Commencement|Sign[-\s]?on)|Join\s*Date|Sign[-\s]?on\s*Date|Port of (?:Joining|Engagement|Embarkation)\s*(?:Date)?)[:\s]+(\d{1,2}[-/. ]\w+[-/. ]\d{2,4}|\d{2,4}[-/.]\d{2}[-/.]\d{2,4})/im,
    /Dated[:\s]*(\d{1,2}[-/. ]\w+[-/. ]\d{2,4})/im,
    /Date\s*[:\s]*(\d{1,2}[-/. ]\w+[-/. ]\d{2,4})/im,
  ]);
  if (jd) {
    result.contractStartDate = jd;
  }

  const engagement = extract(empScope, [
    /(?:Engagement Period)[:\s]+(\d{1,2})/im,
    /(?:Period of (?:Employment|Engagement|Service)|Duration)[:\s]+(\d{1,2})\s*(?:month|Months?)/im,
  ]);
  if (engagement) result.engagementPeriodMonths = parseInt(engagement, 10);

  // Strip empty string values to keep the response clean
  for (const key of Object.keys(result)) {
    if (result[key] === '' || result[key] === undefined) {
      delete result[key];
    }
  }

  // Include metadata
  result.serviceOrigin = 'Google Document AI';
  result.rawText = t;

  return result;
}

export const googleOcrService = {
  isAvailable(): boolean {
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
    if (!processorId || processorId === 'REPLACE_WITH_YOUR_PROCESSOR_ID') return false;
    return !!(
      process.env.DOCUMENT_AI_PROJECT_ID &&
      process.env.DOCUMENT_AI_LOCATION &&
      (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CREDENTIALS_CONTENT)
    );
  },

  async extractCrewDataFromDocument(
    base64Image: string,
    filename: string,
    expectedType?: string
  ): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('Google Document AI credentials are not fully configured.');
    }

    try {
      console.log(`[Google Document AI] Starting extraction for ${filename} (type: ${expectedType || 'aoa'})...`);

      const projectId = process.env.DOCUMENT_AI_PROJECT_ID!;
      const location = process.env.DOCUMENT_AI_LOCATION!;
      const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID!;
      const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;

      let client: DocumentProcessorServiceClient;
      if (process.env.GOOGLE_CREDENTIALS_CONTENT) {
        console.log('[Google Document AI] Using credentials from GOOGLE_CREDENTIALS_CONTENT');
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_CONTENT);
        client = new DocumentProcessorServiceClient({ credentials });
      } else {
        const keyFilename = resolveCredentialsPath()!;
        console.log(`[Google Document AI] Using credentials from file: ${keyFilename}`);
        client = new DocumentProcessorServiceClient({ keyFilename });
      }

      const base64Data = base64Image.includes('base64,')
        ? base64Image.split('base64,')[1]
        : base64Image;

      const lowerName = filename.toLowerCase();
      const mimeType = lowerName.endsWith('.pdf')
        ? 'application/pdf'
        : lowerName.endsWith('.png')
          ? 'image/png'
          : lowerName.endsWith('.webp')
            ? 'image/webp'
            : lowerName.endsWith('.tiff') || lowerName.endsWith('.tif')
              ? 'image/tiff'
              : 'image/jpeg';

      const [result] = await client.processDocument({
        name: processorName,
        rawDocument: { content: base64Data, mimeType },
      });

      const text = result.document?.text || '';
      if (!text) {
        throw new Error('Google Document AI returned no text. Ensure the document is clear and the processor is of type "Document OCR".');
      }

      console.log(`[Google Document AI] Raw text extracted. Length: ${text.length} chars. Parsing AOA fields...`);
      const sanitizedFn = (filename || 'doc').replace(/[^a-zA-Z0-9]/g, '_');
      const debugFileName = `ocr_debug_${sanitizedFn}_${Date.now()}.txt`;
      fs.writeFileSync(path.join(process.cwd(), debugFileName), text);
      console.log(`[OCR-DEBUG] Detailed text saved to: ${debugFileName}`);

      const extractedData = parseAoaFields(text);

      const fieldCount = Object.keys(extractedData).filter(k => k !== 'rawText' && k !== 'serviceOrigin').length;
      console.log(`[Google Document AI] Parsed ${fieldCount} fields from document.`);

      console.log('[OCR-EXTRACT] Successfully extracted data structure.');
      return extractedData;
    } catch (error: any) {
      console.error('[OCR-CRITICAL-ERROR] Google Document AI failed:', {
        message: error.message,
        code: error.code,
        details: error.details,
        filename: filename
      });
      throw error;
    }
  },

  /**
   * Extract crew list from an attendance sheet image.
   * (Used by attendanceRoutes.ts)
   */
  async extractAttendanceData(
    base64Data: string,
    filename: string
  ): Promise<{ crew: Array<{ name: string; rank: string; nationality?: string; joinDate?: string; expiryDate?: string; cocNotApplicable?: boolean }> }> {
    if (!this.isAvailable()) {
      throw new Error('Google Document AI credentials are not fully configured.');
    }

    try {
      console.log(`[Google Document AI] Extracting attendance data from ${filename}...`);

      const projectId = process.env.DOCUMENT_AI_PROJECT_ID!;
      const location = process.env.DOCUMENT_AI_LOCATION!;
      const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID!;
      const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;

      let client: DocumentProcessorServiceClient;
      if (process.env.GOOGLE_CREDENTIALS_CONTENT) {
        console.log('[Google Document AI] Using credentials from GOOGLE_CREDENTIALS_CONTENT for attendance');
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_CONTENT);
        client = new DocumentProcessorServiceClient({ credentials });
      } else {
        const keyFilename = resolveCredentialsPath()!;
        client = new DocumentProcessorServiceClient({ keyFilename });
      }

      const base64Image = base64Data.includes('base64,')
        ? base64Data.split('base64,')[1]
        : base64Data;

      const lowerFn = (filename || '').toLowerCase();
      const mimeType = lowerFn.endsWith('.pdf')
        ? 'application/pdf'
        : lowerFn.endsWith('.png')
          ? 'image/png'
          : lowerFn.endsWith('.webp')
            ? 'image/webp'
            : lowerFn.endsWith('.tiff') || lowerFn.endsWith('.tif')
              ? 'image/tiff'
              : 'image/jpeg';

      const [result] = await client.processDocument({
        name: processorName,
        rawDocument: { content: base64Image, mimeType },
      });

      const text = result.document?.text || '';
      if (!text) return { crew: [] };

      // Parse each line as a potential crew row: NAME | RANK | DATE | DATE
      const crew: Array<{ name: string; rank: string; nationality?: string; joinDate?: string; expiryDate?: string }> = [];
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
      const dateRx = /\d{2}[-/]\d{2}[-/]\d{2,4}/;

      for (const line of lines) {
        const parts = line.split(/\s{2,}|\t/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2 && /^[A-Z]/.test(parts[0]) && parts[0].split(' ').length >= 2) {
          const entry: any = { name: parts[0], rank: parts[1] || '' };
          const dates = parts.filter(p => dateRx.test(p));
          if (dates[0]) entry.joinDate = dates[0];
          if (dates[1]) entry.expiryDate = dates[1];
          if (parts[2] && !dateRx.test(parts[2])) entry.nationality = parts[2];
          crew.push(entry);
        }
      }

      console.log(`[Google Document AI] Attendance extraction complete. Found ${crew.length} crew members.`);
      return { crew };
    } catch (error) {
      console.error('[Google Document AI] Attendance extraction error:', error);
      throw error;
    }
  },
};
