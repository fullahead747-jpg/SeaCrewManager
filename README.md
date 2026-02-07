# SeaCrewManager

Maritime crew management system with document tracking and OCR scanning.

## Deployment

This application is deployed on Render.com.

### Environment Variables Required

- `DATABASE_URL` - CockroachDB connection string
- `GROQ_API_KEY` - Groq API key for OCR
- `GEMINI_API_KEY` - Gemini API key for OCR
- `OCR_SPACE_API_KEY` - OCR Space API key
- `NODE_ENV` - Set to `production`
- `DISABLE_EMAIL_NOTIFICATIONS` - Set to `true`
- `DISABLE_WHATSAPP_NOTIFICATIONS` - Set to `true`

## Features

- Vessel management
- Crew management
- Document upload and verification
- Multi-engine OCR scanning (Groq, Gemini, OCR.space)
- Expiry date tracking
- Status badges

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- Database: CockroachDB (PostgreSQL)
- OCR: Groq API, Gemini API, OCR.space API
