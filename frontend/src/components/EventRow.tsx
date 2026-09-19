import type { EventRow as EventRowType } from "../api/types";
import { formatClock } from "../lib/format";

const CATEGORY_LABEL: Record<EventRowType["category"], string> = {
  alert: "ALERT",
  system: "SYSTEM",
  action: "ACTION",
};

export function EventRow({ event }: { event: EventRowType }) {
  return (
    <div className="row">
      <div className="mono row__secondary" style={{ width: 90 }}>
        {formatClock(event.created_at)}
      </div>
      <div style={{ width: 90 }}>
        <span className={`status-badge status-badge--${event.severity === "critical" ? "offline" : event.severity === "warning" ? "warning" : "online"}`}>
          <span className="status-badge__dot" />
          {CATEGORY_LABEL[event.category]}
        </span>
      </div>
      <div className="row__primary">
        {event.message}
        <div className="row__secondary">{event.source}</div>
      </div>
    </div>
  );
}
