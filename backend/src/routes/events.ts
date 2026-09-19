import { Router } from "express";
import { eventsRepo, auditRepo } from "../db/repo.js";

export const eventsRouter = Router();

// A negative ?limit (Number(-1) is truthy) previously slipped through
// Math.min(-1, cap) === -1, and SQLite treats a negative LIMIT as
// "unlimited" - clamping to at least 1 closes that off.
function clampLimit(raw: unknown, fallback: number, cap: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(n, cap));
}

eventsRouter.get("/", (req, res) => {
  const limit = clampLimit(req.query.limit, 200, 500);
  res.json({ events: eventsRepo.list(limit) });
});

eventsRouter.get("/alerts", (_req, res) => {
  res.json({ alerts: eventsRepo.activeAlerts() });
});

eventsRouter.get("/audit", (req, res) => {
  if (!req.auth || req.auth.user.role !== "admin") {
    return res.status(403).json({ error: "insufficient_role" });
  }
  const limit = clampLimit(req.query.limit, 100, 500);
  res.json({ entries: auditRepo.list(limit) });
});
