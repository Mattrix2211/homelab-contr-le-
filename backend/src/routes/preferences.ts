import { Router } from "express";
import { z } from "zod";
import { userPreferencesRepo } from "../db/repo.js";

export const preferencesRouter = Router();

preferencesRouter.get("/cockpit-layout", (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  const prefs = userPreferencesRepo.get(req.auth.user.id);
  res.json({ layout: prefs?.cockpit_layout ? JSON.parse(prefs.cockpit_layout) : null });
});

const layoutSchema = z.object({
  layout: z.array(z.object({ id: z.string(), visible: z.boolean() })),
});

preferencesRouter.post("/cockpit-layout", (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  const parsed = layoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  userPreferencesRepo.setCockpitLayout(req.auth.user.id, parsed.data.layout);
  res.json({ ok: true });
});

preferencesRouter.get("/notifications-last-seen", (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  const prefs = userPreferencesRepo.get(req.auth.user.id);
  res.json({ lastSeenAt: prefs?.notifications_last_seen_at ?? null });
});

preferencesRouter.post("/notifications-seen", (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  userPreferencesRepo.markNotificationsSeen(req.auth.user.id);
  res.json({ ok: true });
});
