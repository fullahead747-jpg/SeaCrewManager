#!/bin/bash

# ========================================
# Vercel Deployment Script for SeaCrewManager
# ========================================

echo "🚀 Starting Vercel Deployment Process..."
echo ""

# Check if Git is installed
echo "📋 Checking prerequisites..."
if command -v git &> /dev/null; then
    echo "✅ Git is installed"
else
    echo "❌ Git is not installed. Please install Git first"
    exit 1
fi

# Check if Node.js is installed
if command -v node &> /dev/null; then
    echo "✅ Node.js is installed"
else
    echo "❌ Node.js is not installed. Please install Node.js first"
    exit 1
fi

echo ""

# Step 1: Initialize Git repository if not already done
echo "📦 Step 1: Setting up Git repository..."
if [ ! -d ".git" ]; then
    git init
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi

# Check if .gitignore exists
if [ ! -f ".gitignore" ]; then
    echo "⚠️  Creating .gitignore file..."
    cat > .gitignore << EOF
node_modules
.env
.env.local
dist
.vite
*.log
tmp
uploads
baileys_auth
baileys_auth_info
EOF
    echo "✅ .gitignore created"
fi

echo ""

# Step 2: Commit changes
echo "💾 Step 2: Committing changes..."
git add .
git commit -m "Prepare for Vercel deployment - $(date '+%Y-%m-%d %H:%M')"
echo "✅ Changes committed"

echo ""

# Step 3: Install Vercel CLI
echo "🔧 Step 3: Installing Vercel CLI..."
if command -v vercel &> /dev/null; then
    echo "✅ Vercel CLI already installed"
else
    echo "Installing Vercel CLI globally..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
fi

echo ""

# Step 4: Login to Vercel
echo "🔐 Step 4: Logging into Vercel..."
echo "A browser window will open. Please login with your GitHub account."
echo ""
vercel login

echo ""

# Step 5: Deploy to Vercel
echo "🚀 Step 5: Deploying to Vercel..."
echo "This will deploy your application. Follow the prompts:"
echo ""

# Run Vercel deployment
vercel

echo ""
echo "========================================"
echo "🎉 Deployment Process Complete!"
echo "========================================"
echo ""
echo "📝 Next Steps:"
echo "1. Your app is now deployed to Vercel"
echo "2. Add environment variables in Vercel dashboard:"
echo "   - Go to: https://vercel.com/dashboard"
echo "   - Select your project"
echo "   - Go to Settings > Environment Variables"
echo "3. Add these variables:"
echo "   DATABASE_URL, NODE_ENV, PORT, GMAIL_USER, GMAIL_APP_PASSWORD,"
echo "   GROQ_API_KEY, OCR_SPACE_API_KEY, GEMINI_API_KEY,"
echo "   DISABLE_EMAIL_NOTIFICATIONS, DISABLE_WHATSAPP_NOTIFICATIONS"
echo "4. Redeploy after adding environment variables:"
echo "   Run: vercel --prod"
echo ""
echo "📖 For detailed instructions, see: VERCEL_DEPLOYMENT.md"
echo ""
