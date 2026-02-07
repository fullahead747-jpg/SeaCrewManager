# WhatsApp Integration - WAHA Deployment Guide

## 🎯 Overview

This guide will help you deploy a free WAHA (WhatsApp HTTP API) instance and connect it to your Crew Management System running on Replit.

---

## 🚀 Quick Start (Railway.app - Recommended)

Railway.app offers the easiest free deployment for WAHA.

### Step 1: Deploy WAHA to Railway

1. **Go to Railway.app**
   - Visit: https://railway.app
   - Click "Start a New Project"
   - Sign in with GitHub

2. **Deploy from Docker Image**
   - Click "Deploy from Docker Image"
   - Enter image: `devlikeapro/waha`
   - Click "Deploy"

3. **Configure Port**
   - Go to Settings
   - Add Environment Variable:
     - Name: `PORT`
     - Value: `3000`
   - Click "Add Domain" to get a public URL

4. **Wait for Deployment**
   - Railway will deploy WAHA (takes ~2 minutes)
   - You'll get a URL like: `https://your-app.railway.app`

### Step 2: Connect WhatsApp

1. **Open WAHA Dashboard**
   - Go to your Railway URL in browser
   - You'll see the WAHA interface

2. **Start a Session**
   - Click on "Sessions" or go to `/api/sessions`
   - Create a new session named `default`
   - A QR code will appear

3. **Scan QR Code**
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices
   - Tap "Link a Device"
   - Scan the QR code from WAHA

4. **Verify Connection**
   - Session status should show "WORKING" or "READY"
   - You're now connected!

### Step 3: Configure Your App

1. **Get Your Railway URL**
   - Copy your Railway app URL (e.g., `https://your-app.railway.app`)

