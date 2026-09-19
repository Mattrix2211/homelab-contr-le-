import { Router } from "express";
import { getUpdatesCache } from "../engines/updates.js";

export const updatesRouter = Router();

updatesRouter.get("/", (_req, res) => {
  res.json(getUpdatesCache());
});
