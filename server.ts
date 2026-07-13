import dotenv from "dotenv";
dotenv.config({ override: true });
import "./src/config/env.ts"; // Auto-validates environment configuration on server boot
import express from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import apiRouter from "./src/routes/index.ts";
import { errorHandler } from "./src/middleware/errorHandler.ts";
import { activityLogger } from "./src/middleware/activityLogger.ts";
import { sanitizeInput } from "./src/middleware/sanitize.ts";
import { seedDatabaseIfEmpty } from "./src/lib/db.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust the reverse proxy (required for Cloud Run / load balancers)
  app.set("trust proxy", 1);

  // Run database automatic seeding if empty (non-blocking, but handles failures)
  try {
    await seedDatabaseIfEmpty();
  } catch (seedErr) {
    console.warn("⚠️ Database auto-seed check skipped or failed:", seedErr);
  }
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false, // Permissive in dev for Vite's HMR socket connection
      crossOriginEmbedderPolicy: false,
      frameguard: false, // Disabled to allow the app to be rendered inside the AI Studio preview iframe
    })
  );
  app.use(
    cors({
      origin: process.env.APP_URL || "http://localhost:3000",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true,
      maxAge: 86400, // 24 hours preflight caching
    })
  );

  // 3. API Rate Limiting (DoS and Brute-force Prevention)
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 500, // Limit each IP address to 500 requests per 15 mins
    standardHeaders: "draft-7",
    legacyHeaders: false,
    validate: false,
    message: {
      status: "fail",
      statusCode: 429,
      message: "Too many requests from this IP address. Please try again later.",
    },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20, // Strict: Limit each IP to 20 login/register requests per 15 mins
    standardHeaders: "draft-7",
    legacyHeaders: false,
    validate: false,
    message: {
      status: "fail",
      statusCode: 429,
      message: "Too many authentication attempts. Please try again after 15 minutes.",
    },
  });

  // Apply rate limiters to routes
  app.use("/api", generalLimiter);
  app.use("/api/auth", authLimiter);

  // 4. Global Body Parsers, XSS Input Sanitization, and Activity Logger
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.use(sanitizeInput); // Deep HTML/Script escaping sanitization to secure database writes
  app.use(activityLogger); // Dynamic audit activity logger
  app.use("/api", apiRouter);

  // Health probe route
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      databaseMode: process.env.DATABASE_URL ? "PostgreSQL (Prisma)" : "In-Memory Fallback",
      version: "1.0.0"
    });
  });

  // Setup Vite asset-serving middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("🔨 Starting Vite Dev Server Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("📦 Serving static production assets from dist/");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Interception Middleware
  app.use(errorHandler);

  // Bind server on port 3000 and interface 0.0.0.0 for container routing
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 ERP Backend API Engine online at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("❌ Fatal crash starting the server process:", err);
  process.exit(1);
});
