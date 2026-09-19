import { Router } from "express";
import { env } from "../config/env.js";

export const linksRouter = Router();

linksRouter.get("/", (_req, res) => {
  const entries = Object.entries(env.links).filter(([, url]) => !!url);
  res.json({ links: Object.fromEntries(entries) });
});
