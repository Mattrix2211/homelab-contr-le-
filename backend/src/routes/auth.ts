import { randomBytes } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../config/env.js";
import { sessionsRepo, usersRepo, auditRepo } from "../db/repo.js";
import { clearSessionCookie, issueSessionCookie, requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_attempts" },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input" });
  }
  const { email, password } = parsed.data;

  const user = usersRepo.findByEmail(email);
  const valid = user ? bcrypt.compareSync(password, user.password_hash) : false;

  if (!user || !valid) {
    auditRepo.record({
      userId: null,
      userDisplayName: email,
      action: "auth.login",
      target: "cockpit",
      result: "denied",
      error: "invalid_credentials",
    });
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const csrfToken = randomBytes(24).toString("hex");
  const session = sessionsRepo.create(user.id, csrfToken, req.get("user-agent"), env.sessionTtlHours);
  issueSessionCookie(res, session.id, env.sessionTtlHours);
  usersRepo.touchLogin(user.id);

  auditRepo.record({
    userId: user.id,
    userDisplayName: user.display_name,
    action: "auth.login",
    target: "cockpit",
    result: "success",
  });

  res.json({
    user: { id: user.id, email: user.email, role: user.role, displayName: user.display_name },
    csrfToken,
  });
});

authRouter.post("/logout", requireAuth, (req, res) => {
  if (req.auth) {
    sessionsRepo.delete(req.auth.session.id);
    auditRepo.record({
      userId: req.auth.user.id,
      userDisplayName: req.auth.user.display_name,
      action: "auth.logout",
      target: "cockpit",
      result: "success",
    });
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  res.json({
    user: {
      id: req.auth.user.id,
      email: req.auth.user.email,
      role: req.auth.user.role,
      displayName: req.auth.user.display_name,
    },
    csrfToken: req.auth.session.csrf_token,
  });
});
