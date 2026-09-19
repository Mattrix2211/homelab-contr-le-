import { env } from "../config/env.js";

let lastError: string | null = null;

export function truenasAvailable(): boolean {
  return env.truenas.enabled && !!env.truenas.baseUrl && !!env.truenas.apiKey;
}

export function truenasLastError(): string | null {
  return lastError;
}

async function tn<T = any>(path: string): Promise<T> {
  const res = await fetch(new URL(path, env.truenas.baseUrl), {
    headers: { Authorization: `Bearer ${env.truenas.apiKey}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`truenas http ${res.status}`);
  return (await res.json()) as T;
}

export interface PoolSummary {
  name: string;
  healthy: boolean;
  usedBytes: number;
  totalBytes: number;
}

export async function listPools(): Promise<PoolSummary[]> {
  if (!truenasAvailable()) return [];
  try {
    const data = await tn<any[]>("/api/v2.0/pool");
    lastError = null;
    return data.map((p) => ({
      name: p.name,
      healthy: p.healthy ?? p.status === "ONLINE",
      usedBytes: p.used?.parsed ?? p.allocated?.parsed ?? 0,
      totalBytes: p.size?.parsed ?? 0,
    }));
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}

export interface DiskSummary {
  name: string;
  tempC: number | null;
  smartPassed: boolean | null;
}

export async function listDisks(): Promise<DiskSummary[]> {
  if (!truenasAvailable()) return [];
  try {
    const data = await tn<any[]>("/api/v2.0/disk");
    lastError = null;
    return data.map((d) => ({
      name: d.name,
      tempC: d.temperature ?? null,
      smartPassed: d.smart_status ? d.smart_status === "PASSED" : null,
    }));
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}
