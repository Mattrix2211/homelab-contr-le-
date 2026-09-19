import { env } from "../config/env.js";

let lastError: string | null = null;

export function homeAssistantAvailable(): boolean {
  return env.homeassistant.enabled && !!env.homeassistant.baseUrl && !!env.homeassistant.token;
}

export function homeAssistantLastError(): string | null {
  return lastError;
}

export interface HomeAssistantStatus {
  version: string;
  online: boolean;
}

export async function getStatus(): Promise<HomeAssistantStatus | null> {
  if (!homeAssistantAvailable()) return null;
  try {
    const res = await fetch(new URL("/api/config", env.homeassistant.baseUrl), {
      headers: { Authorization: `Bearer ${env.homeassistant.token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`home assistant http ${res.status}`);
    const data = (await res.json()) as any;
    lastError = null;
    return { version: data.version, online: true };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return null;
  }
}

export async function callService(domain: string, service: string, data: Record<string, unknown> = {}) {
  if (!homeAssistantAvailable()) throw new Error("home_assistant_unavailable");
  const res = await fetch(new URL(`/api/services/${domain}/${service}`, env.homeassistant.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.homeassistant.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`home assistant http ${res.status}`);
}
