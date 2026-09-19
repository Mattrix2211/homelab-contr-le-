import { Router } from "express";
import { z } from "zod";
import { backupsRepo, quickActionsRepo } from "../db/repo.js";
import { dispatchAction, runAction } from "../engines/actions.js";
import { executeBackup } from "../engines/backups.js";

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

quickActionsRouter.post("/:id/run", async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  const quickAction = quickActionsRepo.findById(req.params.id);
  if (!quickAction) return res.status(404).json({ error: "not_found" });

  const ctx = { userId: req.auth.user.id, userDisplayName: req.auth.user.display_name, userRole: req.auth.user.role };

  try {
    if (quickAction.action_key === "backup.run") {
      const backup = backupsRepo.findById(quickAction.target);
      if (!backup) return res.status(404).json({ error: "backup_not_found" });
      await runAction(ctx, "backup.run", backup.label, { quickActionId: quickAction.id }, () => executeBackup(backup));
    } else {
      await runAction(ctx, quickAction.action_key, quickAction.target, { quickActionId: quickAction.id }, () =>
        dispatchAction(quickAction.action_key, quickAction.target)
      );
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.status ?? 502).json({ error: err.message ?? "action_failed" });
  }
});
