# Replit Deployment Guide

Follow these steps to deploy the latest changes to your live site on Replit.

## 1. Set Environment Variables (Secrets)

In your Replit project, go to the **Secrets** (🔒) tab and ensure the following variables are correctly set:

| Secret Name | Description |
| :--- | :--- |
| `APP_URL` | The live URL of your application (e.g., `https://seacrewmanager.your-replit-username.repl.co`). **Do not use localhost.** |
| `DOCUMENT_AI_PROJECT_ID` | Your Google Cloud Project ID. |
| `DOCUMENT_AI_LOCATION` | The processor location (e.g., `us` or `eu`). |
| `DOCUMENT_AI_PROCESSOR_ID` | Your Google Document AI Processor ID. |
| `GOOGLE_CREDENTIALS_CONTENT` | The **entire content** of your `google-credentials.json` file. |

> [!IMPORTANT]
> Since Replit doesn't allow direct file uploads like `google-credentials.json` into the root easily for security, we've enabled the `GOOGLE_CREDENTIALS_CONTENT` secret. Copy the text from inside your JSON file and paste it as the value for this secret.

## 2. Push Changes to GitHub

If you are working locally, commit and push your changes to your GitHub repository.

```powershell
git add .
git commit -m "Fix live URLs and enable real OCR"
git push origin main
```

## 3. Pull Changes on Replit

In the Replit Console:

```bash
git pull origin main
```

## 4. Restart the Server

Replit should automatically restart the server when changes are detected, but you can manually trigger it by clicking **Stop** and then **Run**.

## 5. Verification

- **Live URL**: Test the "View" button on a crew card. It should now open in a new tab using your live domain.
- **Email Links**: Trigger an email notification (e.g., by uploading a document with a near expiry). The link in the email should correctly point to your live URL.
- **OCR Extraction**: Upload a new document (Passport or CDC). The system will now use the real Google Document AI service. Check the server console for `[OCR-START]` and `[OCR-COMPLETE]` logs.