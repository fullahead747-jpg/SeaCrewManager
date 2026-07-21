export interface IOcrEngine {
  /**
   * Extracts data from a document image or PDF.
   * @param base64Content The base64 encoded content of the file.
   * @param fileName The name of the file being processed.
   * @param documentType The expected type of the document (e.g., 'passport', 'sid', 'medical').
   * @returns A promise that resolves to the raw extracted data.
   */
  extractData(
    base64Content: string,
    fileName: string,
    documentType: string
  ): Promise<any>;

  /**
   * Checks if the OCR engine is available and properly configured.
   */
  isAvailable(): boolean;
}
