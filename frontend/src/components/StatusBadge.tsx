import type { Status } from "../api/types";

const LABELS: Record<Status, string> = {
  online: "En ligne",
  degraded: "Dégradé",
  warning: "Alerte",
  offline: "Hors ligne",
  unknown: "Inconnu",
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      <span className="status-badge__dot" />
      {label ?? LABELS[status]}
    </span>
  );
}
