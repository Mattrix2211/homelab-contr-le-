import { useMemo, useState } from "react";
import { useContainers, useContainerLogs, useFrigateStatus, useUpdates } from "../api/hooks";
import { ContainerRow } from "../components/ContainerRow";
import { ResourceDrawer } from "../components/ResourceDrawer";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { formatMb, formatPercent, formatRelativeTime, formatUptime } from "../lib/format";

type Filter = "all" | "running" | "stopped" | "unhealthy" | "updates";

const FILTER_LABEL: Record<Filter, string> = {
  all: "Tous",
  running: "En marche",
  stopped: "Arrêtés",
  unhealthy: "En défaut",
  updates: "Mises à jour",
};

function FrigatePanel() {
  const { data } = useFrigateStatus();
  if (!data?.available) {
    return (
      <div className="drawer__section">
        <div className="section-title" style={{ marginBottom: 8 }}>Frigate</div>
        <p className="text-tertiary" style={{ fontSize: 12.5 }}>
          Définissez FRIGATE_ENABLED=true et FRIGATE_URL pour voir ici les caméras et les événements récents.
        </p>
      </div>
    );
  }
  return (
    <>
      <div className="drawer__section">
        <div className="section-title" style={{ marginBottom: 8 }}>Caméras</div>
        <div className="row-list">
          {data.cameras.map((c) => (
            <div className="row" key={c.name}>
              <span className="row__primary">{c.name}</span>
              <span className="mono text-tertiary" style={{ marginRight: 8 }}>
                {c.detectionFps !== null ? `${c.detectionFps.toFixed(1)} fps` : "—"}
              </span>
              <StatusBadge status={c.online ? "online" : "offline"} />
            </div>
          ))}
        </div>
      </div>
      <div className="drawer__section">
        <div className="section-title" style={{ marginBottom: 8 }}>Événements récents</div>
        {data.events.length === 0 ? (
          <p className="text-tertiary" style={{ fontSize: 12.5 }}>Aucune détection récente.</p>
        ) : (
          <div className="row-list">
            {data.events.map((e) => (
              <div className="row" key={e.id}>
                <span className="row__primary">
                  {e.label} sur {e.camera}
                  <div className="row__secondary">{formatRelativeTime(e.startTime)}</div>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function Services() {
  const { data, isLoading } = useContainers();
  const { data: updatesData } = useUpdates();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const containers = data?.containers ?? [];
  const open = containers.find((c) => c.id === openId);
  const { data: logsData } = useContainerLogs(openId ?? undefined);

  const updatesById = useMemo(() => {
    const map = new Map<string, boolean | null>();
    for (const u of updatesData?.updates ?? []) map.set(u.containerId, u.updateAvailable);
    return map;
  }, [updatesData]);

  const filtered = useMemo(() => {
    return containers.filter((c) => {
      if (filter === "running" && c.state !== "running") return false;
      if (filter === "stopped" && c.state === "running") return false;
      if (filter === "unhealthy" && c.health !== "unhealthy") return false;
      if (filter === "updates" && updatesById.get(c.id) !== true) return false;
      if (query && !c.name.toLowerCase().includes(query.toLowerCase()) && !c.image.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [containers, filter, query, updatesById]);

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Services</div>
          <div className="page__subtitle">Conteneurs Docker qui font tourner le HomeLab</div>
        </div>
      </div>

      <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Rechercher un conteneur…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            background: "var(--color-background)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 12px",
            color: "var(--color-text-primary)",
            flex: 1,
            minWidth: 200,
          }}
        />
        {(["all", "running", "stopped", "unhealthy", "updates"] as Filter[]).map((f) => (
          <button key={f} className={`btn btn--sm ${filter === f ? "btn--primary" : "btn--ghost"}`} onClick={() => setFilter(f)}>
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {isLoading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={40} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Aucun conteneur ne correspond" description="Ajustez les filtres ou vérifiez l’intégration Docker (voir Administration)." />
        ) : (
          <div className="row-list">
            {filtered.map((c) => (
              <ContainerRow key={c.id} container={c} onOpen={() => setOpenId(c.id)} hasUpdate={updatesById.get(c.id) === true} />
            ))}
          </div>
        )}
      </div>

      {open && (
        <ResourceDrawer title={open.name} subtitle={open.image} status={open.status} onClose={() => setOpenId(null)}>
          <div className="drawer__section">
            <div className="metric-row" style={{ padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
              <span className="metric-row__label">CPU</span>
              <span className="metric-row__value">{formatPercent(open.cpuPercent)}</span>
            </div>
            <div className="metric-row" style={{ padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
              <span className="metric-row__label">RAM</span>
              <span className="metric-row__value">
                {formatMb(open.ramMb)} / {formatMb(open.ramLimitMb)}
              </span>
            </div>
            <div className="metric-row" style={{ padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
              <span className="metric-row__label">Actif depuis</span>
              <span className="metric-row__value">{formatUptime(open.uptimeSeconds)}</span>
            </div>
            <div className="metric-row" style={{ padding: "6px 0" }}>
              <span className="metric-row__label">Ports</span>
              <span className="metric-row__value">{open.ports.join(", ") || "—"}</span>
            </div>
          </div>
          <div className="drawer__section">
            <div className="section-title" style={{ marginBottom: 8 }}>Logs récents</div>
            <pre
              className="mono"
              style={{
                background: "var(--color-background)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                padding: 12,
                fontSize: 11,
                maxHeight: 240,
                overflow: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {logsData?.logs || "Aucun log disponible."}
            </pre>
          </div>
          {open.name.toLowerCase().includes("frigate") && <FrigatePanel />}
        </ResourceDrawer>
      )}
    </div>
  );
}
