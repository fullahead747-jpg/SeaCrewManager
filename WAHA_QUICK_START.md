# 🚀 WAHA Local Setup - Quick Start

## ⚠️ IMPORTANT: Start Docker Desktop First!

**Before running any commands, you MUST start Docker Desktop:**

1. Open **Docker Desktop** from your Start menu
2. Wait for the Docker whale icon to appear in your system tray
3. Wait until the whale icon stops animating (this means Docker is ready)

---

## 📋 Quick Setup Steps

### 1. Start WAHA Container

```bash
npm run waha:start
```

This will:
- Download the WAHA image (first time only, ~500MB)
- Start WAHA on http://localhost:3000
- Create persistent storage for your WhatsApp session

### 2. Open WAHA Dashboard

Open your browser to: **http://localhost:3000**

### 3. Create WhatsApp Session

Run the setup script:

```bash
npm run setup:whatsapp
```

If no session exists, create one:

```bash
curl -X POST http://localhost:3000/api/sessions -H "Content-Type: application/json" -d "{\"name\": \"default\"}"
```

### 4. Scan QR Code

1. The setup script will show a QR code
2. Open WhatsApp on your phone
3. Go to **Settings** > **Linked Devices** > **Link a Device**
4. Scan the QR code

### 5. Configure Your App

```bash
npm run config:whatsapp
```

- WAHA URL: Press Enter (defaults to `http://localhost:3000`)
- API Key: Press Enter to skip
- Group ID: Press Enter to skip (we'll get this next)

### 6. Get WhatsApp Group ID

```bash
npm run setup:whatsapp
```

Copy the Group ID from your desired group (format: `1234567890-1234567890@g.us`)

Run config again and paste the Group ID:

```bash
npm run config:whatsapp
```

### 7. Test!

The setup script will offer to send a test message. Check your WhatsApp group!

---

## 🔧 Daily Commands

```bash
# Start WAHA
npm run waha:start

# Stop WAHA
npm run waha:stop

# Check status
npm run waha:status

# View logs
npm run waha:logs

# Restart WAHA
npm run waha:restart
```

---

## ❓ Troubleshooting

### "Docker Desktop is unable to start"

**Solution**: Open Docker Desktop and wait for it to fully start (whale icon in system tray)

### "Port 3000 already in use"

**Solution**: Stop whatever is using port 3000, or edit `docker-compose.yml` to use a different port

### Session disconnected

**Solution**: 
```bash
curl -X DELETE http://localhost:3000/api/sessions/default
npm run setup:whatsapp
# Scan QR code again
```

---

## 📚 Full Documentation

For detailed instructions, see: **[WAHA_LOCAL_SETUP.md](./WAHA_LOCAL_SETUP.md)**

---

## ✅ Success Checklist

- [ ] Docker Desktop is running
- [ ] Ran `npm run waha:start`
- [ ] Opened http://localhost:3000
- [ ] Scanned QR code
- [ ] Session status is "WORKING"
- [ ] Configured app with `npm run config:whatsapp`
- [ ] Got WhatsApp group ID
- [ ] Sent test message

---

**Ready to go! 🎉**
