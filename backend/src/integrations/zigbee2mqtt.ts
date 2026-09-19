import { env } from "../config/env.js";

// Best-effort only (section 16: "éventuellement nombre d'appareils Zigbee").
// Zigbee2MQTT primarily communicates over MQTT, not HTTP; this relies on
// its optional frontend HTTP API (`/api/devices`), which is not present
// on every install/version. A failure here just means the Zigbee device
// count stays hidden - it is never treated as Zigbee2MQTT being down.

let lastError: string | null = null;

export function zigbee2mqttAvailable(): boolean {
  return env.zigbee2mqtt.enabled && !!env.zigbee2mqtt.baseUrl;
}

export function zigbee2mqttLastError(): string | null {
  return lastError;
}

export async function getDeviceCount(): Promise<number | null> {
  if (!zigbee2mqttAvailable()) return null;
  try {
    const res = await fetch(new URL("/api/devices", env.zigbee2mqtt.baseUrl), {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`zigbee2mqtt http ${res.status}`);
    const devices = (await res.json()) as any[];
    lastError = null;
    return devices.filter((d) => d.type !== "Coordinator").length;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return null;
  }
}
