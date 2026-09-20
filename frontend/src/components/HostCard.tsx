import type { HostStatus } from "../api/types";
import { formatPercent, formatUptime, loadTone } from "../lib/format";
import { StatusBadge } from "./StatusBadge";

export function HostCard({ host, onClick }: { host: HostStatus; onClick?: () => void }) {
  return (
    <div className={`card card--interactive card--status-${host.status}`} onClick={onClick}>
      <div className="host-card__header">
        <div>
          <div className="host-card__name">{host.name}</div>
          <div className="host-card__role">{host.role}</div>
        </div>
        <StatusBadge status={host.status} />
      </div>

      {host.status !== "online" && host.unavailableReason ? (
        <div className="text-tertiary" style={{ fontSize: 12 }}>
          {host.unavailableReason}
        </div>
      ) : (
        <div className="host-card__metrics">
          <div className="metric-row">
            <span className="metric-row__label">CPU</span>
            <span className={`metric-row__value ${loadTone(host.cpuPercent)}`}>{formatPercent(host.cpuPercent)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-row__label">RAM</span>
            <span className={`metric-row__value ${loadTone(host.ramPercent)}`}>{formatPercent(host.ramPercent)}</span>
          </div>
          {host.tempC !== undefined && (
            <div className="metric-row">
              <span className="metric-row__label">Temp</span>
              <span className="metric-row__value">{Math.round(host.tempC)}°C</span>
            </div>
          )}
          <div className="metric-row">
            <span className="metric-row__label">Uptime</span>
            <span className="metric-row__value">{formatUptime(host.uptimeSeconds)}</span>
          </div>
        </div>
      )}
      <div className="text-tertiary mono" style={{ fontSize: 11, marginTop: 12 }}>
        {host.ip}
      </div>
    </div>
  );
}
