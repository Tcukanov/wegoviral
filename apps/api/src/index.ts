import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import trendingRoutes from "./routes/trending";
import analyzeUrlRoutes from "./routes/analyzeUrl";
import adminRoutes from "./routes/admin";
import authRoutes from "./routes/auth";
import { errorHandler } from "./middleware/errorHandler";
import { startScraperCron } from "./jobs/scraperCron";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/trending", trendingRoutes);
app.use("/api/analyze-url", analyzeUrlRoutes);
app.use("/api/admin", adminRoutes);
app.use("/auth", authRoutes);

// Redirect /api/stats → /api/admin/stats for convenience
app.get("/api/stats", (_req, res) => res.redirect("/api/admin/stats"));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 wegoviral API running on http://localhost:${PORT}`);
  startScraperCron();
});

export default app;
