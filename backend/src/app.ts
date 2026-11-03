import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { integrations } from "./integrations/router.js";
import apiRoutes from "./routes/index.js";

dotenv.config();

const app: express.Express = express();

app.use(cors());
app.use(express.json());

app.use("/api/integrations", integrations);
// Preserve the original local ERP alongside the authenticated Connections API.
// The original ERP still needs authentication before public deployment.
app.use("/api", (_req, res, next) => {
  if (process.env.ENABLE_LEGACY_DEMO !== "false" && process.env.NODE_ENV !== "production") { next(); return; }
  res.status(403).json({ error: "LEGACY_DEMO_DISABLED", message: "Use the authenticated integrations API" });
}, apiRoutes);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Request failed", error instanceof Error ? error.name : "UnknownError");
  res.status(500).json({ error: "REQUEST_FAILED" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
