import type { EventRow } from "../api/types";
import { formatRelativeTime } from "../lib/format";

export function AlertCard({ alert }: { alert: EventRow }) {
  const level = alert.severity === "critical" ? "critical" : "warning";
  return (
    <div className={`alert-card alert-card--${level}`}>
      <div>
        <div className="alert-card__label">{level === "critical" ? "critique" : "avertissement"}</div>
        <div className="alert-card__message">{alert.message}</div>
      </div>
      <div className="alert-card__time">{formatRelativeTime(alert.created_at)}</div>
    </div>
  );
}
