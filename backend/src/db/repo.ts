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

export type BackupKind = "homeassistant" | "truenas-snapshot" | "custom";
export type BackupStatus = "success" | "error" | "running";

export interface BackupRow {
  id: string;
  label: string;
  kind: BackupKind;
  target_ref: string | null;
  trigger_url: string | null;
  last_run_at: string | null;
  last_status: BackupStatus | null;
  last_duration_ms: number | null;
  last_size_bytes: number | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
}

export const backupsRepo = {
  list(): BackupRow[] {
    return db.prepare("SELECT * FROM backups ORDER BY created_at").all() as BackupRow[];
  },
  findById(id: string): BackupRow | undefined {
    return db.prepare("SELECT * FROM backups WHERE id = ?").get(id) as BackupRow | undefined;
  },
  create(input: { label: string; kind: BackupKind; targetRef?: string; triggerUrl?: string; createdBy: string }) {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO backups (id, label, kind, target_ref, trigger_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.label, input.kind, input.targetRef ?? null, input.triggerUrl ?? null, input.createdBy);
    return id;
  },
  remove(id: string) {
    db.prepare("DELETE FROM backups WHERE id = ?").run(id);
  },
  recordRun(id: string, result: { status: BackupStatus; durationMs?: number; sizeBytes?: number; error?: string }) {
    db.prepare(
      `UPDATE backups SET last_run_at = datetime('now'), last_status = ?, last_duration_ms = ?, last_size_bytes = ?, last_error = ?
       WHERE id = ?`
    ).run(result.status, result.durationMs ?? null, result.sizeBytes ?? null, result.error ?? null, id);
  },
};

export type TriggerKind = "service_down" | "host_down";

export interface AutomationRuleRow {
  id: string;
  name: string;
  trigger_kind: TriggerKind;
  trigger_target: string;
  trigger_minutes: number;
  action_key: string;
  action_target: string;
  cooldown_minutes: number;
  enabled: number;
  last_triggered_at: string | null;
  created_by: string | null;
  created_at: string;
}

export const automationRulesRepo = {
  list(): AutomationRuleRow[] {
    return db.prepare("SELECT * FROM automation_rules ORDER BY created_at").all() as AutomationRuleRow[];
  },
  listEnabled(): AutomationRuleRow[] {
    return db.prepare("SELECT * FROM automation_rules WHERE enabled = 1").all() as AutomationRuleRow[];
  },
  create(input: {
    name: string;
    triggerKind: TriggerKind;
    triggerTarget: string;
    triggerMinutes: number;
    actionKey: string;
    actionTarget: string;
    cooldownMinutes: number;
    createdBy: string;
  }) {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO automation_rules (id, name, trigger_kind, trigger_target, trigger_minutes, action_key, action_target, cooldown_minutes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name,
      input.triggerKind,
      input.triggerTarget,
      input.triggerMinutes,
      input.actionKey,
      input.actionTarget,
      input.cooldownMinutes,
      input.createdBy
    );
    return id;
  },
  setEnabled(id: string, enabled: boolean) {
    db.prepare("UPDATE automation_rules SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
  },
  remove(id: string) {
    db.prepare("DELETE FROM automation_rules WHERE id = ?").run(id);
  },
  markTriggered(id: string) {
    db.prepare("UPDATE automation_rules SET last_triggered_at = datetime('now') WHERE id = ?").run(id);
  },
};

export type NotificationKind = "discord" | "homeassistant";
export type Severity = "info" | "warning" | "critical";

export interface NotificationChannelRow {
  id: string;
  kind: NotificationKind;
  target: string;
  min_severity: Severity;
  enabled: number;
  created_at: string;
}

export const notificationChannelsRepo = {
  list(): NotificationChannelRow[] {
    return db.prepare("SELECT * FROM notification_channels ORDER BY created_at").all() as NotificationChannelRow[];
  },
  listEnabled(): NotificationChannelRow[] {
    return db.prepare("SELECT * FROM notification_channels WHERE enabled = 1").all() as NotificationChannelRow[];
  },
  create(input: { kind: NotificationKind; target: string; minSeverity: Severity }) {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO notification_channels (id, kind, target, min_severity) VALUES (?, ?, ?, ?)`
    ).run(id, input.kind, input.target, input.minSeverity);
    return id;
  },
  setEnabled(id: string, enabled: boolean) {
    db.prepare("UPDATE notification_channels SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
  },
  remove(id: string) {
    db.prepare("DELETE FROM notification_channels WHERE id = ?").run(id);
  },
};

export interface UserPreferencesRow {
  user_id: string;
  cockpit_layout: string | null;
  notifications_last_seen_at: string | null;
  updated_at: string;
}

export const userPreferencesRepo = {
  get(userId: string): UserPreferencesRow | undefined {
    return db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(userId) as
      | UserPreferencesRow
      | undefined;
  },
  setCockpitLayout(userId: string, layout: unknown) {
    db.prepare(
      `INSERT INTO user_preferences (user_id, cockpit_layout, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET cockpit_layout = excluded.cockpit_layout, updated_at = datetime('now')`
    ).run(userId, JSON.stringify(layout));
  },
  markNotificationsSeen(userId: string) {
    db.prepare(
      `INSERT INTO user_preferences (user_id, notifications_last_seen_at, updated_at) VALUES (?, datetime('now'), datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET notifications_last_seen_at = datetime('now'), updated_at = datetime('now')`
    ).run(userId);
  },
};

export interface QuickActionRow {
  id: string;
  label: string;
  action_key: string;
  target: string;
  sort_order: number;
  created_by: string | null;
}

export const quickActionsRepo = {
  list(): QuickActionRow[] {
    return db.prepare("SELECT * FROM quick_actions ORDER BY sort_order").all() as QuickActionRow[];
  },
  findById(id: string): QuickActionRow | undefined {
    return db.prepare("SELECT * FROM quick_actions WHERE id = ?").get(id) as QuickActionRow | undefined;
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
