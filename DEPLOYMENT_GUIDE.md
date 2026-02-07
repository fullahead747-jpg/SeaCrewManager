# CrewTrack Pro - Hostinger Deployment Guide

## Overview
This guide will help you deploy your maritime crew management system to Hostinger web hosting.

## Prerequisites
- Hostinger hosting account with Node.js support
- Database hosting (Hostinger provides MySQL/PostgreSQL)
- File manager or FTP access to your hosting account

## Step 1: Prepare Your Files

### Files to Upload:
```
/
├── dist/                 # Frontend build files
├── server/              # Backend Node.js files
├── shared/              # Shared schema files
├── package.json         # Dependencies
├── package-lock.json    # Lock file
├── drizzle.config.ts    # Database config
├── tsconfig.json        # TypeScript config
├── .env.example         # Environment template
└── eng.traineddata      # OCR language data
```

## Step 2: Database Setup

### Option A: PostgreSQL (Recommended)
1. Create a PostgreSQL database in Hostinger control panel
2. Note down:
   - Database name
   - Username
   - Password
   - Host
   - Port

### Option B: MySQL (Alternative)
1. Create MySQL database in Hostinger control panel
2. You'll need to modify the database configuration

## Step 3: Environment Configuration

Create `.env` file with your database credentials:

```env
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

# Optional: OpenAI API Key (for enhanced OCR features)
OPENAI_API_KEY=your_openai_key_if_needed
```

## Step 4: Hostinger Setup Steps

### 1. Upload Files
- Use Hostinger File Manager or FTP client
- Upload all files to your domain's public_html folder
- Ensure proper file permissions (755 for directories, 644 for files)

### 2. Install Dependencies
- Access SSH terminal in Hostinger control panel
- Navigate to your domain folder
- Run: `npm install --production`

### 3. Database Migration
- Run: `npm run db:push`
- This creates all necessary tables

### 4. Start Application
- Run: `npm start` or use Hostinger's Node.js application manager
- Set startup file to: `server/index.js`

## Step 5: Domain Configuration

### DNS Settings:
- Point your domain to Hostinger's servers
- Configure subdomain if needed (e.g., crewtrack.yourdomain.com)

### SSL Certificate:
- Enable free SSL certificate in Hostinger control panel
- Ensure HTTPS is working

## Step 6: Testing

1. Visit your domain
2. Test login with demo credentials:
   - Admin: admin / admin123
   - Office Staff: office / demo123
3. Test core features:
   - Add crew member
   - Upload document with OCR
   - View dashboard statistics

## File Structure on Server

```
public_html/
├── dist/                    # React frontend (static files)
│   ├── index.html
│   ├── assets/
│   └── ...
├── server/                  # Node.js backend
│   ├── index.js
│   ├── routes.js
│   ├── storage.js
│   ├── db.js
│   ├── localOcrService.js
│   └── ...
├── shared/
│   └── schema.js
├── package.json
├── .env
└── eng.traineddata
```

## Troubleshooting

### Common Issues:

**Database Connection Error:**
- Verify DATABASE_URL format
- Check database credentials
- Ensure database server is accessible

**Port Conflicts:**
- Hostinger may assign different ports
- Check Hostinger's Node.js app settings
- Update PORT in .env file

**File Permissions:**
- Set directories to 755: `chmod -R 755 public_html`
- Set files to 644: `chmod -R 644 public_html/*`

**Node.js Version:**
- Ensure Hostinger supports Node.js 18+
- Check in hosting control panel

### Performance Optimization:

1. **Enable Gzip Compression**
2. **Set up CDN** (if available in your plan)
3. **Configure Caching Headers**
4. **Monitor Resource Usage**

## Security Considerations

1. **Environment Variables:**
   - Never commit .env to version control
   - Use strong database passwords

2. **HTTPS:**
   - Always use SSL certificate
   - Force HTTPS redirects

3. **Database Security:**
   - Use restricted database users
   - Regular backups

## Backup Strategy

1. **Database Backups:**
   - Set up automatic database backups in Hostinger
   - Export data regularly

2. **File Backups:**
   - Keep local copies of your code
   - Use Hostinger's backup features

## Support

If you encounter issues:
1. Check Hostinger's Node.js documentation
2. Review error logs in hosting control panel
3. Test locally first before deploying changes

## Production Checklist

- [ ] Database created and configured
- [ ] Environment variables set
- [ ] Files uploaded with correct permissions
- [ ] Dependencies installed
- [ ] Database migrated
- [ ] Application started
- [ ] Domain configured
- [ ] SSL certificate enabled
- [ ] Basic functionality tested
- [ ] Backups configured

---

**Note:** This system includes advanced features like OCR document processing and real-time notifications. Ensure your Hostinger plan supports the required Node.js features and database connections.