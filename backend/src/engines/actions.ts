// Action engine: every mutating operation the cockpit can trigger flows
// through here so it gets a consistent confirmation-level check, audit
// logging and event recording (sections 21, 28, 29).

import { auditRepo, eventsRepo, type Role } from "../db/repo.js";

export type ConfirmLevel = 1 | 2 | 3;

export interface ActionDefinition {
  key: string;
  label: string;
  level: ConfirmLevel;
  minRole: Role;
}

// Level 3 (critical/destructive) actions are intentionally not implemented
// as one-click cockpit actions per section 21 ("certaines actions
// destructives ne doivent simplement pas être implémentées"). Host
// shutdown/reboot and destructive storage operations are exposed as
// "Open native UI" links instead, never as a POST handler here.
export const ACTIONS: Record<string, ActionDefinition> = {
  "container.start": { key: "container.start", label: "Start container", level: 1, minRole: "operator" },
  "container.stop": { key: "container.stop", label: "Stop container", level: 2, minRole: "operator" },
  "container.restart": { key: "container.restart", label: "Restart container", level: 2, minRole: "operator" },
  "container.pause": { key: "container.pause", label: "Pause container", level: 2, minRole: "operator" },
  "container.unpause": { key: "container.unpause", label: "Unpause container", level: 1, minRole: "operator" },
  "guest.start": { key: "guest.start", label: "Start VM/LXC", level: 1, minRole: "operator" },
  "guest.shutdown": { key: "guest.shutdown", label: "Shutdown VM/LXC", level: 2, minRole: "operator" },
  "guest.reboot": { key: "guest.reboot", label: "Reboot VM/LXC", level: 2, minRole: "operator" },
  "homeassistant.restart": { key: "homeassistant.restart", label: "Restart Home Assistant", level: 2, minRole: "operator" },
  "truenas.smart-test": { key: "truenas.smart-test", label: "Run SMART test", level: 1, minRole: "operator" },
  "truenas.scrub": { key: "truenas.scrub", label: "Run scrub", level: 2, minRole: "operator" },
  "truenas.snapshot-create": { key: "truenas.snapshot-create", label: "Create snapshot", level: 1, minRole: "operator" },
  "backup.run": { key: "backup.run", label: "Run backup", level: 1, minRole: "operator" },
  "adguard.protection-toggle": { key: "adguard.protection-toggle", label: "Toggle DNS protection", level: 2, minRole: "operator" },
};

const ROLE_RANK: Record<Role, number> = { viewer: 1, operator: 2, admin: 3 };

export function canPerform(role: Role, actionKey: string): boolean {
  const def = ACTIONS[actionKey];
  if (!def) return false;
  return ROLE_RANK[role] >= ROLE_RANK[def.minRole];
}

export interface RunActionContext {
  // null identifies a system-triggered run (e.g. an automation rule)
  // rather than a signed-in user.
  userId: string | null;
  userDisplayName: string;
  userRole: Role;
}

export async function runAction<T>(
  ctx: RunActionContext,
  actionKey: string,
  target: string,
  params: Record<string, unknown> | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const def = ACTIONS[actionKey];
  if (!def) {
    throw Object.assign(new Error("unknown_action"), { status: 404 });
  }
  if (!canPerform(ctx.userRole, actionKey)) {
    auditRepo.record({
      userId: ctx.userId,
      userDisplayName: ctx.userDisplayName,
      action: actionKey,
      target,
      params,
      result: "denied",
      error: "insufficient_role",
    });
    throw Object.assign(new Error("insufficient_role"), { status: 403 });
  }

  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    auditRepo.record({
      userId: ctx.userId,
      userDisplayName: ctx.userDisplayName,
      action: actionKey,
      target,
      params,
      result: "success",
      durationMs,
    });
    eventsRepo.record({
      category: "action",
      severity: "info",
      source: ctx.userDisplayName,
      message: `${def.label} on ${target}`,
      metadata: { actionKey, target, durationMs },
    });
    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    auditRepo.record({
      userId: ctx.userId,
      userDisplayName: ctx.userDisplayName,
      action: actionKey,
      target,
      params,
      result: "error",
      error: message,
      durationMs,
    });
    throw err;
  }
}
