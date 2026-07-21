import { IOcrEngine } from '../ocr-engine.interface';
import { googleOcrService } from '../../googleOcrService';

/**
 * Wrapper for the existing Google Document AI service
 * implementing the standard IOcrEngine interface.
 */
export class GoogleOcrEngine implements IOcrEngine {
  async extractData(
    base64Content: string,
    fileName: string,
    documentType: string
  ): Promise<any> {
    // Under the hood, this uses Google Document AI with a local Tesseract fallback.
    return googleOcrService.extractCrewDataFromDocument(
      base64Content,
      fileName,
      documentType
    );
  }

  isAvailable(): boolean {
    return googleOcrService.isAvailable();
  }
}

// Export a singleton instance for easy use
export const googleOcrEngine = new GoogleOcrEngine();
