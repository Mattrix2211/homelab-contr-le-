import { useMemo, useState } from "react";
import { useAuditLog, useEvents } from "../api/hooks";
import { EventRow } from "../components/EventRow";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../store/auth";
import { formatClock } from "../lib/format";

type Tab = "alerts" | "system" | "actions" | "audit";
type Severity = "all" | "info" | "warning" | "critical";
type Range = "24h" | "7d" | "30d" | "all";

const RANGE_MS: Record<Range, number | null> = {
  "24h": 24 * 3600_000,
  "7d": 7 * 24 * 3600_000,
  "30d": 30 * 24 * 3600_000,
  all: null,
};
const RANGE_FETCH_LIMIT: Record<Range, number> = { "24h": 300, "7d": 500, "30d": 1000, all: 1000 };

function toMs(iso: string): number {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`).getTime();
}

export function Events() {
  const [tab, setTab] = useState<Tab>("alerts");
  const [severity, setSeverity] = useState<Severity>("all");
  const [source, setSource] = useState("");
  const [range, setRange] = useState<Range>("7d");
  const { user } = useAuth();
  const { data } = useEvents(RANGE_FETCH_LIMIT[range]);
  const { data: auditData } = useAuditLog(tab === "audit" && user?.role === "admin");

  const events = data?.events ?? [];
  const filtered = useMemo(() => {
    const cutoffMs = RANGE_MS[range] !== null ? Date.now() - RANGE_MS[range]! : null;
    return events.filter((e) => {
      if (tab === "alerts" && e.category !== "alert") return false;
      if (tab === "system" && e.category !== "system") return false;
      if (tab === "actions" && e.category !== "action") return false;
      if (tab === "audit") return false;
      if (severity !== "all" && e.severity !== severity) return false;
      if (source && !e.source.toLowerCase().includes(source.toLowerCase())) return false;
      if (cutoffMs !== null && toMs(e.created_at) < cutoffMs) return false;
      return true;
    });
  }, [events, tab, severity, source, range]);

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Events</div>
          <div className="page__subtitle">Alerts, system events, and user actions</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`btn btn--sm ${tab === "alerts" ? "btn--primary" : "btn--ghost"}`} onClick={() => setTab("alerts")}>Alerts</button>
        <button className={`btn btn--sm ${tab === "system" ? "btn--primary" : "btn--ghost"}`} onClick={() => setTab("system")}>System events</button>
        <button className={`btn btn--sm ${tab === "actions" ? "btn--primary" : "btn--ghost"}`} onClick={() => setTab("actions")}>User actions</button>
        {user?.role === "admin" && (
          <button className={`btn btn--sm ${tab === "audit" ? "btn--primary" : "btn--ghost"}`} onClick={() => setTab("audit")}>Audit log</button>
        )}
      </div>

      {tab !== "audit" && (
        <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
            style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)", padding: "6px 10px" }}
          >
            <option value="all">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <input
            placeholder="Filter by source…"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "6px 10px", color: "var(--color-text-primary)", flex: 1, minWidth: 160 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            {(["24h", "7d", "30d", "all"] as Range[]).map((r) => (
              <button key={r} className={`btn btn--sm ${range === r ? "btn--primary" : "btn--ghost"}`} onClick={() => setRange(r)}>
                {r === "all" ? "All time" : r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {tab === "audit" ? (
          !auditData?.entries.length ? (
            <EmptyState title="No audit entries yet" />
          ) : (
            <div className="row-list">
              {auditData.entries.map((e) => (
                <div className="row" key={e.id}>
                  <div className="mono row__secondary" style={{ width: 90 }}>{formatClock(e.created_at)}</div>
                  <div className="row__primary">
                    {e.action} → {e.target}
                    <div className="row__secondary">{e.user_display_name}</div>
                  </div>
                  <span
                    className={`status-badge status-badge--${e.result === "success" ? "online" : e.result === "denied" ? "warning" : "offline"}`}
                  >
                    <span className="status-badge__dot" />
                    {e.result}
                  </span>
                  {e.duration_ms !== null && <span className="mono text-tertiary" style={{ width: 70, textAlign: "right" }}>{e.duration_ms} ms</span>}
                </div>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <EmptyState title="Nothing here yet" description="A healthy HomeLab produces a quiet timeline." />
        ) : (
          <div className="row-list">
            {filtered.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
