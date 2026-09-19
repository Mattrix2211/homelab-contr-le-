import type { Pool } from "../api/types";
import { formatBytes, formatPercent } from "../lib/format";
import { StatusBadge } from "./StatusBadge";

export function StorageCard({ pool, onScrub }: { pool: Pool; onScrub?: () => void }) {
  const usagePercent = pool.totalBytes > 0 ? (pool.usedBytes / pool.totalBytes) * 100 : 0;
  return (
    <div className="card">
      <div className="host-card__header">
        <div>
          <div className="host-card__name">POOL {pool.name.toUpperCase()}</div>
        </div>
        <StatusBadge status={pool.healthy ? "online" : "offline"} label={pool.healthy ? "Healthy" : "Degraded"} />
      </div>
      <div className="host-card__metrics">
        <div className="metric-row">
          <span className="metric-row__label">Used</span>
          <span className="metric-row__value">{formatBytes(pool.usedBytes)}</span>
        </div>
        <div className="metric-row">
          <span className="metric-row__label">Free</span>
          <span className="metric-row__value">{formatBytes(pool.totalBytes - pool.usedBytes)}</span>
        </div>
        <div className="metric-row">
          <span className="metric-row__label">Usage</span>
          <span className="metric-row__value">{formatPercent(usagePercent)}</span>
        </div>
      </div>
      {onScrub && (
        <div style={{ marginTop: 12 }}>
          <button className="btn btn--sm btn--ghost" onClick={onScrub}>
            Run scrub
          </button>
        </div>
      )}
    </div>
  );
}
