# CrewTrack Pro - Production Deployment

This directory contains the production-ready version of CrewTrack Pro.

## Quick Start

1. Upload all files to your hosting server
2. Copy .env.example to .env and configure your database
3. Run: npm install --production
4. Run: npm run db:push
5. Start: npm start

## Files Included

- server/ - Backend Node.js application
- dist/ - Frontend React application (built)
- shared/ - Shared schema and types
- package.json - Production dependencies only
- .env.example - Environment configuration template

## Database Setup

This application requires PostgreSQL. Update your .env file with your database credentials.

## For detailed deployment instructions, see DEPLOYMENT_GUIDE.md
