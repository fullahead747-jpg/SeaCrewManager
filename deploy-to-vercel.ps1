# ========================================
# Vercel Deployment Script for SeaCrewManager
# ========================================

Write-Host "🚀 Starting Vercel Deployment Process..." -ForegroundColor Cyan
Write-Host ""

# Check if Git is installed
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow
try {
    git --version | Out-Null
    Write-Host "✅ Git is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Git is not installed. Please install Git first: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

# Check if Node.js is installed
try {
    node --version | Out-Null
    Write-Host "✅ Node.js is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js first: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 1: Initialize Git repository if not already done
Write-Host "📦 Step 1: Setting up Git repository..." -ForegroundColor Cyan
if (-not (Test-Path ".git")) {
    git init
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "✅ Git repository already exists" -ForegroundColor Green
}

# Check if .gitignore exists
if (-not (Test-Path ".gitignore")) {
    Write-Host "⚠️  Creating .gitignore file..." -ForegroundColor Yellow
    @"
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
"@ | Out-File -FilePath ".gitignore" -Encoding UTF8
    Write-Host "✅ .gitignore created" -ForegroundColor Green
}

Write-Host ""

# Step 2: Commit changes
Write-Host "💾 Step 2: Committing changes..." -ForegroundColor Cyan
git add .
$commitMessage = "Prepare for Vercel deployment - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git commit -m $commitMessage
Write-Host "✅ Changes committed" -ForegroundColor Green

Write-Host ""

# Step 3: Install Vercel CLI
Write-Host "🔧 Step 3: Installing Vercel CLI..." -ForegroundColor Cyan
try {
    vercel --version | Out-Null
    Write-Host "✅ Vercel CLI already installed" -ForegroundColor Green
} catch {
    Write-Host "Installing Vercel CLI globally..." -ForegroundColor Yellow
    npm install -g vercel
    Write-Host "✅ Vercel CLI installed" -ForegroundColor Green
}

Write-Host ""

# Step 4: Login to Vercel
Write-Host "🔐 Step 4: Logging into Vercel..." -ForegroundColor Cyan
Write-Host "A browser window will open. Please login with your GitHub account." -ForegroundColor Yellow
Write-Host ""
vercel login

Write-Host ""

# Step 5: Deploy to Vercel
Write-Host "🚀 Step 5: Deploying to Vercel..." -ForegroundColor Cyan
Write-Host "This will deploy your application. Follow the prompts:" -ForegroundColor Yellow
Write-Host ""

# Run Vercel deployment
vercel

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎉 Deployment Process Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Your app is now deployed to Vercel" -ForegroundColor White
Write-Host "2. Add environment variables in Vercel dashboard:" -ForegroundColor White
Write-Host "   - Go to: https://vercel.com/dashboard" -ForegroundColor Gray
Write-Host "   - Select your project" -ForegroundColor Gray
Write-Host "   - Go to Settings > Environment Variables" -ForegroundColor Gray
Write-Host "3. Add these variables:" -ForegroundColor White
Write-Host "   DATABASE_URL, NODE_ENV, PORT, GMAIL_USER, GMAIL_APP_PASSWORD," -ForegroundColor Gray
Write-Host "   GROQ_API_KEY, OCR_SPACE_API_KEY, GEMINI_API_KEY," -ForegroundColor Gray
Write-Host "   DISABLE_EMAIL_NOTIFICATIONS, DISABLE_WHATSAPP_NOTIFICATIONS" -ForegroundColor Gray
Write-Host "4. Redeploy after adding environment variables:" -ForegroundColor White
Write-Host "   Run: vercel --prod" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 For detailed instructions, see: VERCEL_DEPLOYMENT.md" -ForegroundColor Cyan
Write-Host ""
