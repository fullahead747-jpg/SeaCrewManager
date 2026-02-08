import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { backgroundScheduler } from "./services/background-scheduler";

const app = express();
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
  // CRITICAL: Log database host for identification
  const dbUrl = process.env.DATABASE_URL || '';
  const dbHost = dbUrl ? new URL(dbUrl).hostname : 'NOT SET';
  const dbSnippet = dbUrl ? dbUrl.substring(0, 15) + '...' : 'NONE';
  console.log('\n\n================================================');
  console.log(`🚀 APP STARTING - DB HOST: ${dbHost}`);
  console.log(`🔑 DB URL SNIPPET: ${dbSnippet}`);
  console.log('================================================\n\n');

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    console.error('Error:', err);
  });

  if (process.env.NODE_ENV === "development") {
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
  });
})();

