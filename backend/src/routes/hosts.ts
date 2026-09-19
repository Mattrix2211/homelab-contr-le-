import { Router } from "express";
import { getSnapshot } from "../engines/monitoring.js";

export const hostsRouter = Router();

hostsRouter.get("/", (_req, res) => {
  const snapshot = getSnapshot();
  res.json({ hosts: snapshot.hosts, generatedAt: snapshot.generatedAt });
});

hostsRouter.get("/:id", (req, res) => {
  const snapshot = getSnapshot();
  const host = snapshot.hosts.find((h) => h.id === req.params.id);
  if (!host) return res.status(404).json({ error: "not_found" });
  const services = snapshot.services.filter((s) => s.hostId === host.id);
  res.json({ host, services, generatedAt: snapshot.generatedAt });
});
