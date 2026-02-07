

import 'dotenv/config'; // Load environment variables from .env file
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { backgroundScheduler } from "./services/background-scheduler";

const API_KEY = process.env.WHATSAPP_API_KEY || 'your-api-key';
const app = express();
app.use(express.json({ limit: '100mb' })); // Increased limit for OCR image uploads
app.use(express.urlencoded({ extended: false, limit: '100mb' }));

// Serve uploaded files from the uploads directory
app.use('/uploads', express.static('uploads'));

// Serve chatbot interface from public directory
app.use(express.static('public'));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Initialize routes immediately (not in async IIFE) for Vercel compatibility
let routesInitialized = false;
let initPromise: Promise<any> | null = null;

async function ensureRoutesInitialized() {
  if (routesInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const API_KEY = process.env.WHATSAPP_API_KEY || 'your-api-key';

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      console.error('Error:', err);
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Only start server if not in Vercel serverless environment
    if (process.env.VERCEL !== '1') {
      // ALWAYS serve the app on the port specified in the environment variable PORT
      // Other ports are firewalled. Default to 5000 if not specified.
      // this serves both the API and the client.
      // It is the only port that is not firewalled.
      const port = parseInt(process.env.PORT || '5000', 10);
      server.listen({
        port,
        host: "0.0.0.0",
        reusePort: process.platform !== "win32",
      }, async () => {
        log(`serving on port ${port}`);

        // Initialize Baileys WhatsApp
        /* Disabled as per user request
        try {
          const { initializeBaileys } = await import('./baileys-init');
          await initializeBaileys();
          log('Baileys WhatsApp initialized successfully');
        } catch (error) {
          console.error('Failed to initialize Baileys:', error);
        }
        */

        // Start the background notification scheduler
        /* Disabled as per user request
        try {
          backgroundScheduler.start();
          log('Background notification scheduler started successfully');
        } catch (error) {
          console.error('Failed to start background scheduler:', error);
        }
        */
      });
    }

    routesInitialized = true;
  })();

  return initPromise;
}

// Middleware to ensure routes are initialized before handling requests
app.use(async (req, res, next) => {
  await ensureRoutesInitialized();
  next();
});

// Start initialization immediately if not on Vercel
if (process.env.VERCEL !== '1') {
  ensureRoutesInitialized();
}

// Export the app for Vercel serverless functions
export default app;

