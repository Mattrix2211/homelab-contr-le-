import { Router } from "express";
import { env } from "../config/env.js";
import { requireRole } from "../middleware/auth.js";
import { usersRepo } from "../db/repo.js";

export const configRouter = Router();

// Admin-only, read-only status of which integrations are configured.
// Secrets are never returned - only booleans and non-sensitive metadata.
configRouter.get("/integrations", requireRole("admin"), (_req, res) => {
  res.json({
    docker: { enabled: env.docker.enabled, socketPath: env.docker.socketPath },
    prometheus: { enabled: env.prometheus.enabled, baseUrl: env.prometheus.baseUrl ? "configured" : null },
    proxmox: {
      enabled: env.proxmox.enabled,
      baseUrl: env.proxmox.baseUrl ? "configured" : null,
      node: env.proxmox.node,
    },
    homeassistant: { enabled: env.homeassistant.enabled, baseUrl: env.homeassistant.baseUrl ? "configured" : null },
    truenas: { enabled: env.truenas.enabled, baseUrl: env.truenas.baseUrl ? "configured" : null },
    uptimeKuma: { enabled: env.uptimeKuma.enabled, baseUrl: env.uptimeKuma.baseUrl ? "configured" : null },
  });
});

configRouter.get("/users", requireRole("admin"), (_req, res) => {
  const users = usersRepo.list().map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    displayName: u.display_name,
    lastLoginAt: u.last_login_at,
  }));
  res.json({ users });
});
