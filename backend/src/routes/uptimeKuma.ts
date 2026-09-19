import { Router } from "express";
import { getMonitors, uptimeKumaAvailable } from "../integrations/uptimeKuma.js";

export const uptimeKumaRouter = Router();

uptimeKumaRouter.get("/monitors", async (_req, res) => {
  if (!uptimeKumaAvailable()) return res.json({ available: false, monitors: [] });
  res.json({ available: true, monitors: await getMonitors() });
});
