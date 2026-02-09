import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import * as fs from 'fs';
import * as path from 'path';

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

console.log(`[STORAGE-INIT] Initializing Object Storage Client...`);
export const objectStorageClient = new Storage({
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
console.log(`[STORAGE-INIT] Client initialized. PRIVATE_OBJECT_DIR: ${process.env.PRIVATE_OBJECT_DIR || 'NOT SET'}`);

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
  async downloadDocument(encodedFilePath: string, res: Response, cacheTtlSec: number = 3600) {
    // Decode the path since it might come from a URL (e.g., with %20 for spaces)
    const filePath = decodeURIComponent(encodedFilePath);
    const isCloudAvailable = this.isCloudStorageAvailable();

    console.log(`[STORAGE-DOWNLOAD] Starting download for: ${filePath} (Cloud Available: ${isCloudAvailable})`);

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
          return res.sendFile(fullPath);
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

      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `private, max-age=${cacheTtlSec}`,
      });

      // Download the file content into memory (more robust for small/medium files on Replit)
      console.log(`[STORAGE-DOWNLOAD] Fetching buffer from storage for ${objectName}...`);
      const [buffer] = await objectFile.download();

      console.log(`[STORAGE-DOWNLOAD] Successfully fetched buffer (${buffer.length} bytes). Sending to response...`);
      res.send(buffer);
      console.log(`[STORAGE-DOWNLOAD] Successfully sent file: ${filePath}`);
    } catch (error: any) {
      console.error("[STORAGE-DOWNLOAD] Error downloading file:", error.message);
      if (error.stack) console.error(error.stack);

      if (!res.headersSent) {
        if (error instanceof ObjectNotFoundError) {
          res.status(404).json({ error: "File not found in Object Storage" });
        } else {
          // Check if it's a connection error
          const isConnectionError = error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND');
          const errorMessage = isConnectionError
            ? `Storage connection error: ${error.message}. If running locally, Replit Object Storage is not available.`
            : `Storage error: ${error.message}`;

          res.status(500).json({ error: errorMessage });
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