import http from "node:http";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import { runMigrations } from "./db/client.js";
import { seedAdmin } from "./db/seed.js";
import { loadAuth, requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { startMonitoringLoop } from "./engines/monitoring.js";
import { createSnapshotBroadcaster } from "./ws/index.js";

import { authRouter } from "./routes/auth.js";
import { hostsRouter } from "./routes/hosts.js";
import { servicesRouter } from "./routes/services.js";
import { containersRouter } from "./routes/containers.js";
import { proxmoxRouter } from "./routes/proxmox.js";
import { metricsRouter } from "./routes/metrics.js";
import { eventsRouter } from "./routes/events.js";
import { quickActionsRouter } from "./routes/quickActions.js";
import { configRouter } from "./routes/config.js";
import { searchRouter } from "./routes/search.js";
import { linksRouter } from "./routes/links.js";
import { homeAssistantRouter } from "./routes/homeassistant.js";

runMigrations();
seedAdmin();

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(loadAuth);

const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });
app.use("/api", apiLimiter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "homelab-control-center-backend", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);

// Everything below requires an authenticated session.
app.use("/api/hosts", requireAuth, hostsRouter);
app.use("/api/services", requireAuth, servicesRouter);
app.use("/api/containers", requireAuth, containersRouter);
app.use("/api/proxmox", requireAuth, proxmoxRouter);
app.use("/api/metrics", requireAuth, metricsRouter);
app.use("/api/events", requireAuth, eventsRouter);
app.use("/api/quick-actions", requireAuth, quickActionsRouter);
app.use("/api/config", requireAuth, configRouter);
app.use("/api/search", requireAuth, searchRouter);
app.use("/api/links", requireAuth, linksRouter);
app.use("/api/home-assistant", requireAuth, homeAssistantRouter);

app.use("/api", notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);
const broadcaster = createSnapshotBroadcaster(server);

startMonitoringLoop(10_000, (snapshot) => broadcaster.broadcast(snapshot));

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] MK HomeLab Control Center backend listening on :${env.port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
