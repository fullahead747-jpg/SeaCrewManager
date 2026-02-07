# OCR.space API Setup Guide

## Getting Your Free API Key

1. **Sign up at OCR.space**
   - Visit: https://ocr.space/ocrapi
   - Click "Register for free API key"
   - Fill in your email address
   - No credit card required!

2. **Get Your API Key**
   - Check your email for the API key
   - You'll receive a key that looks like: `K12345678901234`

3. **Add API Key to Your Environment**

   ### For Local Development:
   Create or update `.env` file in the project root:
   ```
   OCR_SPACE_API_KEY=your_api_key_here
   ```

   ### For Replit Deployment:
   1. Open your Replit project
   2. Click on "Secrets" (lock icon) in the left sidebar
   3. Add a new secret:
      - Key: `OCR_SPACE_API_KEY`
      - Value: `your_api_key_here`
   4. Click "Add new secret"

## Free Tier Limits

- **25,000 requests per month** - FREE forever
- No credit card required
- Perfect for crew management systems
- Automatic fallback to local Tesseract if limit exceeded

## How It Works

1. User uploads a document (PDF or image)
2. System tries OCR.space first (cloud-based, accurate)
3. If OCR.space fails or unavailable, falls back to local Tesseract
4. Extracted data is stored in scanned_documents table
5. Future edits are validated against scanned data

## Supported Documents

- ✅ Passport
- ✅ CDC (Continuous Discharge Certificate)
- ✅ COC (Certificate of Competency)
- ✅ Medical Certificate
- ✅ Any other document with text

## Testing

After adding the API key:
1. Restart your server
2. Upload a CDC or Passport document
3. Check server logs for `[OCR.space]` messages
4. Verify data in scanned_documents table

## Troubleshooting

**If OCR.space doesn't work:**
- Check if API key is set correctly
- Verify internet connection
- Check server logs for error messages
- System will automatically fall back to local Tesseract

**If you see "OCR.space API key not configured":**
- API key is not set in environment variables
- System is using local Tesseract OCR instead
- This is fine, but OCR.space is more accurate for scanned PDFs
