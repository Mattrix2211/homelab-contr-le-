import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
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

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(["viewer", "operator", "admin"]),
  displayName: z.string().min(1).max(80),
});

configRouter.post("/users", requireRole("admin"), (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const { email, password, role, displayName } = parsed.data;

  if (usersRepo.findByEmail(email)) {
    return res.status(409).json({ error: "email_already_exists" });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const id = usersRepo.create(email, passwordHash, role, displayName);
  res.status(201).json({ id });
});

const setRoleSchema = z.object({ role: z.enum(["viewer", "operator", "admin"]) });

configRouter.patch("/users/:id/role", requireRole("admin"), (req, res) => {
  const parsed = setRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const target = usersRepo.findById(req.params.id);
  if (!target) return res.status(404).json({ error: "not_found" });

  if (target.role === "admin" && parsed.data.role !== "admin" && usersRepo.countAdmins() <= 1) {
    return res.status(400).json({ error: "cannot_demote_last_admin" });
  }

  usersRepo.setRole(target.id, parsed.data.role);
  res.json({ ok: true });
});

configRouter.delete("/users/:id", requireRole("admin"), (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  if (req.params.id === req.auth.user.id) {
    return res.status(400).json({ error: "cannot_delete_self" });
  }

  const target = usersRepo.findById(req.params.id);
  if (!target) return res.status(404).json({ error: "not_found" });

  if (target.role === "admin" && usersRepo.countAdmins() <= 1) {
    return res.status(400).json({ error: "cannot_delete_last_admin" });
  }

  usersRepo.remove(target.id);
  res.json({ ok: true });
});
