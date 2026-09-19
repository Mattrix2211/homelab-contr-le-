import { Router } from "express";
import { z } from "zod";
import { adguardAvailable, getStats, setProtection } from "../integrations/adguard.js";
import { npmAvailable, listCertificates, listProxies } from "../integrations/npm.js";
import { wireguardAvailable, listPeers } from "../integrations/wireguard.js";
import { runAction } from "../engines/actions.js";

export const networkRouter = Router();

networkRouter.get("/adguard/stats", async (_req, res) => {
  if (!adguardAvailable()) return res.json({ available: false, stats: null });
  res.json({ available: true, stats: await getStats() });
});

const protectionSchema = z.object({ enable: z.boolean() });

networkRouter.post("/adguard/protection", async (req, res) => {
  const parsed = protectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });

  try {
    await runAction(
      { userId: req.auth.user.id, userDisplayName: req.auth.user.display_name, userRole: req.auth.user.role },
      "adguard.protection-toggle",
      "adguard",
      { enable: parsed.data.enable },
      () => setProtection(parsed.data.enable)
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.status ?? 502).json({ error: err.message ?? "action_failed" });
  }
});

networkRouter.get("/npm/proxies", async (_req, res) => {
  if (!npmAvailable()) return res.json({ available: false, proxies: [] });
  res.json({ available: true, proxies: await listProxies() });
});

networkRouter.get("/npm/certificates", async (_req, res) => {
  if (!npmAvailable()) return res.json({ available: false, certificates: [] });
  res.json({ available: true, certificates: await listCertificates() });
});

networkRouter.get("/wireguard/peers", async (_req, res) => {
  if (!wireguardAvailable()) return res.json({ available: false, peers: [] });
  res.json({ available: true, peers: await listPeers() });
});
