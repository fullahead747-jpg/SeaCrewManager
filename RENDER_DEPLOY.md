# Render.com Deployment - Quick Start

## Step 1: Go to Render.com
Visit: https://render.com and sign up with GitHub (free, no credit card required)

## Step 2: Create Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `SeaCrewManager`
3. Render will auto-detect `render.yaml`

## Step 3: Add Environment Variables

Add these in the Render dashboard (get values from your local `.env` file):

- `DATABASE_URL` - Your CockroachDB connection string
- `GROQ_API_KEY` - Your Groq API key  
- `GEMINI_API_KEY` - Your Gemini API key
- `OCR_SPACE_API_KEY` - Your OCR Space API key

## Step 4: Deploy!

Click **"Create Web Service"** and wait 3-5 minutes.

Your app will be live at: `https://sea-crew-manager.onrender.com`

## Notes

- Free tier spins down after 15 minutes of inactivity
- First request after spin down takes ~30 seconds
- All your vessels and crew data will be visible!
