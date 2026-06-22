import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { googleOcrService } from './server/googleOcrService';

async function main() {
  const pdfPath = path.join(process.cwd(), 'uploads', 'CONTRACT - SAURABH DIPANKAR - doc.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`File not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log(`File size: ${fs.statSync(pdfPath).size} bytes`);
  console.log(`Google DocAI available: ${googleOcrService.isAvailable()}`);
  console.log('\nRunning OCR on CONTRACT PDF...\n');

  try {
    const fileBuffer = fs.readFileSync(pdfPath);
    const base64Content = fileBuffer.toString('base64');
    
    const result = await googleOcrService.extractCrewDataFromDocument(
      base64Content,
      'CONTRACT - SAURABH DIPANKAR - doc.pdf',
      'aoa'
    );

    console.log('\n===== EXTRACTED FIELDS =====');
    const { rawText, serviceOrigin, ...fields } = result as any;
    console.log(JSON.stringify(fields, null, 2));

    if (rawText) {
      console.log(`\n===== RAW TEXT (first 3000 chars) =====`);
      console.log(rawText.substring(0, 3000));
    }
  } catch (err: any) {
    console.error('\n===== OCR FAILED =====');
    console.error('Error:', err.message);
    console.error('Code:', err.code);
    console.error('Details:', err.details);
  }

  process.exit(0);
}

main();
