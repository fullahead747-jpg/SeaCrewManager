# Quick Setup Guide - Object Storage (5 Minutes)

## 🎯 Goal
Make your document uploads permanent on Replit

## 📋 What You'll Do
1. Create a storage bucket (2 min)
2. Add one environment variable (1 min)
3. Restart and test (2 min)

---

## Step 1: Create Storage Bucket

### Where to go:
1. Open your Replit project: https://replit.com
2. Look at the **left sidebar**
3. Find and click **"Tools"** or **"Object Storage"**

### What to do:
1. Click **"Create Bucket"** button
2. Name it: `seacrew-documents`
3. Click **"Create"**

**✅ Done!** You should see your bucket listed.

---

## Step 2: Add Environment Variable

### Where to go:
1. In the same left sidebar
2. Find and click the **🔒 Lock icon** (Secrets)

### What to do:
1. Click **"New Secret"** or **"Add Secret"**
2. Fill in:
   - **Key**: `PRIVATE_OBJECT_DIR`
   - **Value**: `/seacrew-documents`
3. Click **"Add"** or **"Save"**

**✅ Done!** You should see the secret listed.

---

## Step 3: Restart Deployment

### What to do:
1. Click **"Stop"** button (if running)
2. Click **"Run"** button to restart

**Wait for the server to start** (you'll see logs)

---

## Step 4: Verify It's Working

### In Replit Shell, run:
```bash
npx tsx scripts/verify-object-storage.ts
```

### Expected output:
```
✅ VERIFICATION COMPLETE
Your Object Storage is configured correctly!
```

---

## Step 5: Test Upload

1. Go to your application
2. Upload a document (contract, passport, etc.)
3. Check the **Replit logs** - you should see:
   ```
   [CLOUD-STORAGE] Successfully uploaded to /seacrew-documents/...
   ```

**🎉 Success!** Your documents are now stored permanently!

---

## 🆘 Troubleshooting

### "PRIVATE_OBJECT_DIR not set"
- Go back to Secrets and verify you added it
- Make sure the value starts with `/`
- Restart the deployment

### "Bucket not found"
- Go to Object Storage tool
- Verify bucket name matches exactly: `seacrew-documents`
- Bucket name in secret should be: `/seacrew-documents`

### Still not working?
Run the verification script and share the output:
```bash
npx tsx scripts/verify-object-storage.ts
```

---

## 📸 Visual Reference

**Where to find Object Storage:**
- Left sidebar → Tools → Object Storage

**Where to find Secrets:**
- Left sidebar → 🔒 Lock icon

**What the secret should look like:**
```
Key: PRIVATE_OBJECT_DIR
Value: /seacrew-documents
```

---

## ✅ Checklist

- [ ] Created bucket `seacrew-documents` in Object Storage
- [ ] Added secret `PRIVATE_OBJECT_DIR=/seacrew-documents`
- [ ] Restarted deployment
- [ ] Ran verification script (passed)
- [ ] Uploaded test document (saw cloud storage logs)

**All done? Your storage is now persistent!** 🚀
