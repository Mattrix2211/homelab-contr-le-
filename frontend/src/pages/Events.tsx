import { useState } from "react";
import { useAuditLog, useEvents } from "../api/hooks";
import { EventRow } from "../components/EventRow";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../store/auth";
import { formatClock } from "../lib/format";

type Tab = "alerts" | "system" | "actions" | "audit";

export function Events() {
  const [tab, setTab] = useState<Tab>("alerts");
  const { data } = useEvents(300);
  const { user } = useAuth();
  const { data: auditData } = useAuditLog(tab === "audit" && user?.role === "admin");

  const events = data?.events ?? [];
  const filtered = events.filter((e) => {
    if (tab === "alerts") return e.category === "alert";
    if (tab === "system") return e.category === "system";
    if (tab === "actions") return e.category === "action";
    return false;
  });

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Events</div>
          <div className="page__subtitle">Alerts, system events, and user actions</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className={`btn btn--sm ${tab === "alerts" ? "btn--primary" : "btn--ghost"}`} onClick={() => setTab("alerts")}>Alerts</button>
        <button className={`btn btn--sm ${tab === "system" ? "btn--primary" : "btn--ghost"}`} onClick={() => setTab("system")}>System events</button>
        <button className={`btn btn--sm ${tab === "actions" ? "btn--primary" : "btn--ghost"}`} onClick={() => setTab("actions")}>User actions</button>
        {user?.role === "admin" && (
          <button className={`btn btn--sm ${tab === "audit" ? "btn--primary" : "btn--ghost"}`} onClick={() => setTab("audit")}>Audit log</button>
        )}
      </div>

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
