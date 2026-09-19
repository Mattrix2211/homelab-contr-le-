import type { ContainerInfo } from "../api/types";
import { formatMb, formatPercent, formatUptime } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { ActionButton } from "./ActionButton";
import { useContainerAction } from "../api/hooks";

export function ContainerRow({ container, onOpen }: { container: ContainerInfo; onOpen: () => void }) {
  const mutation = useContainerAction();
  const running = container.state === "running";

  return (
    <div className="row">
      <div className="row__primary" onClick={onOpen} style={{ cursor: "pointer" }}>
        {container.name}
        <div className="row__secondary mono">{container.image}</div>
      </div>
      <div style={{ width: 110 }}>
        <StatusBadge status={container.status} />
      </div>
      <div className="mono row__secondary" style={{ width: 70 }}>
        {formatPercent(container.cpuPercent)}
      </div>
      <div className="mono row__secondary" style={{ width: 90 }}>
        {formatMb(container.ramMb)}
      </div>
      <div className="mono row__secondary" style={{ width: 90 }}>
        {formatUptime(container.uptimeSeconds)}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {running ? (
          <>
            <ActionButton
              label="Restart"
              level={2}
              confirmBody={`${container.name} will be temporarily unavailable.`}
              onRun={() => mutation.mutateAsync({ id: container.id, action: "restart" })}
            />
            <ActionButton
              label="Stop"
              level={2}
              confirmBody={`${container.name} will stop responding.`}
              onRun={() => mutation.mutateAsync({ id: container.id, action: "stop" })}
            />
          </>
        ) : (
          <ActionButton
            label="Start"
            level={1}
            onRun={() => mutation.mutateAsync({ id: container.id, action: "start" })}
          />
        )}
      </div>
    </div>
  );
}
