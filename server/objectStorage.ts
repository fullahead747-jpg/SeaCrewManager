import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import * as fs from 'fs';
import * as path from 'path';

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

console.log(`[STORAGE-INIT] Initializing Object Storage Client...`);

function initStorage() {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
  const isReplitManaged = privateObjectDir?.startsWith('/replit-objstore-');
  const hasSidecar = !!REPLIT_SIDECAR_ENDPOINT;

  console.log(`[STORAGE-INIT] Checking environment: PRIVATE_OBJECT_DIR=${privateObjectDir || 'NONE'}, isReplitManaged=${isReplitManaged}`);

  // 1. Check if we are using a Replit-managed bucket
  // FORCE Replit sidecar if PRIVATE_OBJECT_DIR is set, even if it doesn't start with the prefix
  // often the prefix might be different in future Replit versions, but the sidecar is the source of truth for Replit storage.
  if (isReplitManaged || privateObjectDir) {
    console.log(`[STORAGE-INIT] 🛡️ REPLIT DETECTED. Using Replit Sidecar for bucket access.`);
    return new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: "json",
            subject_token_field_name: "access_token",
          },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "replit-production",
    });
  }

  // 2. Fallback to storage-specific credentials (ONLY if NOT on Replit)
  if (process.env.GOOGLE_STORAGE_CREDENTIALS_CONTENT) {
    try {
      console.log(`[STORAGE-INIT] 🔑 Using credentials from GOOGLE_STORAGE_CREDENTIALS_CONTENT`);
      const credentials = JSON.parse(process.env.GOOGLE_STORAGE_CREDENTIALS_CONTENT);
      return new Storage({
        credentials,
        projectId: process.env.DOCUMENT_AI_PROJECT_ID || process.env.GCP_PROJECT_ID || undefined
      });
    } catch (e) {
      console.error(`[STORAGE-INIT] ❌ Failed to parse GOOGLE_STORAGE_CREDENTIALS_CONTENT:`, e);
    }
  }

  // 3. Fallback to generic credentials if available
  // WARNING: This often fails for storage if the account only has Document AI roles
  if (process.env.GOOGLE_CREDENTIALS_CONTENT) {
    try {
      console.log(`[STORAGE-INIT] ⚠️ FALLBACK: Using credentials from GOOGLE_CREDENTIALS_CONTENT (generic)`);
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_CONTENT);
      return new Storage({
        credentials,
        projectId: process.env.DOCUMENT_AI_PROJECT_ID || process.env.GCP_PROJECT_ID || undefined
      });
    } catch (e) {
      console.error(`[STORAGE-INIT] ❌ Failed to parse GOOGLE_CREDENTIALS_CONTENT:`, e);
    }
  }

  // 4. Default fallback (Sidecar)
  console.log(`[STORAGE-INIT] 🛰️ No specific credentials found, using default sidecar fallback.`);
  return new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
      type: "external_account",
      credential_source: {
        url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
        format: {
          type: "json",
          subject_token_field_name: "access_token",
        },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "replit-production",
  });
}

export const objectStorageClient = initStorage();
console.log(`[STORAGE-INIT] Client initialized. Project: ${objectStorageClient.projectId}. PRIVATE_OBJECT_DIR: ${process.env.PRIVATE_OBJECT_DIR || 'NOT SET'}`);

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service for all documents (Vessel and Crew)
export class DocumentStorageService {
  constructor() { }

  // Check if Replit Cloud Storage is available
  isCloudStorageAvailable(): boolean {
    return !!process.env.PRIVATE_OBJECT_DIR;
  }

