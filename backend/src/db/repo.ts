import { randomUUID } from "node:crypto";
import { db } from "./client.js";

export type Role = "viewer" | "operator" | "admin";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  display_name: string;
  created_at: string;
  last_login_at: string | null;
}

export const usersRepo = {
  findByEmail(email: string): UserRow | undefined {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
      | UserRow
      | undefined;
  },
  findById(id: string): UserRow | undefined {
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | UserRow
      | undefined;
  },
  touchLogin(id: string) {
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
  },
  list(): UserRow[] {
    return db.prepare("SELECT * FROM users ORDER BY created_at").all() as UserRow[];
  },
};

export interface SessionRow {
  id: string;
  user_id: string;
  csrf_token: string;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
}

export const sessionsRepo = {
  create(userId: string, csrfToken: string, userAgent: string | undefined, ttlHours: number): SessionRow {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString();
    db.prepare(
      `INSERT INTO sessions (id, user_id, csrf_token, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)`
    ).run(id, userId, csrfToken, userAgent ?? null, expiresAt);
    return sessionsRepo.findById(id)!;
  },
  findById(id: string): SessionRow | undefined {
    return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
      | SessionRow
      | undefined;
  },
  delete(id: string) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  },
  deleteExpired() {
    db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  },
};

export interface AuditEntry {
  userId: string | null;
  userDisplayName: string;
  action: string;
  target: string;
  params?: Record<string, unknown>;
  result: "success" | "error" | "denied";
  error?: string;
  durationMs?: number;
}

export const auditRepo = {
  record(entry: AuditEntry) {
    db.prepare(
      `INSERT INTO audit_log (id, user_id, user_display_name, action, target, params, result, error, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      entry.userId,
      entry.userDisplayName,
      entry.action,
      entry.target,
      entry.params ? JSON.stringify(entry.params) : null,
      entry.result,
      entry.error ?? null,
      entry.durationMs ?? null
    );
  },
  list(limit = 100) {
    return db
      .prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?")
      .all(limit);
  },
};

export interface EventInput {
  category: "alert" | "system" | "action";
  severity: "info" | "warning" | "critical";
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export const eventsRepo = {
  record(input: EventInput) {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO events (id, category, severity, source, message, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.category,
      input.severity,
      input.source,
      input.message,
      input.metadata ? JSON.stringify(input.metadata) : null
    );
    return id;
  },
  list(limit = 200) {
    return db
      .prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT ?")
      .all(limit);
  },
  activeAlerts() {
    return db
      .prepare(
        "SELECT * FROM events WHERE category = 'alert' AND active = 1 ORDER BY created_at DESC"
      )
      .all();
  },
  resolveAlertsBySource(source: string) {
    db.prepare(
      `UPDATE events SET active = 0, resolved_at = datetime('now')
       WHERE category = 'alert' AND active = 1 AND source = ?`
    ).run(source);
  },
  hasActiveAlert(source: string, message: string): boolean {
    const row = db
      .prepare(
        `SELECT id FROM events WHERE category = 'alert' AND active = 1 AND source = ? AND message = ?`
      )
      .get(source, message);
    return !!row;
  },
};

export const quickActionsRepo = {
  list() {
    return db.prepare("SELECT * FROM quick_actions ORDER BY sort_order").all();
  },
  add(label: string, actionKey: string, target: string, createdBy: string) {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO quick_actions (id, label, action_key, target, created_by) VALUES (?, ?, ?, ?, ?)`
    ).run(id, label, actionKey, target, createdBy);
    return id;
  },
  remove(id: string) {
    db.prepare("DELETE FROM quick_actions WHERE id = ?").run(id);
  },
};