2. **Update Settings in Your App**
   - Go to your Crew Management System
   - Navigate to Settings > WhatsApp (or run the setup script)
   - Set:
     - **Provider**: `waha`
     - **Webhook URL**: Your Railway URL
     - **API Key**: (leave empty for now)
     - **Group ID**: (we'll get this in Step 4)

3. **Enable Notifications**
   - Check "Enable WhatsApp Notifications"
   - Select notification types you want

### Step 4: Get WhatsApp Group ID

1. **Run Setup Script**
   ```bash
   npm run setup:whatsapp
   ```

2. **Copy Group ID**
   - The script will show all your WhatsApp groups
   - Copy the ID of the group you want to use
   - Format: `1234567890-1234567890@g.us`

3. **Update Settings**
   - Paste the Group ID in your WhatsApp settings
   - Save settings

### Step 5: Test It!

1. **Send Test Message**
   - Run the setup script again:
     ```bash
     npm run setup:whatsapp
     ```
   - It will send a test message to your group

2. **Check WhatsApp**
   - Open your WhatsApp group
   - You should see the test message!

---

## 🔄 Alternative: Render.com

If Railway doesn't work, try Render.com:

### Deploy to Render

1. **Go to Render.com**
   - Visit: https://render.com
   - Sign up/Sign in

2. **Create New Web Service**
   - Click "New +"
   - Select "Web Service"

3. **Deploy from Docker**
   - Select "Deploy an existing image from a registry"
   - Image URL: `devlikeapro/waha`
   - Name: `waha-whatsapp`

4. **Configure**
   - Instance Type: Free
   - Environment Variables:
     - `PORT` = `3000`
   - Click "Create Web Service"

5. **Get URL**
   - Render will give you a URL like: `https://waha-whatsapp.onrender.com`
   - Use this as your Webhook URL

Then follow Steps 2-5 from the Railway guide above.

---

## 💻 Local Development

For testing locally before deploying:

### Using Docker

```bash
# Pull and run WAHA
docker run -it -p 3000:3000/tcp devlikeapro/waha

# Open browser to http://localhost:3000
# Scan QR code
# Use http://localhost:3000 as webhook URL in your app
```

### Using npm

```bash
# Install WAHA globally
npm install -g @waha/waha

# Run WAHA
waha

# Open browser to http://localhost:3000
```

---

## 🔧 Troubleshooting

### QR Code Not Appearing

**Problem**: Can't see QR code in WAHA dashboard

**Solution**:
1. Go to `https://your-waha-url/api/sessions`
2. Create a new session via API
3. Check the response for QR code data
4. Or use WAHA Swagger UI at `https://your-waha-url/api`

### Session Disconnected

**Problem**: WhatsApp session keeps disconnecting

**Solution**:
1. Delete the old session
2. Create a new session
3. Scan QR code again
4. Don't log out from WhatsApp Web on other devices

### Messages Not Sending

**Problem**: Test messages fail to send

**Solution**:
1. Check WAHA session status (should be "WORKING")
2. Verify Group ID format: `1234567890-1234567890@g.us`
3. Check WAHA logs for errors
4. Ensure your Railway/Render app is running

### Railway Free Tier Limits

**Problem**: App stops after 500 hours

**Solution**:
- Railway free tier: 500 hours/month
- This is enough for 24/7 operation (~720 hours)
- Consider upgrading to Railway Pro ($5/month) for unlimited hours
- Or use Render.com (750 hours/month free)

---

## 📊 Cost Breakdown

| Service | Free Tier | Enough For? |
|---------|-----------|-------------|
| **Railway.app** | 500 hours/month | ✅ Yes (20 days) |
| **Render.com** | 750 hours/month | ✅ Yes (31 days) |
| **WAHA Core** | Unlimited | ✅ Yes |
| **WhatsApp** | Free | ✅ Yes |
| **Total Cost** | **$0/month** | ✅ Perfect! |

---

## 🔐 Security Best Practices

### 1. Use API Key (Optional but Recommended)

Add an API key to your WAHA instance:

**On Railway/Render**:
- Add environment variable: `WAHA_API_KEY=your-secret-key`
- Update your app settings with the same API key

### 2. Dedicated WhatsApp Number

- Use a WhatsApp Business account
- Don't use your personal number
- Create a dedicated number for notifications

### 3. Rate Limiting

- Don't send too many messages too quickly
- WhatsApp may flag your account as spam
- Your app already has built-in rate limiting

---

## 📱 Getting a WhatsApp Business Number

### Option 1: Use Existing Number

- Use any phone number you have
- Download WhatsApp Business app
- Register with that number

### Option 2: Get a New Number

**Free Options**:
- Google Voice (US only)
- TextNow (US/Canada)
- Any prepaid SIM card

**Paid Options**:
- Twilio ($1-2/month)
- Any mobile carrier

---

## 🎉 Success Checklist

- [ ] WAHA deployed to Railway/Render
- [ ] QR code scanned successfully
- [ ] Session status shows "WORKING"
- [ ] WhatsApp settings configured in app
- [ ] Group ID obtained and set
- [ ] Test message sent successfully
- [ ] Notifications enabled

---

## 📚 Additional Resources

- **WAHA Documentation**: https://waha.devlike.pro
- **WAHA GitHub**: https://github.com/devlikeapro/waha
- **Railway Docs**: https://docs.railway.app
- **Render Docs**: https://render.com/docs

---

## 💡 Tips

1. **Keep Session Active**: Don't log out from WhatsApp Web elsewhere
2. **Monitor Logs**: Check Railway/Render logs if issues occur
3. **Backup**: Keep your QR code session backed up
4. **Test First**: Always test with a test group before production
5. **Fallback**: Keep email notifications enabled as backup

---

## 🆘 Need Help?

If you encounter issues:

1. Run the setup script: `npm run setup:whatsapp`
2. Check WAHA logs on Railway/Render
3. Verify all settings are correct
4. Try restarting the WAHA instance
5. Create a new session if needed

---

**You're all set! Your crew management alerts will now appear in WhatsApp! 🎉**
