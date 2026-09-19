import { env } from "../config/env.js";

// TrueNAS SCALE's REST API is a generated wrapper over its middleware
// services, following the convention /api/v2.0/<service>/<method> for
// instance actions (e.g. pool.scrub on pool id 1 -> POST
// /api/v2.0/pool/id/1/scrub). Paths below follow that documented
// convention; adjust if your TrueNAS version differs.

let lastError: string | null = null;

export function truenasAvailable(): boolean {
  return env.truenas.enabled && !!env.truenas.baseUrl && !!env.truenas.apiKey;
}

export function truenasLastError(): string | null {
  return lastError;
}

async function tn<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(new URL(path, env.truenas.baseUrl), {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${env.truenas.apiKey}`,
      "Content-Type": "application/json",
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`truenas http ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface PoolSummary {
  id: number;
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
      id: p.id,
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
  model: string | null;
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
      model: d.model ?? null,
      tempC: d.temperature ?? null,
      smartPassed: d.smart_status ? d.smart_status === "PASSED" : null,
    }));
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}

export interface DatasetSummary {
  id: string; // e.g. "main/backups"
  name: string;
  usedBytes: number;
  availableBytes: number;
  mountpoint: string | null;
}

export async function listDatasets(): Promise<DatasetSummary[]> {
  if (!truenasAvailable()) return [];
  try {
    const data = await tn<any[]>("/api/v2.0/pool/dataset");
    lastError = null;
    return data.map((d) => ({
      id: d.id,
      name: d.name,
      usedBytes: d.used?.parsed ?? 0,
      availableBytes: d.available?.parsed ?? 0,
      mountpoint: d.mountpoint ?? null,
    }));
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}

export interface SnapshotSummary {
  id: string;
  name: string;
  dataset: string;
  usedBytes: number;
  createdAt: string | null;
}

export async function listSnapshots(): Promise<SnapshotSummary[]> {
  if (!truenasAvailable()) return [];
  try {
    const data = await tn<any[]>("/api/v2.0/zfs/snapshot");
    lastError = null;
    return data.slice(0, 200).map((s) => ({
      id: s.id ?? s.name,
      name: s.snapshot_name ?? s.name,
      dataset: s.dataset ?? s.pool,
      usedBytes: s.properties?.used?.parsed ?? 0,
      createdAt: s.properties?.creation?.parsed ? new Date(s.properties.creation.parsed * 1000).toISOString() : null,
    }));
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}

export async function createSnapshot(dataset: string, name: string): Promise<void> {
  if (!truenasAvailable()) throw new Error("truenas_unavailable");
  await tn("/api/v2.0/zfs/snapshot", { method: "POST", body: { dataset, name } });
}

export type SmartTestType = "SHORT" | "LONG";

export async function runSmartTest(diskIdentifier: string, type: SmartTestType): Promise<void> {
  if (!truenasAvailable()) throw new Error("truenas_unavailable");
  await tn("/api/v2.0/smart/test/manual_test", {
    method: "POST",
    body: [{ identifier: diskIdentifier, type }],
  });
}

export async function runScrub(poolId: number): Promise<void> {
  if (!truenasAvailable()) throw new Error("truenas_unavailable");
  await tn(`/api/v2.0/pool/id/${poolId}/scrub`, { method: "POST", body: { action: "START" } });
}
