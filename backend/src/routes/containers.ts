import { Router } from "express";
import { z } from "zod";
import { getSnapshot, refreshSnapshot } from "../engines/monitoring.js";
import { getContainerLogs, performContainerAction, type ContainerAction } from "../integrations/docker.js";
import { runAction } from "../engines/actions.js";

export const containersRouter = Router();

containersRouter.get("/", (_req, res) => {
  const snapshot = getSnapshot();
  res.json({ containers: snapshot.containers, generatedAt: snapshot.generatedAt });
});

containersRouter.get("/:id/logs", async (req, res) => {
  try {
    const tail = Number(req.query.tail ?? 200);
    const logs = await getContainerLogs(req.params.id, Number.isFinite(tail) ? tail : 200);
    res.json({ logs });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "logs_unavailable" });
  }
});

const actionSchema = z.object({
  action: z.enum(["start", "stop", "restart", "pause", "unpause"]),
});

const ACTION_KEY: Record<ContainerAction, string> = {
  start: "container.start",
  stop: "container.stop",
  restart: "container.restart",
  pause: "container.pause",
  unpause: "container.unpause",
};

containersRouter.post("/:id/actions", async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });

  const { action } = parsed.data;
  const actionKey = ACTION_KEY[action];
  const containerId = req.params.id;

  try {
    await runAction(
      { userId: req.auth.user.id, userDisplayName: req.auth.user.display_name, userRole: req.auth.user.role },
      actionKey,
      containerId,
      { action },
      () => performContainerAction(containerId, action)
    );
    await refreshSnapshot();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.status ?? 502).json({ error: err.message ?? "action_failed" });
  }
});
