import { useState } from "react";
import { useAnomalies, useHosts, useMetricRange, usePrometheusAvailable, useUptimeKumaMonitors } from "../api/hooks";
import { MetricChart } from "../components/MetricChart";
import { OpenLinkButton } from "../components/OpenLinkButton";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { formatRelativeTime } from "../lib/format";

function AnomaliesPanel() {
  const { data } = useAnomalies();
  const anomalies = data?.anomalies ?? [];
  if (anomalies.length === 0) return null;
  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">Anomalies détectées</div>
        <span className="text-tertiary" style={{ fontSize: 12.5 }}>
          par rapport à {data?.checkedAt ? "la référence sur 14 jours" : "—"}
        </span>
      </div>
      <div className="row-list">
        {anomalies.map((a) => (
          <div className="row" key={`${a.hostId}:${a.metric}`}>
            <span className="row__primary">
              {a.hostName} · {a.metricLabel}
            </span>
            <span className="mono text-tertiary" style={{ width: 150 }}>
              {a.current} % vs {a.baselineMean} % en moyenne (z={a.zScore})
            </span>
            <span className="mono text-tertiary" style={{ width: 90 }}>
              {formatRelativeTime(a.detectedAt)}
            </span>
            <StatusBadge status="warning" />
          </div>
        ))}
      </div>
    </div>
  );
}

function UptimeKumaPanel() {
  const { data } = useUptimeKumaMonitors();
  if (data?.available === false) {
    return (
      <EmptyState
        title="Uptime Kuma non configuré"
        description="Définissez UPTIME_KUMA_ENABLED=true, UPTIME_KUMA_URL et UPTIME_KUMA_API_KEY pour afficher ici la disponibilité des sondes."
      />
    );
  }
  const monitors = data?.monitors ?? [];
  if (monitors.length === 0) return null;
  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">Uptime Kuma</div>
        <OpenLinkButton linkKey="uptimeKuma" label="Ouvrir Uptime Kuma" />
      </div>
      <div className="row-list">
        {monitors.map((m) => (
          <div className="row" key={m.name}>
            <span className="row__primary">{m.name}</span>
            <span className="mono text-tertiary" style={{ width: 90 }}>
              {m.responseTimeMs !== null ? `${Math.round(m.responseTimeMs)} ms` : "—"}
            </span>
            <StatusBadge status={m.up ? "online" : "offline"} />
          </div>
        ))}
      </div>
    </div>
  );
}

const PERIODS: { label: string; minutes: number; step: number }[] = [
  { label: "1H", minutes: 60, step: 15 },
  { label: "6H", minutes: 360, step: 60 },
  { label: "24H", minutes: 1440, step: 300 },
  { label: "7J", minutes: 10080, step: 1800 },
  { label: "30J", minutes: 43200, step: 7200 },
];

const METRICS = [
  { id: "cpu", label: "CPU %", query: (instance: string) => `100 - (avg by (instance) (rate(node_cpu_seconds_total{instance="${instance}",mode="idle"}[2m])) * 100)` },
  { id: "ram", label: "RAM %", query: (instance: string) => `100 * (1 - (node_memory_MemAvailable_bytes{instance="${instance}"} / node_memory_MemTotal_bytes{instance="${instance}"}))` },
];

export function Monitoring() {
  const { data: hostsData } = useHosts();
  const { data: available } = usePrometheusAvailable();
  const hosts = hostsData?.hosts ?? [];
  const [hostId, setHostId] = useState<string>("m83");
  const [metricId, setMetricId] = useState<string>("cpu");
  const [period, setPeriod] = useState(PERIODS[1]);

  const host = hosts.find((h) => h.id === hostId);
  const metric = METRICS.find((m) => m.id === metricId)!;
  const instance = host ? (host.promInstance ?? `${host.ip}:9100`) : "";
  const promql = metric.query(instance);

  const { data: rangeData, isLoading } = useMetricRange(promql, period.minutes, period.step, !!available?.available && !!host);

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Supervision</div>
          <div className="page__subtitle">Métriques Prometheus sur l’ensemble du HomeLab</div>
        </div>
        <OpenLinkButton linkKey="grafana" label="Ouvrir dans Grafana" />
      </div>

      {available?.available === false ? (
        <EmptyState
          title="Prometheus n’est pas configuré"
          description="Définissez PROMETHEUS_ENABLED=true et PROMETHEUS_URL dans l’environnement du backend pour activer les graphiques."
        />
      ) : (
        <>
          <div className="card" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {hosts.map((h) => (
                <button key={h.id} className={`btn btn--sm ${hostId === h.id ? "btn--primary" : "btn--ghost"}`} onClick={() => setHostId(h.id)}>
                  {h.name}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {METRICS.map((m) => (
                <button key={m.id} className={`btn btn--sm ${metricId === m.id ? "btn--primary" : "btn--ghost"}`} onClick={() => setMetricId(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              {PERIODS.map((p) => (
                <button key={p.label} className={`btn btn--sm ${period.label === p.label ? "btn--primary" : "btn--ghost"}`} onClick={() => setPeriod(p)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            {isLoading ? (
              <EmptyState title="Chargement…" />
            ) : (
              <MetricChart samples={rangeData?.samples ?? []} />
            )}
          </div>
        </>
      )}

      <AnomaliesPanel />
      <UptimeKumaPanel />
    </div>
  );
}
