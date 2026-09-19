import { env } from "../config/env.js";

// Uptime Kuma has no conventional REST API for reading monitor status in
// the community edition - the stable, documented, key-authenticated read
// path is its built-in Prometheus exposition endpoint (Settings > API Keys
// to generate a key, then enable "Show Prometheus Metrics"). We scrape and
// parse that text format ourselves rather than depending on a websocket
// session, which is what the live dashboard actually uses internally.

let lastError: string | null = null;

export function uptimeKumaAvailable(): boolean {
  return env.uptimeKuma.enabled && !!env.uptimeKuma.baseUrl && !!env.uptimeKuma.apiKey;
}

export function uptimeKumaLastError(): string | null {
  return lastError;
}

export interface UptimeKumaMonitor {
  name: string;
  up: boolean;
  responseTimeMs: number | null;
}

function parseLabels(labelPart: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const re = /(\w+)="((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(labelPart))) {
    labels[match[1]] = match[2].replace(/\\"/g, '"');
  }
  return labels;
}

function parseMetrics(text: string): UptimeKumaMonitor[] {
  const monitors = new Map<string, UptimeKumaMonitor>();

  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const statusMatch = line.match(/^monitor_status\{(.*)\}\s+([\d.]+)/);
    const responseMatch = line.match(/^monitor_response_time\{(.*)\}\s+([\d.]+)/);

    if (statusMatch) {
      const labels = parseLabels(statusMatch[1]);
      const name = labels.monitor_name ?? "unknown";
      const existing = monitors.get(name) ?? { name, up: false, responseTimeMs: null };
      existing.up = Number(statusMatch[2]) === 1;
      monitors.set(name, existing);
    } else if (responseMatch) {
      const labels = parseLabels(responseMatch[1]);
      const name = labels.monitor_name ?? "unknown";
      const existing = monitors.get(name) ?? { name, up: false, responseTimeMs: null };
      existing.responseTimeMs = Number(responseMatch[2]);
      monitors.set(name, existing);
    }
  }

  return [...monitors.values()];
}

export async function getMonitors(): Promise<UptimeKumaMonitor[]> {
  if (!uptimeKumaAvailable()) return [];
  try {
    const auth = Buffer.from(`:${env.uptimeKuma.apiKey}`).toString("base64");
    const res = await fetch(new URL("/metrics", env.uptimeKuma.baseUrl), {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`uptime kuma http ${res.status}`);
    const text = await res.text();
    lastError = null;
    return parseMetrics(text);
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}
