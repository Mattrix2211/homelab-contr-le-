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
import { truenasRouter } from "./routes/truenas.js";
import { backupsRouter } from "./routes/backups.js";
import { networkRouter } from "./routes/network.js";
import { frigateRouter } from "./routes/frigate.js";
import { updatesRouter } from "./routes/updates.js";
import { startUpdatesLoop } from "./engines/updates.js";
import { automationRouter } from "./routes/automation.js";
import { startAutomationLoop } from "./engines/automation.js";
import { notificationsRouter } from "./routes/notifications.js";
import { preferencesRouter } from "./routes/preferences.js";
import { uptimeKumaRouter } from "./routes/uptimeKuma.js";
import { dispatchAlert } from "./integrations/notifications.js";
import { setAlertListener } from "./engines/monitoring.js";

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
app.use("/api/truenas", requireAuth, truenasRouter);
app.use("/api/backups", requireAuth, backupsRouter);
app.use("/api/network", requireAuth, networkRouter);
app.use("/api/frigate", requireAuth, frigateRouter);
app.use("/api/updates", requireAuth, updatesRouter);
app.use("/api/automation-rules", requireAuth, automationRouter);
app.use("/api/notification-channels", requireAuth, notificationsRouter);
app.use("/api/preferences", requireAuth, preferencesRouter);
app.use("/api/uptime-kuma", requireAuth, uptimeKumaRouter);

app.use("/api", notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);
const broadcaster = createSnapshotBroadcaster(server);

setAlertListener(dispatchAlert);
startMonitoringLoop(10_000, (snapshot) => broadcaster.broadcast(snapshot));
startUpdatesLoop();
startAutomationLoop();

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] MK HomeLab Control Center backend listening on :${env.port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

// Defense in depth: an unhandled rejection anywhere (a missed .catch on
// fire-and-forget work, for instance) terminates the process by default on
// modern Node - log and keep serving everyone else instead of one bad
// promise taking down the whole cockpit. An uncaught synchronous exception
// leaves state genuinely undefined, so that one still exits (the
// docker-compose restart policy brings it back up cleanly).
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("[process] unhandled rejection", reason);
});
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("[process] uncaught exception", err);
  process.exit(1);
});
