import { Router } from "express";
import { callService, getStatus, homeAssistantAvailable } from "../integrations/homeassistant.js";
import { runAction } from "../engines/actions.js";

export const homeAssistantRouter = Router();

homeAssistantRouter.get("/status", async (_req, res) => {
  if (!homeAssistantAvailable()) return res.json({ available: false });
  const status = await getStatus();
  res.json({ available: true, status });
});

homeAssistantRouter.post("/restart", async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  try {
    await runAction(
      { userId: req.auth.user.id, userDisplayName: req.auth.user.display_name, userRole: req.auth.user.role },
      "homeassistant.restart",
      "home-assistant",
      undefined,
      () => callService("homeassistant", "restart")
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.status ?? 502).json({ error: err.message ?? "action_failed" });
  }
});
