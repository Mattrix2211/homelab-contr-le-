import { Router } from "express";
import { frigateAvailable, getStatus } from "../integrations/frigate.js";

export const frigateRouter = Router();

frigateRouter.get("/status", async (_req, res) => {
  if (!frigateAvailable()) return res.json({ available: false, cameras: [], events: [], cpuPercent: null, storageUsedBytes: null });
  const status = await getStatus();
  if (!status) return res.json({ available: true, cameras: [], events: [], cpuPercent: null, storageUsedBytes: null });
  res.json({ available: true, ...status });
});
