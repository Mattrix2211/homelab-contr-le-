import { HOSTS, SERVICES, DOCKER_HOST_ID, type HostDef, type ServiceDef } from "../config/registry.js";
import { dockerAvailable, dockerLastError, listContainers } from "../integrations/docker.js";
import { getNodeStatus, proxmoxAvailable, proxmoxLastError } from "../integrations/proxmox.js";
import { truenasAvailable, truenasLastError, listPools } from "../integrations/truenas.js";
import { getStatus as getHaStatus, homeAssistantAvailable, homeAssistantLastError } from "../integrations/homeassistant.js";
import { eventsRepo } from "../db/repo.js";
import type { ContainerInfo, HostStatus, ServiceStatus, Status } from "../types.js";

export interface Snapshot {
  hosts: HostStatus[];
  services: ServiceStatus[];
  containers: ContainerInfo[];
  generatedAt: string;
}

let snapshot: Snapshot = { hosts: [], services: [], containers: [], generatedAt: new Date(0).toISOString() };
let lastGoodContainers: ContainerInfo[] = [];
let lastGoodContainersAt = 0;

function findContainer(containers: ContainerInfo[], names: string[] | undefined): ContainerInfo | undefined {
  if (!names) return undefined;
  return containers.find((c) => names.some((n) => c.name.toLowerCase().includes(n.toLowerCase())));
}

async function buildHostStatus(host: HostDef, containers: ContainerInfo[]): Promise<HostStatus> {
  if (host.kind === "proxmox") {
    if (!proxmoxAvailable()) {
      return {
        id: host.id,
        name: host.name,
        role: host.role,
        ip: host.ip,
        kind: host.kind,
        status: "unknown",
        unavailableReason: "Proxmox integration not configured",
      };
    }
    const node = await getNodeStatus();
    if (!node) {
      return {
        id: host.id,
        name: host.name,
        role: host.role,
        ip: host.ip,
        kind: host.kind,
        status: "unknown",
        unavailableReason: proxmoxLastError() ?? "Proxmox API unreachable",
      };
    }
    return {
      id: host.id,
      name: host.name,
      role: host.role,
      ip: host.ip,
      kind: host.kind,
      status: "online",
      cpuPercent: Math.round(node.cpu * 10) / 10,
      ramPercent: Math.round((node.memory.used / node.memory.total) * 1000) / 10,
      uptimeSeconds: node.uptime,
    };
  }

  if (host.kind === "truenas") {
    if (!truenasAvailable()) {
      return {
        id: host.id,
        name: host.name,
        role: host.role,
        ip: host.ip,
        kind: host.kind,
        status: "unknown",
        unavailableReason: "TrueNAS integration not configured",
      };
    }
    const pools = await listPools();
    const healthy = pools.length > 0 && pools.every((p) => p.healthy);
    return {
      id: host.id,
      name: host.name,
      role: host.role,
      ip: host.ip,
      kind: host.kind,
      status: pools.length === 0 ? "unknown" : healthy ? "online" : "degraded",
      unavailableReason: pools.length === 0 ? (truenasLastError() ?? "No pool data") : undefined,
    };
  }

  // standalone (Raspberry Pi / Home Assistant host)
  if (homeAssistantAvailable()) {
    const ha = await getHaStatus();
    return {
      id: host.id,
      name: host.name,
      role: host.role,
      ip: host.ip,
      kind: host.kind,
      status: ha ? "online" : "unknown",
      unavailableReason: ha ? undefined : (homeAssistantLastError() ?? "Home Assistant unreachable"),
    };
  }

  return {
    id: host.id,
    name: host.name,
    role: host.role,
    ip: host.ip,
    kind: host.kind,
    status: "unknown",
    unavailableReason: "No integration configured for this host",
  };
}

function buildServiceStatus(svc: ServiceDef, containers: ContainerInfo[]): ServiceStatus {
  const base = {
    id: svc.id,
    name: svc.name,
    category: svc.category,
    hostId: svc.hostId,
    critical: svc.critical,
    dependsOn: svc.dependsOn,
  };

  if (svc.hostId === DOCKER_HOST_ID && svc.containerNames) {
    if (!dockerAvailable()) {
      return { ...base, status: "unknown", unavailableReason: dockerLastError() ?? "Docker integration not configured" };
    }
    const container = findContainer(containers, svc.containerNames);
    if (!container) {
      return { ...base, status: "unknown", unavailableReason: "Container not found" };
    }
    return {
      ...base,
      status: container.status,
      cpuPercent: container.cpuPercent,
      ramMb: container.ramMb,
      uptimeSeconds: container.uptimeSeconds,
      containerName: container.name,
    };
  }

  if (svc.id === "home-assistant") {
    return { ...base, status: homeAssistantAvailable() ? "online" : "unknown", unavailableReason: homeAssistantAvailable() ? undefined : "Home Assistant integration not configured" };
  }

  if (svc.id === "truenas") {
    return { ...base, status: truenasAvailable() ? "online" : "unknown", unavailableReason: truenasAvailable() ? undefined : "TrueNAS integration not configured" };
  }

  return { ...base, status: "unknown", unavailableReason: "No live data source bound yet" };
}

const CRITICAL_STATUSES: Status[] = ["offline"];
const WARNING_STATUSES: Status[] = ["degraded", "warning"];

function reconcileAlerts(hosts: HostStatus[], services: ServiceStatus[]) {
  for (const h of hosts) {
    const source = `host:${h.id}`;
    const message = `${h.name} is offline`;
    const def = HOSTS.find((x) => x.id === h.id);
    if (def?.critical && CRITICAL_STATUSES.includes(h.status)) {
      if (!eventsRepo.hasActiveAlert(source, message)) {
        eventsRepo.record({ category: "alert", severity: "critical", source, message });
      }
    } else {
      eventsRepo.resolveAlertsBySource(source);
    }
  }

  for (const s of services) {
    const source = `service:${s.id}`;
    if (s.critical && CRITICAL_STATUSES.includes(s.status)) {
      const message = `${s.name} is offline`;
      if (!eventsRepo.hasActiveAlert(source, message)) {
        eventsRepo.record({ category: "alert", severity: "critical", source, message });
      }
    } else if (s.critical && WARNING_STATUSES.includes(s.status)) {
      const message = `${s.name} is degraded`;
      if (!eventsRepo.hasActiveAlert(source, message)) {
        eventsRepo.record({ category: "alert", severity: "warning", source, message });
      }
    } else {
      eventsRepo.resolveAlertsBySource(source);
    }
  }
}

export async function refreshSnapshot(): Promise<Snapshot> {
  let containers: ContainerInfo[];
  try {
    containers = await listContainers();
    if (containers.length > 0 || dockerAvailable()) {
      lastGoodContainers = containers;
      lastGoodContainersAt = Date.now();
    }
  } catch {
    containers = lastGoodContainers;
  }

  const hosts = await Promise.all(HOSTS.map((h) => buildHostStatus(h, containers)));
  const services = SERVICES.map((s) => buildServiceStatus(s, containers));

  reconcileAlerts(hosts, services);

  snapshot = {
    hosts,
    services,
    containers,
    generatedAt: new Date().toISOString(),
  };
  return snapshot;
}

export function getSnapshot(): Snapshot {
  return snapshot;
}

export function startMonitoringLoop(intervalMs = 10_000, onUpdate?: (s: Snapshot) => void) {
  const tick = async () => {
    try {
      const s = await refreshSnapshot();
      onUpdate?.(s);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[monitoring] refresh failed", err);
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}
