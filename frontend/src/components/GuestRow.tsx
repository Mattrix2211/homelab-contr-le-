import type { ProxmoxGuest } from "../api/types";
import { formatMb, formatPercent, formatUptime } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { ActionButton } from "./ActionButton";
import { useGuestAction } from "../api/hooks";

const STATUS_MAP: Record<ProxmoxGuest["status"], "online" | "offline" | "warning" | "unknown"> = {
  running: "online",
  stopped: "offline",
  paused: "warning",
  unknown: "unknown",
};

export function GuestRow({ guest }: { guest: ProxmoxGuest }) {
  const mutation = useGuestAction();
  const running = guest.status === "running";

  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 13.5 }}>{guest.name}</div>
          <div className="row__secondary mono">{guest.type.toUpperCase()} {guest.vmid}</div>
        </div>
        <StatusBadge status={STATUS_MAP[guest.status]} label={guest.status.toUpperCase()} />
      </div>
      <div className="mono text-tertiary" style={{ fontSize: 11.5, marginBottom: 8 }}>
        CPU {formatPercent(guest.cpu)} · RAM {formatMb(guest.mem / 1024 / 1024)}/{formatMb(guest.maxmem / 1024 / 1024)} · Up {formatUptime(guest.uptime)}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {running ? (
          <>
            <ActionButton
              label="Reboot"
              level={2}
              confirmBody={`${guest.name} will restart; anything running inside it stops briefly.`}
              onRun={() => mutation.mutateAsync({ vmid: guest.vmid, type: guest.type, action: "reboot" })}
            />
            <ActionButton
              label="Shutdown"
              level={2}
              confirmBody={`${guest.name} will be stopped.`}
              onRun={() => mutation.mutateAsync({ vmid: guest.vmid, type: guest.type, action: "shutdown" })}
            />
          </>
        ) : (
          <ActionButton
            label="Start"
            level={1}
            onRun={() => mutation.mutateAsync({ vmid: guest.vmid, type: guest.type, action: "start" })}
          />
        )}
      </div>
    </div>
  );
}
