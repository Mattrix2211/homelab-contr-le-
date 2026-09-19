import { Router } from "express";
import { z } from "zod";
import { prometheusAvailable, queryRange } from "../integrations/prometheus.js";

export const metricsRouter = Router();

const querySchema = z.object({
  promql: z.string().min(1),
  rangeMinutes: z.coerce.number().min(1).max(60 * 24 * 30).default(60),
  stepSeconds: z.coerce.number().min(5).max(3600).default(60),
});

metricsRouter.get("/available", (_req, res) => {
  res.json({ available: prometheusAvailable() });
});

metricsRouter.get("/range", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  if (!prometheusAvailable()) return res.json({ available: false, samples: [] });

  const { promql, rangeMinutes, stepSeconds } = parsed.data;
  const end = Math.floor(Date.now() / 1000);
  const start = end - rangeMinutes * 60;
  const samples = await queryRange(promql, start, end, stepSeconds);
  res.json({ available: true, samples });
});
