import { useState } from "react";
import type { Disk } from "../api/types";
import { StatusBadge } from "./StatusBadge";
import { ActionButton } from "./ActionButton";
import { useRunSmartTest } from "../api/hooks";

export function DiskCard({ disk }: { disk: Disk }) {
  const [testType, setTestType] = useState<"SHORT" | "LONG">("SHORT");
  const runSmart = useRunSmartTest();

  const status = disk.smartPassed === null ? "unknown" : disk.smartPassed ? "online" : "offline";

  return (
    <div className="card">
      <div className="host-card__header">
        <div>
          <div className="host-card__name">{disk.name}</div>
          {disk.model && <div className="host-card__role">{disk.model}</div>}
        </div>
        <StatusBadge status={status} label={disk.smartPassed === null ? "Unknown" : disk.smartPassed ? "SMART PASSED" : "SMART FAILED"} />
      </div>
      <div className="host-card__metrics">
        <div className="metric-row">
          <span className="metric-row__label">Temp</span>
          <span className="metric-row__value">{disk.tempC !== null ? `${Math.round(disk.tempC)}°C` : "—"}</span>
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <select
          value={testType}
          onChange={(e) => setTestType(e.target.value as "SHORT" | "LONG")}
          style={{
            background: "var(--color-background)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text-primary)",
            fontSize: 12,
            padding: "4px 6px",
          }}
        >
          <option value="SHORT">Short test</option>
          <option value="LONG">Long test</option>
        </select>
        <ActionButton
          label="Run SMART test"
          level={1}
          onRun={() => runSmart.mutateAsync({ disk: disk.name, type: testType })}
        />
      </div>
    </div>
  );
}
