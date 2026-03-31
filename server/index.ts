import { config } from 'dotenv';
import path from 'path';

// Improved .env loading for berbagai environment
const envPath = path.resolve(process.cwd(), '.env');
const dotenvResult = config({ path: envPath });

if (dotenvResult.error) {
  // Try one directory up if not found (common in some build setups)
  const fallbackPath = path.resolve(process.cwd(), '..', '.env');
  const fallbackResult = config({ path: fallbackPath });
  
  if (fallbackResult.error) {
    console.warn('⚠️  Note: .env file not found in common locations. Using environment variables from system.');
  } else {
    const keys = Object.keys(fallbackResult.parsed || {}).length;
    console.log(`✅ .env loaded from fallback location (${keys} keys injected)`);
  }
} else {
  const keys = Object.keys(dotenvResult.parsed || {}).length;
  console.log(`✅ .env loaded successfully (${keys} keys injected)`);
}

console.log(`[SERVER-INIT] Application initialized at ${new Date().toISOString()}`);
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { backgroundScheduler } from "./services/background-scheduler";
import compression from "compression";

const app = express();
app.use(compression());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: false, limit: '100mb' }));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));
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
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  // CRITICAL: Ensure database URL is present
  if (!process.env.DATABASE_URL) {
    console.error('\n\n❌ CRITICAL ERROR: DATABASE_URL is not set in environment variables.');
    console.error('Please ensure your .env file exists and contains a valid DATABASE_URL.\n\n');
    process.exit(1);
  }

  // Safety check for SESSION_SECRET in production
  if (app.get("env") === "production" && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "seacrewmanager-secret-key")) {
    console.warn('\n\n⚠️ WARNING: You are running in PRODUCTION with a default or missing SESSION_SECRET.');
    console.warn('Please set a strong SESSION_SECRET in your environment variables for security.\n\n');
  }

  // CRITICAL: Log database host for identification
  const dbUrl = process.env.DATABASE_URL;
  const dbHost = new URL(dbUrl).hostname;
  const dbSnippet = dbUrl.substring(0, 15) + '...';
  console.log('\n\n================================================');
  console.log(`🚀 APP STARTING - DB HOST: ${dbHost}`);
  console.log(`🔑 DB URL SNIPPET: ${dbSnippet}`);
  console.log('================================================\n\n');

  setupAuth(app);
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Log detailed error for server console
    console.error(`[ERROR] ${new Date().toISOString()} - ${status}: ${message}`);
    if (err.stack) {
      console.error(err.stack);
    }
    
    res.status(status).json({ message });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: process.platform !== "win32",
  }, () => {
    log(`serving on port ${port}`);
    // Explicitly ensure the background scheduler is initialized and running
    try {
      backgroundScheduler.start();
      log('Background scheduler validated on startup');
    } catch (e) {
      console.error('Failed to initialize background scheduler:', e);
    }
  });
})();

