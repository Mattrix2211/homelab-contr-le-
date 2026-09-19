import { Router } from "express";
import { callService, getEntitiesSummary, getStatus, homeAssistantAvailable } from "../integrations/homeassistant.js";
import { getDeviceCount, zigbee2mqttAvailable } from "../integrations/zigbee2mqtt.js";
import { runAction } from "../engines/actions.js";

export const homeAssistantRouter = Router();

homeAssistantRouter.get("/status", async (_req, res) => {
  if (!homeAssistantAvailable()) return res.json({ available: false });
  const status = await getStatus();
  res.json({ available: true, status });
});

homeAssistantRouter.get("/entities-summary", async (_req, res) => {
  if (!homeAssistantAvailable()) return res.json({ available: false, summary: null });
  res.json({ available: true, summary: await getEntitiesSummary() });
});

homeAssistantRouter.get("/zigbee-devices", async (_req, res) => {
  if (!zigbee2mqttAvailable()) return res.json({ available: false, count: null });
  res.json({ available: true, count: await getDeviceCount() });
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
