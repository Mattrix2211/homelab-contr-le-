import type { ServiceStatus } from "../api/types";
import { formatMb, formatPercent, formatUptime } from "../lib/format";
import { StatusBadge } from "./StatusBadge";

export function ServiceCard({ service, onClick }: { service: ServiceStatus; onClick?: () => void }) {
  return (
    <div className="card card--interactive" onClick={onClick}>
      <div className="host-card__header">
        <div>
          <div className="host-card__name">{service.name}</div>
          <div className="host-card__role">{service.category}</div>
        </div>
        <StatusBadge status={service.status} />
      </div>

      {service.status === "unknown" && service.unavailableReason ? (
        <div className="text-tertiary" style={{ fontSize: 12 }}>
          {service.unavailableReason}
        </div>
      ) : (
        <div className="host-card__metrics">
          <div className="metric-row">
            <span className="metric-row__label">CPU</span>
            <span className="metric-row__value">{formatPercent(service.cpuPercent)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-row__label">RAM</span>
            <span className="metric-row__value">{formatMb(service.ramMb)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-row__label">Uptime</span>
            <span className="metric-row__value">{formatUptime(service.uptimeSeconds)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
