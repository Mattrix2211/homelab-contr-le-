import { Router } from "express";
import { z } from "zod";
import { backupsRepo } from "../db/repo.js";
import { executeBackup } from "../engines/backups.js";
import { runAction } from "../engines/actions.js";

export const backupsRouter = Router();

backupsRouter.get("/", (_req, res) => {
  res.json({ backups: backupsRepo.list() });
});

const createSchema = z.object({
  label: z.string().min(1).max(80),
  kind: z.enum(["homeassistant", "truenas-snapshot", "custom"]),
  targetRef: z.string().max(200).optional(),
  triggerUrl: z.string().url().max(500).optional(),
});

backupsRouter.post("/", (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const id = backupsRepo.create({ ...parsed.data, createdBy: req.auth.user.id });
  res.status(201).json({ id });
});

backupsRouter.delete("/:id", (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  backupsRepo.remove(req.params.id);
  res.json({ ok: true });
});

backupsRouter.post("/:id/run", async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  const backup = backupsRepo.findById(req.params.id);
  if (!backup) return res.status(404).json({ error: "not_found" });

  try {
    await runAction(
      { userId: req.auth.user.id, userDisplayName: req.auth.user.display_name, userRole: req.auth.user.role },
      "backup.run",
      backup.label,
      { kind: backup.kind },
      () => executeBackup(backup)
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.status ?? 502).json({ error: err.message ?? "backup_failed" });
  }
});
