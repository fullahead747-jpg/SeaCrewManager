import { googleOcrService } from './server/googleOcrService';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function run() {
  const pdfPath = './uploads/CONTRACT - SAURABH DIPANKAR - doc.pdf';
  console.log(`Reading PDF from: ${pdfPath}`);
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`Error: File not found at ${pdfPath}`);
    return;
  }

  const fileBuffer = fs.readFileSync(pdfPath);
  const base64Data = fileBuffer.toString('base64');
  
  console.log('Running Google Document AI OCR...');
  try {
    const result = await googleOcrService.extractCrewDataFromDocument(
      base64Data,
      'CONTRACT - SAURABH DIPANKAR - doc.pdf',
      'aoa'
    );
    console.log('\n--- OCR Parsing Results ---');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error running OCR:', error);
  }
}

run();
