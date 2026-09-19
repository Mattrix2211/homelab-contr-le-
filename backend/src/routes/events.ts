import { Router } from "express";
import { eventsRepo, auditRepo } from "../db/repo.js";

export const eventsRouter = Router();

eventsRouter.get("/", (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 200) || 200, 500);
  res.json({ events: eventsRepo.list(limit) });
});

eventsRouter.get("/alerts", (_req, res) => {
  res.json({ alerts: eventsRepo.activeAlerts() });
});

eventsRouter.get("/audit", (req, res) => {
  if (!req.auth || req.auth.user.role !== "admin") {
    return res.status(403).json({ error: "insufficient_role" });
  }
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
  res.json({ entries: auditRepo.list(limit) });
});
