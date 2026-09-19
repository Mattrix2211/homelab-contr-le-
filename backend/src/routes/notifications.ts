import { Router } from "express";
import { z } from "zod";
import { notificationChannelsRepo } from "../db/repo.js";
import { sendTestNotification } from "../integrations/notifications.js";
import { requireRole } from "../middleware/auth.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireRole("admin"), (_req, res) => {
  res.json({ channels: notificationChannelsRepo.list() });
});

const createSchema = z.object({
  kind: z.enum(["discord", "homeassistant"]),
  target: z.string().min(1).max(500),
  minSeverity: z.enum(["info", "warning", "critical"]),
});

notificationsRouter.post("/", requireRole("admin"), (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const id = notificationChannelsRepo.create(parsed.data);
  res.status(201).json({ id });
});

notificationsRouter.post("/:id/test", requireRole("admin"), async (req, res) => {
  const channel = notificationChannelsRepo.list().find((c) => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: "not_found" });
  try {
    await sendTestNotification(channel);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "test_failed" });
  }
});

notificationsRouter.delete("/:id", requireRole("admin"), (req, res) => {
  notificationChannelsRepo.remove(req.params.id);
  res.json({ ok: true });
});
