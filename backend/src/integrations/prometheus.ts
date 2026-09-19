import { env } from "../config/env.js";

let lastError: string | null = null;

export function prometheusAvailable(): boolean {
  return env.prometheus.enabled && !!env.prometheus.baseUrl;
}

export function prometheusLastError(): string | null {
  return lastError;
}

async function query(promql: string): Promise<number | null> {
  if (!prometheusAvailable()) return null;
  try {
    const url = new URL("/api/v1/query", env.prometheus.baseUrl);
    url.searchParams.set("query", promql);
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`prometheus http ${res.status}`);
    const body = (await res.json()) as any;
    const result = body?.data?.result?.[0];
    if (!result) return null;
    const value = result.value?.[1];
    lastError = null;
    return value !== undefined ? Number(value) : null;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return null;
  }
}

export interface RangeSample {
  t: number;
  v: number;
}

export async function queryRange(
  promql: string,
  startSec: number,
  endSec: number,
  stepSec: number
): Promise<RangeSample[]> {
  if (!prometheusAvailable()) return [];
  try {
    const url = new URL("/api/v1/query_range", env.prometheus.baseUrl);
    url.searchParams.set("query", promql);
    url.searchParams.set("start", String(startSec));
    url.searchParams.set("end", String(endSec));
    url.searchParams.set("step", String(stepSec));
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`prometheus http ${res.status}`);
    const body = (await res.json()) as any;
    const result = body?.data?.result?.[0];
    lastError = null;
    if (!result) return [];
    return (result.values as [number, string][]).map(([t, v]) => ({ t, v: Number(v) }));
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}

// Best-effort node_exporter-style queries. Instance label is expected to be
// "<ip>:9100" per Prometheus scrape config; adjust in Administration if the
// HomeLab uses different job/instance labeling.
export const promMetrics = {
  cpuPercent: (instance: string) =>
    query(
      `100 - (avg by (instance) (rate(node_cpu_seconds_total{instance="${instance}",mode="idle"}[2m])) * 100)`
    ),
  ramPercent: (instance: string) =>
    query(
      `100 * (1 - (node_memory_MemAvailable_bytes{instance="${instance}"} / node_memory_MemTotal_bytes{instance="${instance}"}))`
    ),
  tempC: (instance: string) =>
    query(`node_hwmon_temp_celsius{instance="${instance}"}`),
  uptimeSeconds: (instance: string) =>
    query(`time() - node_boot_time_seconds{instance="${instance}"}`),
};
