import { notificationChannelsRepo, type NotificationChannelRow, type Severity } from "../db/repo.js";
import { callService } from "./homeassistant.js";

const SEVERITY_RANK: Record<Severity, number> = { info: 1, warning: 2, critical: 3 };
const SEVERITY_LABEL: Record<Severity, string> = { info: "INFO", warning: "AVERTISSEMENT", critical: "CRITIQUE" };

async function sendDiscord(webhookUrl: string, severity: Severity, source: string, message: string): Promise<void> {
  const prefix = severity === "critical" ? "🔴" : severity === "warning" ? "🟠" : "ℹ️";
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `${prefix} **${SEVERITY_LABEL[severity]}** — ${message} _(${source})_` }),
    signal: AbortSignal.timeout(5000),
  });
}

async function sendHomeAssistant(notifyService: string, severity: Severity, message: string): Promise<void> {
  // notify.<notifyService>, e.g. notify.mobile_app_matthis_phone - this is
  // how a HomeLab cockpit reaches a phone without standing up its own push
  // infrastructure (section 25's "notification mobile").
  await callService("notify", notifyService, {
    title: `HomeLab — ${SEVERITY_LABEL[severity]}`,
    message,
  });
}

async function sendToChannel(channel: NotificationChannelRow, severity: Severity, source: string, message: string): Promise<void> {
  try {
    if (channel.kind === "discord") {
      await sendDiscord(channel.target, severity, source, message);
    } else if (channel.kind === "homeassistant") {
      await sendHomeAssistant(channel.target, severity, message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[notifications] failed to send via ${channel.kind}/${channel.id}`, err);
  }
}

export function dispatchAlert(input: { severity: "warning" | "critical"; source: string; message: string }): void {
  const channels = notificationChannelsRepo.listEnabled().filter(
    (c) => SEVERITY_RANK[input.severity] >= SEVERITY_RANK[c.min_severity]
  );
  for (const channel of channels) {
    void sendToChannel(channel, input.severity, input.source, input.message);
  }
}

export async function sendTestNotification(channel: NotificationChannelRow): Promise<void> {
  await sendToChannel(channel, "info", "administration", "Notification de test de MK HomeLab Control Center.");
}
