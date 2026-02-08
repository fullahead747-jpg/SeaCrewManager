/**
 * Document Viewer Route - Secure Token-Based Access
 * Allows viewing documents via time-limited secure tokens
 * Used in email notifications for document viewing
 */
import { documentAccessService } from '../services/document-access-service';
import { DocumentStorageService } from '../objectStorage';
import path from 'path';
import fs from 'fs';

export function setupDocumentViewerRoute(app: any) {
  app.get('/api/documents/view/:token', async (req: any, res: any) => {
    const { token } = req.params;

    console.log(`📥 Document view request: ${token.substring(0, 20)}...`);

    try {
      // Validate token and get document
      const document = await documentAccessService.getDocumentByToken(token);

      if (!document || !document.filePath) {
        console.log('❌ Invalid or expired token, or document has no file');
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                text-align: center;
                background: white;
                padding: 60px 40px;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                max-width: 500px;
              }
              .icon {
                font-size: 80px;
                margin-bottom: 20px;
              }
              h1 {
                color: #1e3a5f;
                margin: 0 0 15px 0;
                font-size: 28px;
              }
              p {
                color: #6b7280;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 10px 0;
              }
              .code {
                background: #f3f4f6;
                padding: 8px 12px;
                border-radius: 6px;
                font-family: monospace;
                font-size: 14px;
                color: #dc2626;
                margin-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">🔒</div>
              <h1>Document Not Found</h1>
              <p>This link has expired or is invalid.</p>
              <p>Document access links are valid for 48 hours.</p>
              <p>Please request a new link from SeaCrewManager.</p>
              <div class="code">Error: TOKEN_INVALID_OR_EXPIRED</div>
            </div>
          </body>
          </html>
        `);
      }

      console.log(`✅ Serving document: ${document.type} - ${document.documentNumber}`);

      const documentStorageService = new DocumentStorageService();
      await documentStorageService.downloadDocument(document.filePath, res);

    } catch (error) {
      console.error('❌ Error serving document:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  });
}
