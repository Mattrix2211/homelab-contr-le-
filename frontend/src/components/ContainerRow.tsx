import type { ContainerInfo } from "../api/types";
import { formatMb, formatPercent, formatUptime } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { ActionButton } from "./ActionButton";
import { useContainerAction } from "../api/hooks";

export function ContainerRow({
  container,
  onOpen,
  hasUpdate,
}: {
  container: ContainerInfo;
  onOpen: () => void;
  hasUpdate?: boolean;
}) {
  const mutation = useContainerAction();
  const running = container.state === "running";

  return (
    <div className="row">
      <div className="row__primary" onClick={onOpen} style={{ cursor: "pointer" }}>
        {container.name}
        {hasUpdate && (
          <span className="status-badge status-badge--warning" style={{ marginLeft: 8 }}>
            <span className="status-badge__dot" />
            Mise à jour
          </span>
        )}
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
              label="Redémarrer"
              level={2}
              confirmBody={`${container.name} sera temporairement indisponible.`}
              onRun={() => mutation.mutateAsync({ id: container.id, action: "restart" })}
            />
            <ActionButton
              label="Arrêter"
              level={2}
              confirmBody={`${container.name} ne répondra plus.`}
              onRun={() => mutation.mutateAsync({ id: container.id, action: "stop" })}
            />
          </>
        ) : (
          <ActionButton
            label="Démarrer"
            level={1}
            onRun={() => mutation.mutateAsync({ id: container.id, action: "start" })}
          />
        )}
      </div>
    </div>
  );
}
