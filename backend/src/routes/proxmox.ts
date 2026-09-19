import { Router } from "express";
import { z } from "zod";
import { getNodeStatus, listGuests, performGuestAction, proxmoxAvailable, recentTasks } from "../integrations/proxmox.js";
import { runAction } from "../engines/actions.js";

export const proxmoxRouter = Router();

proxmoxRouter.get("/status", async (_req, res) => {
  if (!proxmoxAvailable()) return res.json({ available: false });
  const node = await getNodeStatus();
  res.json({ available: true, node });
});

proxmoxRouter.get("/guests", async (_req, res) => {
  const guests = await listGuests();
  res.json({ guests });
});

proxmoxRouter.get("/tasks", async (_req, res) => {
  const tasks = await recentTasks();
  res.json({ tasks });
});

const actionSchema = z.object({
  type: z.enum(["qemu", "lxc"]),
  action: z.enum(["start", "shutdown", "stop", "reboot"]),
});

const ACTION_KEY = {
  start: "guest.start",
  shutdown: "guest.shutdown",
  stop: "guest.shutdown",
  reboot: "guest.reboot",
} as const;

proxmoxRouter.post("/guests/:vmid/actions", async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });

  const vmid = Number(req.params.vmid);
  const { type, action } = parsed.data;

  try {
    await runAction(
      { userId: req.auth.user.id, userDisplayName: req.auth.user.display_name, userRole: req.auth.user.role },
      ACTION_KEY[action],
      `${type}/${vmid}`,
      { action },
      () => performGuestAction(type, vmid, action)
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.status ?? 502).json({ error: err.message ?? "action_failed" });
  }
});
