import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
}

export class OCRService {
  async extractCrewDataFromDocument(base64Image: string): Promise<ExtractedCrewData> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting crew member information from maritime documents and contracts. 
            Analyze the document image and extract all relevant crew member information. 
            Focus on finding: name, position/rank, nationality, dates of birth, passport numbers, seaman's book numbers, CDC numbers, contact information, contract dates, vessel information, and salary details.
            
            IMPORTANT: Also extract Ship Owner Details from Section II "Details of Ship Owner" including:
            - shipOwnerName: The ship owner company name (e.g., "GLOBAL CAMBAY MARINE SERVICES PVT. LTD")
            - shipOwnerContactPerson: The contact person name (e.g., "MR. ZOHAR AMALAMPATTIWALA")
            - shipOwnerPostalAddress: The full postal address and email if available
            
            Return the data in JSON format with the exact field names specified. If a field is not found or unclear, omit it from the response.
            Be very careful with dates - format them as YYYY-MM-DD if possible.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all crew member information from this maritime document. Return only valid JSON with the available data."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const extractedData = JSON.parse(response.choices[0].message.content || "{}");
      
      // Clean and validate the extracted data
      const cleanedData: ExtractedCrewData = {};
      
      if (extractedData.name) cleanedData.name = String(extractedData.name).trim();
      if (extractedData.position) cleanedData.position = String(extractedData.position).trim();
      if (extractedData.nationality) cleanedData.nationality = String(extractedData.nationality).trim();
      if (extractedData.dateOfBirth) cleanedData.dateOfBirth = String(extractedData.dateOfBirth).trim();
      if (extractedData.passportNumber) cleanedData.passportNumber = String(extractedData.passportNumber).trim();
      if (extractedData.seamansBookNumber) cleanedData.seamansBookNumber = String(extractedData.seamansBookNumber).trim();
      if (extractedData.cdcNumber) cleanedData.cdcNumber = String(extractedData.cdcNumber).trim();
      if (extractedData.phoneNumber) cleanedData.phoneNumber = String(extractedData.phoneNumber).trim();
      if (extractedData.email) cleanedData.email = String(extractedData.email).trim();
      if (extractedData.emergencyContact) cleanedData.emergencyContact = String(extractedData.emergencyContact).trim();
      if (extractedData.emergencyPhone) cleanedData.emergencyPhone = String(extractedData.emergencyPhone).trim();
      if (extractedData.contractStartDate) cleanedData.contractStartDate = String(extractedData.contractStartDate).trim();
      if (extractedData.contractEndDate) cleanedData.contractEndDate = String(extractedData.contractEndDate).trim();
      if (extractedData.joinDate) cleanedData.joinDate = String(extractedData.joinDate).trim();
      if (extractedData.leaveDate) cleanedData.leaveDate = String(extractedData.leaveDate).trim();
      if (extractedData.vessel) cleanedData.vessel = String(extractedData.vessel).trim();
      if (extractedData.salary) cleanedData.salary = String(extractedData.salary).trim();
      // Ship Owner Details
      if (extractedData.shipOwnerName) cleanedData.shipOwnerName = String(extractedData.shipOwnerName).trim();
      if (extractedData.shipOwnerContactPerson) cleanedData.shipOwnerContactPerson = String(extractedData.shipOwnerContactPerson).trim();
      if (extractedData.shipOwnerPostalAddress) cleanedData.shipOwnerPostalAddress = String(extractedData.shipOwnerPostalAddress).trim();

      return cleanedData;
    } catch (error) {
      console.error("OCR extraction error:", error);
      throw new Error("Failed to extract data from document. Please try again or enter the information manually.");
    }
  }
}

export const ocrService = new OCRService();