# Deploying to Hugging Face Spaces (FREE)

This guide will help you share your SeaCrewManager with your 5 users for free.

## Step 1: Create a Hugging Face Account
1. Go to [huggingface.co](https://huggingface.co) and sign up (Free).
2. Verify your email.

## Step 2: Create a New Space
1. Click on **"New Space"** (or go to [huggingface.co/new-space](https://huggingface.co/new-space)).
2. **Space Name**: "sea-crew-manager" (or any name you like).
3. **Space SDK**: Select **"Docker"**.
4. **Template**: Choose **"Blank"**.
5. **Visibility**: Select **"Public"** (so your users can see it).
6. Click **"Create Space"**.

## Step 3: Deployment (Pick ONE way)

### Option A: The Automated Way (Recommended)
I have created a script called `upload_to_hf.py` to do the work for you.
1. Get a **Token**: Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) and create a "Write" token.
2. Run this command in your terminal:
   ```powershell
   python upload_to_hf.py
   ```
3. Enter your **Space ID** (e.g., `sagar/sea-crew-manager`) and your **Token** when asked.
4. The script will upload everything automatically.

### Option B: The Manual Way
1. Go to the **Files** tab in your Space.
2. Click **"Add file"** -> **"Upload files"**.
3. Drag and drop all files from your `d:\SeaCrewManager` folder (except `node_modules`).
4. Wait for it to upload and click **"Commit changes"**.

## Step 5: Wait and Launch!
1. Go back to the **App** tab.
2. You will see it building. After 2-3 minutes, it will say **"Running"**.
3. Your website is ready at: `https://huggingface.co/spaces/YOUR_USERNAME/sea-crew-manager`

Now just send that link to your 5 users (or 50 users!).

## Performance & Scaling Notes
- **User Count**: Hugging Face gives you **16GB of RAM** and **2 CPUs**. This can easily handle **20 to 50 concurrent users** at the same time without any issues. If you have 500+ users, it might slow down, but for a crew management system, it is very powerful.
- **Auto-Sleep**: Unlike other free services that sleep after 15 minutes, Hugging Face Spaces usually stay "awake" for **48 hours** of inactivity. This means your users won't have to wait for it to "wake up" most of the time.
- **Reliability**: If you ever need even more power, you can upgrade your Space to a "GPU" or better CPU in the settings, but for now, the Free tier is perfect.
