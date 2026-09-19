import { env } from "../config/env.js";

let lastError: string | null = null;

export function frigateAvailable(): boolean {
  return env.frigate.enabled && !!env.frigate.baseUrl;
}

export function frigateLastError(): string | null {
  return lastError;
}

async function frigate<T = any>(path: string): Promise<T> {
  const res = await fetch(new URL(path, env.frigate.baseUrl), { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`frigate http ${res.status}`);
  return (await res.json()) as T;
}

export interface FrigateCamera {
  name: string;
  online: boolean;
  detectionFps: number | null;
}

export interface FrigateEvent {
  id: string;
  camera: string;
  label: string;
  startTime: string;
  hasClip: boolean;
  hasSnapshot: boolean;
}

export interface FrigateStatus {
  cameras: FrigateCamera[];
  events: FrigateEvent[];
  cpuPercent: number | null;
  storageUsedBytes: number | null;
}

export async function getStatus(): Promise<FrigateStatus | null> {
  if (!frigateAvailable()) return null;
  try {
    const [config, stats, events] = await Promise.all([
      frigate<any>("/api/config"),
      frigate<any>("/api/stats"),
      frigate<any[]>("/api/events?limit=10"),
    ]);
    lastError = null;

    const cameraNames = Object.keys(config.cameras ?? {});
    const cameras: FrigateCamera[] = cameraNames.map((name) => {
      const camStats = stats.cameras?.[name];
      return {
        name,
        online: !!camStats && camStats.camera_fps !== undefined,
        detectionFps: camStats?.detection_fps ?? null,
      };
    });

    const cpuValues = Object.values(stats.cpu_usages ?? {}).map((v: any) => Number(v.cpu)).filter((n) => Number.isFinite(n));
    const cpuPercent = cpuValues.length ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : null;

    return {
      cameras,
      events: events.map((e) => ({
        id: e.id,
        camera: e.camera,
        label: e.label,
        startTime: new Date(e.start_time * 1000).toISOString(),
        hasClip: !!e.has_clip,
        hasSnapshot: !!e.has_snapshot,
      })),
      cpuPercent,
      storageUsedBytes: stats.service?.storage?.["/media/frigate/recordings"]?.used ?? null,
    };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return null;
  }
}
