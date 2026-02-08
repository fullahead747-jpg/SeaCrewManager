---
title: SeaCrewManager
emoji: 🚢
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
app_port: 7860
---

# SeaCrewManager 🚢


A comprehensive crew management system for maritime operations, designed to streamline crew documentation, vessel assignments, and compliance tracking.

## Features

✨ **Crew Management**
- Complete crew member profiles with personal details
- Document management (Passports, CDC, Medical Certificates, COC, etc.)
- Automated expiry tracking and notifications
- Photo management and verification

🚢 **Vessel Operations**
- Multi-vessel fleet management
- Crew assignment and rotation tracking
- Contract management and status monitoring
- Vessel-specific crew rosters

📄 **Document Intelligence**
- AI-powered OCR for automatic document data extraction
- Multi-engine OCR (Groq, Gemini, OCR.space) for maximum accuracy
- Automated document verification and validation
- Expiry date tracking and alerts

📧 **Notifications**
- Email notifications for expiring documents
- Automated crew detail reports
- Customizable notification preferences

🤖 **AI Assistant**
- Natural language chatbot for crew queries
- Quick access to crew and vessel information
- Voice-enabled interactions

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL with Drizzle ORM
- **OCR**: Groq AI, Google Gemini, OCR.space
- **UI**: Tailwind CSS + shadcn/ui components

## Setup Instructions

### Environment Variables

This application requires the following environment variables to be configured in the Hugging Face Space settings:

#### Required
- `DATABASE_URL` - PostgreSQL connection string (use external database like Neon or Supabase)
- `NODE_ENV` - Set to `production`
- `PORT` - Set to `7860` (Hugging Face standard)

#### OCR Services (at least one required)
- `GROQ_API_KEY` - Groq API key for OCR
- `GEMINI_API_KEY` - Google Gemini API key for enhanced OCR
- `OCR_SPACE_API_KEY` - OCR.space API key for fallback

#### Optional
- `GMAIL_USER` - Gmail address for email notifications
- `GMAIL_APP_PASSWORD` - Gmail app password for SMTP
- `DISABLE_EMAIL_NOTIFICATIONS` - Set to `true` to disable email features
- `DISABLE_WHATSAPP_NOTIFICATIONS` - Set to `true` to disable WhatsApp features

### Database Setup

1. Create a free PostgreSQL database at [Neon](https://neon.tech) or [Supabase](https://supabase.com)
2. Copy the connection string
3. Add it as `DATABASE_URL` in Space settings
4. The application will automatically run migrations on startup

### Getting API Keys

- **Groq**: Sign up at [console.groq.com](https://console.groq.com)
- **Gemini**: Get API key at [aistudio.google.com](https://aistudio.google.com/app/apikey)
- **OCR.space**: Register at [ocr.space/ocrapi](https://ocr.space/ocrapi)

## Usage

1. **Login**: Use the default admin credentials or create a new account
2. **Add Crew**: Navigate to Crew section and add crew members
3. **Upload Documents**: Upload crew documents with automatic OCR extraction
4. **Assign to Vessels**: Create vessels and assign crew members
5. **Monitor Compliance**: Track document expiries and receive notifications

## Support

For issues or questions, please contact the system administrator.

## License

MIT License - See LICENSE file for details

---

**Note**: This is a production deployment on Hugging Face Spaces. The application is containerized using Docker and runs on Node.js 20.
