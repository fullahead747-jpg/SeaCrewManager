# Replit Object Storage Setup Guide

## Overview

This guide will help you configure persistent Object Storage on Replit so that all uploaded documents (contracts, passports, etc.) are stored permanently in the cloud instead of the temporary file system.

## Why You Need This

**Current Situation (Local Development):**
- ❌ Files stored in `uploads/` folder
- ❌ Files are deleted when Replit restarts
- ❌ Not suitable for production

**After Object Storage Setup:**
- ✅ Files stored in Google Cloud Storage
- ✅ Files persist across deployments and restarts
- ✅ Production-ready persistent storage

## Step-by-Step Setup Instructions

### Step 1: Create Object Storage Bucket in Replit

1. **Open your Replit project** at https://replit.com
2. **Navigate to your SeaCrewManager project**
3. **Open the Tools panel** (left sidebar)
4. **Click on "Object Storage"** tool
5. **Click "Create Bucket"**
6. **Name your bucket**: `seacrew-documents` (or any name you prefer)
7. **Click "Create"**

> [!IMPORTANT]
> Remember the bucket name - you'll need it in the next step!

### Step 2: Set Environment Variable

1. **In your Replit project**, click on **"Secrets"** (lock icon in left sidebar)
2. **Click "New Secret"**
3. **Set the following:**
   - **Key**: `PRIVATE_OBJECT_DIR`
   - **Value**: `/seacrew-documents` (use your bucket name with `/` prefix)
4. **Click "Add Secret"**

> [!NOTE]
> The value must start with `/` followed by your bucket name

### Step 3: Verify Configuration

After setting up Object Storage, run this command in the Replit Shell:

```bash
npx tsx scripts/verify-object-storage.ts
```

This will verify that:
- ✅ `PRIVATE_OBJECT_DIR` is set correctly
- ✅ Object Storage is accessible
- ✅ The bucket exists and is writable

### Step 4: Test Upload

1. **Upload a new document** through the UI (contract, passport, etc.)
2. **Check the server logs** - you should see:
   ```
   [CLOUD-STORAGE] Successfully uploaded to /seacrew-documents/crew/[id]/documents/[uuid]-[filename]
   ```
3. **Verify in database** - file path should start with `/`

### Step 5: Migrate Existing Files (Optional)

If you want to migrate existing local files to Object Storage:

```bash
npx tsx scripts/migrate-to-object-storage.ts
```

This will:
- Find all documents with local file paths
- Upload them to Object Storage
- Update database records with cloud paths

## Verification Checklist

After setup, verify everything is working:

- [ ] `PRIVATE_OBJECT_DIR` environment variable is set
- [ ] Bucket exists in Replit Object Storage
- [ ] New uploads show cloud paths (starting with `/`)
- [ ] Server logs show `[CLOUD-STORAGE]` success messages
- [ ] Files persist after Replit restart

## Troubleshooting

### Error: "PRIVATE_OBJECT_DIR not set"

**Solution:** Make sure you added the secret in Replit Secrets (not `.env` file)

### Error: "Failed to upload to Object Storage"

**Possible causes:**
1. Bucket name doesn't match the `PRIVATE_OBJECT_DIR` value
2. Bucket doesn't exist - create it in Object Storage tool
3. Replit Object Storage service is down - check Replit status

### Files still going to local uploads folder

**Solution:** 
1. Restart the Replit deployment after adding the secret
2. Verify the environment variable is set: `echo $PRIVATE_OBJECT_DIR`

## What Happens Automatically

Once configured, the system will automatically:

1. **On Document Upload:**
   - Save file temporarily to `uploads/`
   - Upload to Object Storage
   - Update database with cloud path
   - Delete local temporary file

2. **On Document Download:**
   - Generate signed URL from Object Storage
   - Stream file directly from cloud
   - Cache for 1 hour

3. **On Document Delete:**
   - Remove from database
   - Delete from Object Storage

## Important Notes

> [!WARNING]
> **Local Development vs Replit**
> - Local development will continue using `uploads/` folder (Object Storage only works on Replit)
> - To test locally, you can skip this setup
> - For production deployment, Object Storage is **required**

> [!TIP]
> **Cost**
> - Replit Object Storage is included in your Replit plan
> - No additional charges for reasonable usage
> - Check Replit pricing for storage limits

## Summary

**What you need to do:**
1. Create bucket in Replit Object Storage tool
2. Add `PRIVATE_OBJECT_DIR` secret in Replit
3. Restart deployment
4. Upload a test document

**What happens automatically:**
- All new uploads go to cloud storage
- Files persist permanently
- No code changes needed - it's already implemented!

## Need Help?

If you encounter issues:
1. Run verification script: `npx tsx scripts/verify-object-storage.ts`
2. Check Replit logs for error messages
3. Verify bucket name matches environment variable
4. Ensure Replit Object Storage tool shows your bucket

---

**Ready to proceed?** Follow the steps above and your document storage will be persistent! 🚀
