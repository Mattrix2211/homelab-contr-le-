// Simple auto-remediation rules (section 44's "automatisations", scoped to
// a concrete and bounded interpretation): "if <service|host> stays down for
// N minutes, run <existing level 1/2 action>". Runs on the same cadence as
// the monitoring loop, evaluated against its snapshot.

import { automationRulesRepo, type AutomationRuleRow } from "../db/repo.js";
import { getSnapshot } from "./monitoring.js";
import { runAction, ACTIONS } from "./actions.js";
import { performContainerAction, type ContainerAction } from "../integrations/docker.js";
import { performGuestAction, type GuestAction } from "../integrations/proxmox.js";
import { callService } from "../integrations/homeassistant.js";

const CRITICAL_STATUSES = new Set(["offline"]);
const DEGRADED_STATUSES = new Set(["offline", "degraded", "warning"]);

// ruleId -> timestamp (ms) the condition first became true, or undefined
// while the condition is false. In-memory only: a restart just means a
// rule needs one more sustained period before firing again, which is an
// acceptable reset for a home lab.
const downSince = new Map<string, number>();

async function dispatch(actionKey: string, target: string): Promise<void> {
  if (actionKey.startsWith("container.")) {
    await performContainerAction(target, actionKey.slice("container.".length) as ContainerAction);
  } else if (actionKey.startsWith("guest.")) {
    const [type, vmidStr] = target.split(":");
    if (type !== "qemu" && type !== "lxc") throw new Error("invalid_guest_target");
    await performGuestAction(type, Number(vmidStr), actionKey.slice("guest.".length) as GuestAction);
  } else if (actionKey === "homeassistant.restart") {
    await callService("homeassistant", "restart");
  } else {
    throw new Error(`unsupported_automation_action:${actionKey}`);
  }
}

async function evaluateRule(rule: AutomationRuleRow): Promise<void> {
  const snapshot = getSnapshot();
  const isDown =
    rule.trigger_kind === "service_down"
      ? DEGRADED_STATUSES.has(snapshot.services.find((s) => s.id === rule.trigger_target)?.status ?? "unknown")
      : CRITICAL_STATUSES.has(snapshot.hosts.find((h) => h.id === rule.trigger_target)?.status ?? "unknown");

  if (!isDown) {
    downSince.delete(rule.id);
    return;
  }

  const since = downSince.get(rule.id) ?? Date.now();
  downSince.set(rule.id, since);

  const sustainedMinutes = (Date.now() - since) / 60_000;
  if (sustainedMinutes < rule.trigger_minutes) return;

  if (rule.last_triggered_at) {
    const cooldownMs = rule.cooldown_minutes * 60_000;
    if (Date.now() - new Date(rule.last_triggered_at).getTime() < cooldownMs) return;
  }

  if (!ACTIONS[rule.action_key]) return; // unknown action, skip silently rather than throw in the loop

  automationRulesRepo.markTriggered(rule.id);
  try {
    await runAction(
      { userId: null, userDisplayName: `Automation: ${rule.name}`, userRole: "admin" },
      rule.action_key,
      rule.action_target,
      { automationRuleId: rule.id },
      () => dispatch(rule.action_key, rule.action_target)
    );
  } catch {
    // runAction already records the failure in audit_log/events; nothing
    // more to do here, the next eligible tick (after cooldown) will retry.
  }
}

export async function runAutomationTick(): Promise<void> {
  const rules = automationRulesRepo.listEnabled();
  for (const rule of rules) {
    await evaluateRule(rule);
  }
}

export function startAutomationLoop(intervalMs = 30_000): NodeJS.Timeout {
  return setInterval(() => {
    runAutomationTick().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[automation] tick failed", err);
    });
  }, intervalMs);
}
