import type { Status } from "../api/types";

const LABELS: Record<Status, string> = {
  online: "Online",
  degraded: "Degraded",
  warning: "Warning",
  offline: "Offline",
  unknown: "Unknown",
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      <span className="status-badge__dot" />
      {label ?? LABELS[status]}
    </span>
  );
}
