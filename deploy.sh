#!/bin/bash

# CrewTrack Pro - Production Deployment Script
# This script prepares the application for production deployment

echo "🚢 Preparing CrewTrack Pro for production deployment..."

# Create deployment directory
mkdir -p deployment
cd deployment

# Copy essential files
echo "📁 Copying application files..."

# Copy backend files
cp -r ../server ./
cp -r ../shared ./
cp ../package.json ./
cp ../package-lock.json ./
cp ../drizzle.config.ts ./
cp ../tsconfig.json ./
cp ../eng.traineddata ./

# Copy frontend build
if [ -d "../dist" ]; then
    cp -r ../dist ./
    echo "✅ Frontend build files copied"
else
    echo "❌ Frontend build not found. Run 'npm run build' first"
    exit 1
fi

# Create environment template
echo "📄 Creating environment template..."
cat > .env.example << EOF
# Database Configuration
DATABASE_URL="postgresql://username:password@host:port/database_name"
PGHOST=your_host
PGPORT=5432
PGUSER=your_username
PGPASSWORD=your_password
PGDATABASE=your_database_name

# Node Environment
NODE_ENV=production
PORT=3000

# Optional: OpenAI API Key
OPENAI_API_KEY=your_openai_key_if_needed
EOF

# Create production package.json with only production dependencies
echo "📦 Creating production package.json..."
node -e "
const pkg = require('../package.json');
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  main: 'server/index.js',
  scripts: {
    start: 'node server/index.js',
    'db:push': 'drizzle-kit push'
  },
  dependencies: {
    '@neondatabase/serverless': pkg.dependencies['@neondatabase/serverless'],
    'drizzle-orm': pkg.dependencies['drizzle-orm'],
    'drizzle-kit': pkg.dependencies['drizzle-kit'],
    'express': pkg.dependencies['express'],
    'express-session': pkg.dependencies['express-session'],
    'tsx': pkg.dependencies['tsx'],
    'typescript': pkg.dependencies['typescript'],
    'tesseract.js': pkg.dependencies['tesseract.js'],
    'sharp': pkg.dependencies['sharp'],
    'zod': pkg.dependencies['zod'],
    'ws': pkg.dependencies['ws']
  }
};
console.log(JSON.stringify(prodPkg, null, 2));
" > package.json

# Create start script
echo "🚀 Creating start script..."
cat > start.js << EOF
const express = require('express');
const path = require('path');

// Import your server
require('./server/index.js');

console.log('CrewTrack Pro started successfully!');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT || 3000);
EOF

# Update server to serve static files in production
echo "🔧 Configuring production server..."
cat > server/static.js << EOF
const express = require('express');
const path = require('path');

module.exports = function configureStatic(app) {
  if (process.env.NODE_ENV === 'production') {
    // Serve static files from dist directory
    app.use(express.static(path.join(__dirname, '../dist')));
    
    // Handle client-side routing
    app.get('*', (req, res, next) => {
      // Skip API routes
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
  }
};
EOF

# Create README for deployment
echo "📖 Creating deployment README..."
cat > README.md << EOF
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
EOF

# Create zip file for easy download
echo "📦 Creating deployment package..."
cd ..
zip -r crewtrack-pro-production.zip deployment/ -x "*.DS_Store" "*/node_modules/*"

echo ""
echo "✅ Production deployment package created successfully!"
echo ""
echo "📁 Files ready in: ./deployment/"
echo "📦 Download package: ./crewtrack-pro-production.zip"
echo ""
echo "Next steps:"
echo "1. Download the zip file"
echo "2. Upload to your Hostinger hosting"
echo "3. Follow the DEPLOYMENT_GUIDE.md instructions"
echo ""
echo "🚢 Ready to sail with CrewTrack Pro!"