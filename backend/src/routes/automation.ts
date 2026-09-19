import { Router } from "express";
import { z } from "zod";
import { automationRulesRepo } from "../db/repo.js";
import { ACTIONS } from "../engines/actions.js";
import { requireRole } from "../middleware/auth.js";

export const automationRouter = Router();

automationRouter.get("/", requireRole("admin"), (_req, res) => {
  res.json({ rules: automationRulesRepo.list(), availableActions: Object.values(ACTIONS) });
});

const createSchema = z.object({
  name: z.string().min(1).max(80),
  triggerKind: z.enum(["service_down", "host_down"]),
  triggerTarget: z.string().min(1),
  triggerMinutes: z.number().int().min(1).max(180),
  actionKey: z.string().min(1),
  actionTarget: z.string().min(1),
  cooldownMinutes: z.number().int().min(1).max(1440),
});

automationRouter.post("/", requireRole("admin"), (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  if (!ACTIONS[parsed.data.actionKey]) return res.status(400).json({ error: "unknown_action" });

  const id = automationRulesRepo.create({ ...parsed.data, createdBy: req.auth.user.id });
  res.status(201).json({ id });
});

const enabledSchema = z.object({ enabled: z.boolean() });

automationRouter.post("/:id/enabled", requireRole("admin"), (req, res) => {
  const parsed = enabledSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  automationRulesRepo.setEnabled(req.params.id, parsed.data.enabled);
  res.json({ ok: true });
});

automationRouter.delete("/:id", requireRole("admin"), (req, res) => {
  automationRulesRepo.remove(req.params.id);
  res.json({ ok: true });
});
