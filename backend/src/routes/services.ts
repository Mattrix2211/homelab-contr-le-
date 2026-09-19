import { Router } from "express";
import { getSnapshot } from "../engines/monitoring.js";

export const servicesRouter = Router();

servicesRouter.get("/", (_req, res) => {
  const snapshot = getSnapshot();
  res.json({ services: snapshot.services, generatedAt: snapshot.generatedAt });
});

servicesRouter.get("/:id", (req, res) => {
  const snapshot = getSnapshot();
  const service = snapshot.services.find((s) => s.id === req.params.id);
  if (!service) return res.status(404).json({ error: "not_found" });
  const container = service.containerName
    ? snapshot.containers.find((c) => c.name === service.containerName)
    : undefined;
  res.json({ service, container, generatedAt: snapshot.generatedAt });
});