  // Gets the private object directory for documents
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
        "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Gets the upload URL for a document
  async getDocumentUploadURL(entityType: 'vessels' | 'crew', entityId: string, fileName: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/${entityType}/${entityId}/documents/${objectId}-${fileName}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900, // 15 minutes
    });
  }

  // Gets the download URL for a document
  async getDocumentDownloadURL(filePath: string): Promise<string> {
    const { bucketName, objectName } = parseObjectPath(filePath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "GET",
      ttlSec: 3600, // 1 hour
    });
  }

  // Gets the document file from the file path
  async getDocumentFile(filePath: string): Promise<File> {
    const decodedPath = decodeURIComponent(filePath);
    const { bucketName, objectName } = parseObjectPath(decodedPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }


  // Downloads a document to the response
  async downloadDocument(encodedFilePath: string, res: Response, cacheTtlSec: number = 3600, fileName?: string, disposition: 'inline' | 'attachment' = 'inline') {
    // Decode the path since it might come from a URL (e.g., with %20 for spaces)
    const filePath = decodeURIComponent(encodedFilePath);
    const isCloudAvailable = this.isCloudStorageAvailable();

    console.log(`[STORAGE-DOWNLOAD] Starting download for: ${filePath}`);
    console.log(`[STORAGE-DOWNLOAD] Parameters - Cloud Available: ${isCloudAvailable}, FileName: "${fileName || 'NOT PROVIDED'}", Disposition: "${disposition}"`);

    // LOCAL FALLBACK: If path starts with 'uploads/' or cloud storage is unavailable
    // Note: On Replit, Object Storage paths start with /replit-objstore... 
    // If the Secret is missing, we try to see if we can find it as a local absolute path.
    if (filePath.startsWith('uploads/') || !isCloudAvailable) {
      try {
        // If it's an absolute path (like /replit-objstore-...), use it as is.
        // Otherwise, join with process.cwd()
        const fullPath = filePath.startsWith('/') ? filePath : path.join(process.cwd(), filePath);
        console.log(`[STORAGE-DOWNLOAD-LOCAL] Checking local file: ${fullPath}`);

        if (fs.existsSync(fullPath)) {
          console.log(`[STORAGE-DOWNLOAD-LOCAL] Serving local file: ${fullPath}`);

          if (fileName) {
            console.log(`[STORAGE-DOWNLOAD-LOCAL] Setting Content-Disposition: ${disposition}; filename="${fileName}"`);
            res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
          }

          // Use the headers option for sendFile to ensure they aren't overridden
          return res.sendFile(fullPath, {
            headers: fileName ? { 'Content-Disposition': `${disposition}; filename="${fileName}"` } : {}
          });
        } else if (!isCloudAvailable) {
          console.error(`[STORAGE-DOWNLOAD-LOCAL] Local file not found and cloud unavailable: ${fullPath}`);
          return res.status(404).json({
            error: "File not found locally",
            details: `Looked at: ${fullPath}. Cloud storage is also not configured (PRIVATE_OBJECT_DIR missing).`
          });
        }
        // If it doesn't exist locally but cloud IS available, continue to cloud download
        console.log(`[STORAGE-DOWNLOAD-LOCAL] Local file not found, but cloud is available. Continuing to cloud...`);
      } catch (localError: any) {
        console.error(`[STORAGE-DOWNLOAD-LOCAL] Error checking local file:`, localError);
      }
    }

    try {
      const { bucketName, objectName } = parseObjectPath(filePath);
      console.log(`[STORAGE-DOWNLOAD] Parsed: Bucket=${bucketName}, Object=${objectName}`);

      const bucket = objectStorageClient.bucket(bucketName);
      const objectFile = bucket.file(objectName);

      console.log(`[STORAGE-DOWNLOAD] Checking if object exists: ${objectName} in bucket: ${bucketName}`);
      const [exists] = await objectFile.exists();
      if (!exists) {
        console.error(`[STORAGE-DOWNLOAD] Object does not exist: ${filePath} (Bucket: ${bucketName}, Object: ${objectName})`);
        throw new ObjectNotFoundError();
      }

      // Get file metadata
      console.log(`[STORAGE-DOWNLOAD] Fetching metadata for ${objectName}...`);
      const [metadata] = await objectFile.getMetadata();
      console.log(`[STORAGE-DOWNLOAD] Metadata: ContentType=${metadata.contentType}, Size=${metadata.size}`);

      let contentType = metadata.contentType || "application/octet-stream";
      if (filePath.toLowerCase().endsWith('.pdf') && contentType === 'application/octet-stream') {
        contentType = 'application/pdf';
      }

      // Set appropriate headers
      const headers: Record<string, string | number> = {
        "Content-Type": contentType,
        "Cache-Control": `private, max-age=${cacheTtlSec}`,
      };

      if (metadata.size) {
        headers["Content-Length"] = metadata.size;
      }

      if (fileName) {
        console.log(`[STORAGE-DOWNLOAD-CLOUD] Setting Content-Disposition: ${disposition}; filename="${fileName}"`);
        res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
      }

      // Explicitly set each header using setHeader for maximum reliability
      Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      console.log(`[STORAGE-DOWNLOAD-CLOUD] Final headers set. Content-Disposition: "${res.getHeader('Content-Disposition')}"`);

      // Download the file content into memory (more robust for small/medium files on Replit)
      console.log(`[STORAGE-DOWNLOAD] Fetching buffer from storage for ${objectName}...`);
      const [buffer] = await objectFile.download();

      console.log(`[STORAGE-DOWNLOAD] Successfully fetched buffer (${buffer.length} bytes). Sending to response...`);
      res.send(buffer);
      console.log(`[STORAGE-DOWNLOAD] Successfully sent file: ${filePath}`);
    } catch (error: any) {
      console.error("[STORAGE-DOWNLOAD] ❌ Error downloading file:", error.message);
      if (error.stack) console.error(error.stack);

      if (!res.headersSent) {
        if (error instanceof ObjectNotFoundError) {
          res.status(404).json({
            error: "File not found in Object Storage",
            details: `Path: ${filePath}. Check if the file was deleted or the path is incorrect.`
          });
        } else {
          // Check if it's a permission or connection error
          const isPermissionError = error.message.includes('permission');
          const isConnectionError = error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND');

          let errorMessage = `Storage error: ${error.message}`;
          if (isConnectionError) {
            errorMessage = `Storage connection error: ${error.message}. replit-objstore sidecar may be down or unavailable.`;
          } else if (isPermissionError) {
            errorMessage = `GCS Permission Denied: ${error.message}. This usually means the service account (or sidecar) doesn't have 'storage.objects.get' access to the bucket.`;
          }

          res.status(500).json({
            error: errorMessage,
            serviceAccount: objectStorageClient.projectId === 'replit-production' ? 'Replit Sidecar' : 'GCP Service Account',
            path: filePath
          });
        }
      }
    }
  }

  // Deletes a document from object storage
  async deleteDocument(filePath: string): Promise<boolean> {
    try {
      const file = await this.getDocumentFile(filePath);
      await file.delete();
      return true;
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return false;
      }
      console.error("Error deleting document:", error);
      throw error;
    }
  }

  // Normalize the file path from upload URL to storage path
  normalizeDocumentPath(uploadUrl: string): string {
    if (!uploadUrl.startsWith("https://storage.googleapis.com/")) {
      return uploadUrl;
    }

    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(uploadUrl);
    return url.pathname;
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
      `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}