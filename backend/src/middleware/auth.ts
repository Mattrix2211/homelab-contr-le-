import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { sessionsRepo, usersRepo, type Role } from "../db/repo.js";

const ROLE_RANK: Record<Role, number> = { viewer: 1, operator: 2, admin: 3 };
const COOKIE_NAME = "hcc_session";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface SessionClaims {
  sid: string;
}

export function issueSessionCookie(res: Response, sessionId: string, ttlHours: number) {
  const token = jwt.sign({ sid: sessionId } satisfies SessionClaims, env.jwtSecret, {
    expiresIn: `${ttlHours}h`,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    maxAge: ttlHours * 3600_000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function loadAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  try {
    const claims = jwt.verify(token, env.jwtSecret) as SessionClaims;
    const session = sessionsRepo.findById(claims.sid);
    if (!session) return next();
    if (new Date(session.expires_at).getTime() < Date.now()) {
      sessionsRepo.delete(session.id);
      return next();
    }
    const user = usersRepo.findById(session.user_id);
    if (!user) return next();

    req.auth = {
      user: { id: user.id, email: user.email, role: user.role, display_name: user.display_name },
      session,
    };
  } catch {
    // invalid/expired token: treat as unauthenticated
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ error: "unauthenticated" });
  }
  if (MUTATING_METHODS.has(req.method)) {
    const csrf = req.get("x-csrf-token");
    if (!csrf || csrf !== req.auth.session.csrf_token) {
      return res.status(403).json({ error: "csrf_token_invalid" });
    }
  }
  next();
}

export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
    if (ROLE_RANK[req.auth.user.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: "insufficient_role", required: minRole });
    }
    next();
  };
}
