import { Router } from "express";
import { getAnomaliesCache } from "../engines/anomaly.js";

export const anomaliesRouter = Router();

anomaliesRouter.get("/", (_req, res) => {
  res.json(getAnomaliesCache());
});
