# WAHA Local Setup Guide (Docker Desktop)

## 🎯 Quick Start

This guide will help you run WAHA (WhatsApp HTTP API) locally using Docker Desktop.

### Prerequisites

- ✅ Docker Desktop installed and running
- ✅ WhatsApp mobile app (for QR code scanning)

---

## 📦 Step 1: Start WAHA Container

### Option A: Using npm scripts (Recommended)

```bash
npm run waha:start
```

### Option B: Using Docker Compose directly

```bash
docker-compose up -d
```

**What this does:**
- Downloads the WAHA Docker image (first time only)
- Starts WAHA container on port 3000
- Creates persistent volume for WhatsApp session data

**Expected output:**
```
✅ Container waha  Started
```

---

## 🔍 Step 2: Verify WAHA is Running

Check the container status:

```bash
npm run waha:status
# or
docker ps --filter "name=waha"
```

You should see the `waha` container with status "Up".

---

## 🌐 Step 3: Access WAHA Dashboard

Open your browser to:

```
http://localhost:3000
```

You should see the WAHA web interface.

**API Documentation** is available at:
```
http://localhost:3000/api
```

---

## 📱 Step 4: Connect WhatsApp

### Create a Session

1. **Using the API** (recommended):
   
   Run the session list script:
   ```bash
   npm run setup:whatsapp
   ```
   
   If no session exists, create one using the WAHA API:
   ```bash
   curl -X POST http://localhost:3000/api/sessions \
     -H "Content-Type: application/json" \
     -d '{"name": "default"}'
   ```

2. **Get the QR Code**:
   
   The script will display the QR code, or you can get it via:
   ```bash
   curl http://localhost:3000/api/default/auth/qr
   ```

3. **Scan QR Code**:
   - Open WhatsApp on your phone
   - Go to **Settings** > **Linked Devices**
   - Tap **Link a Device**
   - Scan the QR code displayed

4. **Verify Connection**:
   
   Run the session list script again:
   ```bash
   npm run setup:whatsapp
   ```
   
   Session status should show **"WORKING"** ✅

---

## ⚙️ Step 5: Configure Your Application

Run the configuration script:

```bash
npm run config:whatsapp
```

When prompted:
- **WAHA URL**: Just press Enter (defaults to `http://localhost:3000`)
- **API Key**: Press Enter to skip (optional)
- **Group ID**: Press Enter to skip (we'll get this next)

---

## 📋 Step 6: Get WhatsApp Group ID

1. **List your groups**:
   ```bash
   npm run setup:whatsapp
   ```

2. **Copy the Group ID** from the output (format: `1234567890-1234567890@g.us`)

3. **Update configuration**:
   Run the config script again and paste the Group ID:
   ```bash
   npm run config:whatsapp
   ```

---

## ✅ Step 7: Test It!

The setup script will offer to send a test message. Confirm and check your WhatsApp group!

---

## 🔧 Daily Usage

### Start WAHA
```bash
npm run waha:start
```

### Stop WAHA
```bash
npm run waha:stop
```

### Restart WAHA
```bash
npm run waha:restart
```

### View Logs
```bash
npm run waha:logs
```

### Check Status
```bash
npm run waha:status
```

---

## 💾 Data Persistence

Your WhatsApp session is saved in a Docker volume named `waha-data`. This means:

✅ **You won't need to re-scan the QR code** after restarting WAHA
✅ **Session persists** across container restarts
✅ **Survives** `docker-compose down` and `docker-compose up`

To completely reset (delete session):
```bash
docker-compose down -v
```

---

## 🔧 Troubleshooting

### Docker Desktop Not Running

**Problem**: Error "Docker Desktop is unable to start"

**Solution**:
1. Open Docker Desktop from Start menu
2. Wait for it to fully start (whale icon in system tray)
3. Try again

---

### Port 3000 Already in Use

**Problem**: Error "port is already allocated"

**Solution**:
1. Check what's using port 3000:
   ```bash
   netstat -ano | findstr :3000
   ```
2. Stop that process or change WAHA port in `docker-compose.yml`:
   ```yaml
   ports:
     - "3001:3000"  # Use port 3001 instead
   ```

---

### QR Code Not Appearing

**Problem**: Can't see QR code

**Solution**:
1. Check WAHA logs:
   ```bash
   npm run waha:logs
   ```
2. Try creating session via API:
   ```bash
   curl -X POST http://localhost:3000/api/sessions \
     -H "Content-Type: application/json" \
     -d '{"name": "default"}'
   ```
3. Get QR code:
   ```bash
   curl http://localhost:3000/api/default/auth/qr
   ```

---

### Session Disconnected

**Problem**: Session status shows "FAILED" or "STOPPED"

**Solution**:
1. Delete the old session:
   ```bash
   curl -X DELETE http://localhost:3000/api/sessions/default
   ```
2. Create a new session
3. Scan QR code again

---

### Container Won't Start

**Problem**: Container keeps restarting

**Solution**:
1. Check logs:
   ```bash
   npm run waha:logs
   ```
2. Remove and recreate:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

---

## 🔐 Optional: Add API Key Security

To secure your WAHA instance with an API key:

1. **Edit `docker-compose.yml`**:
   ```yaml
   environment:
     - WAHA_API_KEY=your-secret-key-here
   ```

2. **Restart WAHA**:
   ```bash
   npm run waha:restart
   ```

3. **Update app configuration**:
   ```bash
   npm run config:whatsapp
   ```
   Enter the same API key when prompted.

---

## 📊 Advantages of Local Deployment

✅ **No cold starts** - Instant response times
✅ **No usage limits** - Unlimited messages
✅ **Full control** - Complete access to logs and data
✅ **Free** - No hosting costs
✅ **Privacy** - Data stays on your machine
✅ **Fast** - No network latency

## ⚠️ Limitations

❌ **Computer must be on** - WAHA only works when your computer is running
❌ **Local network only** - Not accessible from outside your network (unless you set up port forwarding/ngrok)

---

## 🚀 Next Steps: Cloud Deployment

Once you've tested locally and everything works, you can deploy to the cloud for 24/7 availability:

- Railway.app (500 hours/month free)
- Render.com (750 hours/month free)
- Or use ngrok for external access to your local instance

See `WHATSAPP_DEPLOYMENT_GUIDE.md` for cloud deployment instructions.

---

## 📚 Useful Commands

```bash
# Start WAHA
npm run waha:start

# Stop WAHA
npm run waha:stop

# View logs
npm run waha:logs

# Check status
npm run waha:status

# Configure WhatsApp
npm run config:whatsapp

# List sessions and groups
npm run setup:whatsapp

# Restart WAHA
npm run waha:restart
```

---

## 🎉 Success Checklist

- [ ] Docker Desktop running
- [ ] WAHA container started
- [ ] Accessed http://localhost:3000
- [ ] Created WhatsApp session
- [ ] Scanned QR code
- [ ] Session status is "WORKING"
- [ ] Configured app with localhost URL
- [ ] Retrieved WhatsApp group ID
- [ ] Sent test message successfully

---

**You're all set! Your local WAHA instance is ready for WhatsApp notifications! 🎉**
