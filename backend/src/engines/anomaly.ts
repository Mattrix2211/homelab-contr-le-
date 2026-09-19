// Statistical anomaly detection (spec section 44's "détection d'anomalies",
// left open-ended - see docs/ARCHITECTURE.md). Threshold-based alerts
// (monitoring.ts) catch "is it down"; this catches "it's up but behaving
// unlike itself" - e.g. CPU running 3 standard deviations above its own
// 14-day baseline with no host/service status change to explain it.
//
// Deliberately simple: a per-host/metric mean + stddev baseline computed
// from Prometheus range data, compared against the current instant value.
// No persistence - the baseline is recomputed each tick from Prometheus
// (which already retains the history), matching the project's rule that
// time-series data stays in Prometheus and is never duplicated into SQLite.

import { env } from "../config/env.js";
import { HOSTS } from "../config/registry.js";
import { prometheusAvailable, promMetrics, queryRange } from "../integrations/prometheus.js";
import { eventsRepo } from "../db/repo.js";
import { raiseAlert } from "./monitoring.js";

export interface AnomalyInfo {
  hostId: string;
  hostName: string;
  metric: "cpu" | "ram";
  metricLabel: string;
  current: number;
  baselineMean: number;
  baselineStdDev: number;
  zScore: number;
  detectedAt: string;
}

const METRICS: {
  id: "cpu" | "ram";
  label: string;
  rangeQuery: (instance: string) => string;
  instant: (instance: string) => Promise<number | null>;
}[] = [
  {
    id: "cpu",
    label: "CPU",
    rangeQuery: (instance) =>
      `100 - (avg by (instance) (rate(node_cpu_seconds_total{instance="${instance}",mode="idle"}[2m])) * 100)`,
    instant: promMetrics.cpuPercent,
  },
  {
    id: "ram",
    label: "RAM",
    rangeQuery: (instance) =>
      `100 * (1 - (node_memory_MemAvailable_bytes{instance="${instance}"} / node_memory_MemTotal_bytes{instance="${instance}"}))`,
    instant: promMetrics.ramPercent,
  },
];

let cache: AnomalyInfo[] = [];
let checkedAt: string | null = null;

export function getAnomaliesCache(): { anomalies: AnomalyInfo[]; checkedAt: string | null } {
  return { anomalies: cache, checkedAt };
}

function meanAndStdDev(values: number[]): { mean: number; stdDev: number } {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

async function checkOne(hostId: string, hostName: string, instance: string, metric: (typeof METRICS)[number]): Promise<AnomalyInfo | null> {
  const source = `anomaly:${hostId}:${metric.id}`;
  const nowSec = Math.floor(Date.now() / 1000);
  const lookbackSec = env.anomaly.lookbackDays * 24 * 60 * 60;

  const [samples, current] = await Promise.all([
    queryRange(metric.rangeQuery(instance), nowSec - lookbackSec, nowSec, 3600),
    metric.instant(instance),
  ]);

  if (samples.length < env.anomaly.minSamples || current === null) {
    eventsRepo.resolveAlertsBySource(source); // not enough data (yet) to judge - don't leave a stale alert active
    return null;
  }

  const { mean, stdDev } = meanAndStdDev(samples.map((s) => s.v));
  if (stdDev < env.anomaly.minStdDev) {
    eventsRepo.resolveAlertsBySource(source);
    return null;
  }

  const zScore = (current - mean) / stdDev;
  if (Math.abs(zScore) < env.anomaly.zThreshold) {
    eventsRepo.resolveAlertsBySource(source);
    return null;
  }

  const detectedAt = new Date().toISOString();
  const direction = zScore > 0 ? "above" : "below";
  raiseAlert(
    source,
    "warning",
    `${hostName} ${metric.label} is unusually ${direction} its baseline: ${current.toFixed(1)}% vs ${mean.toFixed(1)}% avg (z=${zScore.toFixed(1)})`
  );

  return {
    hostId,
    hostName,
    metric: metric.id,
    metricLabel: metric.label,
    current: Math.round(current * 10) / 10,
    baselineMean: Math.round(mean * 10) / 10,
    baselineStdDev: Math.round(stdDev * 10) / 10,
    zScore: Math.round(zScore * 10) / 10,
    detectedAt,
  };
}

export async function refreshAnomalies(): Promise<void> {
  if (!env.anomaly.enabled || !prometheusAvailable()) {
    cache = [];
    checkedAt = new Date().toISOString();
    return;
  }

  const targets = HOSTS.filter((h) => h.ip && h.ip !== "unknown");
  const results = await Promise.all(
    targets.flatMap((h) => METRICS.map((m) => checkOne(h.id, h.name, `${h.ip}:9100`, m)))
  );
  cache = results.filter((r): r is AnomalyInfo => r !== null);
  checkedAt = new Date().toISOString();
}

export function startAnomalyLoop(): NodeJS.Timeout | null {
  if (!env.anomaly.enabled) return null;
  const intervalMs = env.anomaly.intervalMinutes * 60_000;
  const tick = () => {
    refreshAnomalies().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[anomaly] refresh failed", err);
    });
  };
  // First check well after boot: the 14-day baseline query is the heaviest
  // Prometheus call the app makes, no need to race it against startup.
  setTimeout(tick, 30_000);
  return setInterval(tick, intervalMs);
}
