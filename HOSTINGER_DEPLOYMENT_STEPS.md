# Step-by-Step Hostinger Deployment Guide

## Phase 1: Download and Prepare Files

### 1. Download Your Production Package
- Download the `crewtrack-pro-production.tar.gz` file from this project
- Extract it to a local folder on your computer

### 2. Verify Files Structure
After extraction, you should see:
```
crewtrack-pro/
├── deployment/
│   ├── dist/               # Frontend files
│   ├── server/             # Backend files  
│   ├── shared/             # Database schema
│   ├── package.json        # Dependencies
│   ├── .env.example        # Environment template
│   └── eng.traineddata     # OCR data
└── DEPLOYMENT_GUIDE.md     # Detailed guide
```

## Phase 2: Hostinger Account Setup

### 3. Database Setup (PostgreSQL)
1. Log into Hostinger control panel
2. Go to **Websites** → **Manage** → **Databases**
3. Click **Create Database**
4. Choose **PostgreSQL** (recommended) or MySQL
5. Database name: `crewtrack_pro`
6. Username: Create strong username
7. Password: Create strong password
8. **Save these credentials - you'll need them!**

### 4. Node.js Application Setup
1. In Hostinger control panel: **Websites** → **Manage**
2. Click **Advanced** → **Node.js**
3. Click **Create Application**
4. Application name: `CrewTrack Pro`
5. Node.js version: Select **18.x** or higher
6. Entry point: `dist/index.js`
7. Click **Create**

## Phase 3: File Upload

### 5. Upload Files via File Manager
1. In Hostinger: **Websites** → **File Manager**
2. Navigate to your domain folder (e.g., `public_html/yourdomain.com`)
3. Upload the entire `deployment` folder contents
4. Your structure should look like:
```
public_html/yourdomain.com/
├── dist/
├── server/
├── shared/
├── package.json
├── eng.traineddata
└── (other files)
```

### 6. Set File Permissions
1. Select all uploaded files
2. Right-click → **Permissions**
3. Set directories to `755`
4. Set files to `644`

## Phase 4: Environment Configuration

### 7. Create Environment File
1. In File Manager, create new file: `.env`
2. Copy from `.env.example` and update with your database info:

```env
DATABASE_URL="postgresql://your_username:your_password@localhost:5432/crewtrack_pro"
PGHOST=localhost
PGPORT=5432
PGUSER=your_database_username
PGPASSWORD=your_database_password
PGDATABASE=crewtrack_pro
NODE_ENV=production
PORT=3000
```

**Replace with your actual database credentials from Step 3!**

## Phase 5: Installation and Setup

### 8. Install Dependencies
1. In Hostinger control panel: **Advanced** → **SSH Access**
2. Open terminal
3. Navigate to your app folder:
   ```bash
   cd domains/yourdomain.com/public_html
   ```
4. Install dependencies:
   ```bash
   npm install --production
   ```

### 9. Setup Database Tables
1. In the same terminal, run:
   ```bash
   npm run db:push
   ```
2. This creates all necessary database tables

### 10. Start Application
1. Go back to **Node.js** in control panel
2. Find your CrewTrack Pro application
3. Click **Start** or **Restart**
4. Check status shows **Running**

## Phase 6: Domain and SSL

### 11. Configure Domain
1. In **Websites** → **Manage** → **Domains**
2. Either use main domain or create subdomain like `crew.yourdomain.com`
3. Point domain to the Node.js application

### 12. Enable SSL Certificate
1. **Websites** → **Manage** → **SSL**
2. Enable **Free SSL Certificate**
3. Wait for activation (5-10 minutes)

## Phase 7: Testing

### 13. Test Your Application
1. Visit your domain: `https://yourdomain.com`
2. You should see the CrewTrack Pro login page
3. Test login with demo accounts:
   - **Admin**: username `admin`, password `admin123`
   - **Office Staff**: username `office`, password `demo123`

### 14. Test Key Features
- [ ] Dashboard loads correctly
- [ ] Add new crew member
- [ ] Upload document with OCR scanning
- [ ] View vessel management
- [ ] Check contract tracking

## Troubleshooting Common Issues

### Database Connection Error
- Verify `.env` file has correct database credentials
- Check database is running in Hostinger panel
- Ensure `DATABASE_URL` format is correct

### Application Won't Start
- Check Node.js version is 18+
- Verify entry point is `dist/index.js`
- Check error logs in Node.js application panel

### 404 Errors
- Ensure all files uploaded correctly
- Check file permissions (755 for directories, 644 for files)
- Verify domain points to correct directory

### SSL Issues
- Wait 10-15 minutes after enabling SSL
- Clear browser cache
- Try accessing with `https://` prefix

## Maintenance

### Regular Backups
1. **Database**: Use Hostinger's backup feature
2. **Files**: Download copy of your application files
3. **Schedule**: Weekly backups recommended

### Updates
1. When updating, always backup first
2. Test changes locally before uploading
3. Use Hostinger's staging environment if available

## Support Resources

- **Hostinger Knowledge Base**: Check their Node.js documentation
- **Database Issues**: Use Hostinger's database management tools
- **SSL Problems**: Contact Hostinger support
- **Application Logs**: Check in Node.js application panel

---

## Quick Checklist

- [ ] Database created in Hostinger
- [ ] Files uploaded to correct directory
- [ ] Environment variables configured
- [ ] Dependencies installed (`npm install`)
- [ ] Database migrated (`npm run db:push`)
- [ ] Application started in Node.js panel
- [ ] Domain configured
- [ ] SSL certificate enabled
- [ ] Application tested and working

**Your CrewTrack Pro maritime crew management system is now live!**

---

**Need Help?** 
- Check the detailed `DEPLOYMENT_GUIDE.md` for technical details
- Review Hostinger's Node.js hosting documentation
- Test each step carefully before proceeding to the next