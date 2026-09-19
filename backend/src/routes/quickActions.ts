import { Router } from "express";
import { z } from "zod";
import { quickActionsRepo } from "../db/repo.js";

export const quickActionsRouter = Router();

quickActionsRouter.get("/", (_req, res) => {
  res.json({ quickActions: quickActionsRepo.list() });
});

const createSchema = z.object({
  label: z.string().min(1).max(80),
  actionKey: z.string().min(1),
  target: z.string().min(1),
});

quickActionsRouter.post("/", (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const { label, actionKey, target } = parsed.data;
  const id = quickActionsRepo.add(label, actionKey, target, req.auth.user.id);
  res.status(201).json({ id });
});

quickActionsRouter.delete("/:id", (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  quickActionsRepo.remove(req.params.id);
  res.json({ ok: true });
});
