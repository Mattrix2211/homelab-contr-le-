import { useMemo, useState } from "react";
import { useContainers, useContainerLogs } from "../api/hooks";
import { ContainerRow } from "../components/ContainerRow";
import { ResourceDrawer } from "../components/ResourceDrawer";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { formatMb, formatPercent, formatUptime } from "../lib/format";

type Filter = "all" | "running" | "stopped" | "unhealthy";

export function Services() {
  const { data, isLoading } = useContainers();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const containers = data?.containers ?? [];
  const open = containers.find((c) => c.id === openId);
  const { data: logsData } = useContainerLogs(openId ?? undefined);

  const filtered = useMemo(() => {
    return containers.filter((c) => {
      if (filter === "running" && c.state !== "running") return false;
      if (filter === "stopped" && c.state === "running") return false;
      if (filter === "unhealthy" && c.health !== "unhealthy") return false;
      if (query && !c.name.toLowerCase().includes(query.toLowerCase()) && !c.image.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [containers, filter, query]);

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Services</div>
          <div className="page__subtitle">Docker containers powering the HomeLab</div>
        </div>
      </div>

      <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Search containers…"
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
        {(["all", "running", "stopped", "unhealthy"] as Filter[]).map((f) => (
          <button key={f} className={`btn btn--sm ${filter === f ? "btn--primary" : "btn--ghost"}`} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
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
          <EmptyState title="No containers match" description="Adjust filters or check the Docker integration in Administration." />
        ) : (
          <div className="row-list">
            {filtered.map((c) => (
              <ContainerRow key={c.id} container={c} onOpen={() => setOpenId(c.id)} />
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
              <span className="metric-row__label">Uptime</span>
              <span className="metric-row__value">{formatUptime(open.uptimeSeconds)}</span>
            </div>
            <div className="metric-row" style={{ padding: "6px 0" }}>
              <span className="metric-row__label">Ports</span>
              <span className="metric-row__value">{open.ports.join(", ") || "—"}</span>
            </div>
          </div>
          <div className="drawer__section">
            <div className="section-title" style={{ marginBottom: 8 }}>Recent logs</div>
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
              {logsData?.logs || "No logs available."}
            </pre>
          </div>
        </ResourceDrawer>
      )}
    </div>
  );
}
