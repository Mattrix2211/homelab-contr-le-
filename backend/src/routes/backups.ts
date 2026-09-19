import { Router } from "express";
import { z } from "zod";
import { backupsRepo } from "../db/repo.js";
import { executeBackup } from "../engines/backups.js";
import { runAction } from "../engines/actions.js";
import { requireRole } from "../middleware/auth.js";

export const backupsRouter = Router();

backupsRouter.get("/", (_req, res) => {
  res.json({ backups: backupsRepo.list() });
});

// Defense in depth against SSRF via a "custom" backup's webhook: blocks the
// obvious private/loopback/link-local/metadata literal hostnames. This is a
// literal-hostname check, not DNS-rebinding-proof, but the primary control
// is requireRole("admin") below - only trusted operators can set this URL
// at all.
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./, // link-local, includes cloud metadata endpoints
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc00:/i,
  /^\[?fd00:/i,
];

function isBlockedTriggerHost(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== "https:") return true;
    return BLOCKED_HOST_PATTERNS.some((re) => re.test(hostname));
  } catch {
    return true;
  }
}

const createSchema = z.object({
  label: z.string().min(1).max(80),
  kind: z.enum(["homeassistant", "truenas-snapshot", "custom"]),
  targetRef: z.string().max(200).optional(),
  triggerUrl: z.string().url().max(500).optional(),
});

backupsRouter.post("/", requireRole("admin"), (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  if (parsed.data.triggerUrl && isBlockedTriggerHost(parsed.data.triggerUrl)) {
    return res.status(400).json({ error: "trigger_url_not_allowed" });
  }

  const id = backupsRepo.create({ ...parsed.data, createdBy: req.auth.user.id });
  res.status(201).json({ id });
});

backupsRouter.delete("/:id", requireRole("admin"), (req, res) => {
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
