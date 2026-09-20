import { HOSTS, SERVICES, DOCKER_HOST_ID, type HostDef, type ServiceDef } from "../config/registry.js";
import { dockerAvailable, dockerLastError, listContainers } from "../integrations/docker.js";
import { getNodeStatus, proxmoxAvailable, proxmoxLastError } from "../integrations/proxmox.js";
import { promInstanceFor, promMetrics, prometheusAvailable } from "../integrations/prometheus.js";
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

// For a host, its own management API (Proxmox node API, TrueNAS API, Home
// Assistant API) IS the liveness check - there is no separate ping. So
// "configured but the call failed" means the host itself is down
// (status: offline, drives the System Map rollup and host_down automation
// rules), while "not configured at all" is the genuinely unknown case.
// This is deliberately different from a service/app-level integration
// (e.g. AdGuard unreachable doesn't mean its container is down).
// Fallback for hosts whose native integration (Proxmox/TrueNAS/Home Assistant)
// isn't configured: derive state from the node_exporter scrape target instead of
// leaving the host "unknown". A down target is reported as "degraded", not
// "offline" - a stopped node_exporter doesn't prove the machine is down, and
// "offline" would raise a critical alert and drive the host_down automation.
async function buildHostStatusFromPrometheus(host: HostDef, reason: string): Promise<HostStatus> {
  const base = { id: host.id, name: host.name, role: host.role, ip: host.ip, kind: host.kind };
  if (!prometheusAvailable()) return { ...base, status: "unknown", unavailableReason: reason };

  const instance = promInstanceFor(host);
  const up = await promMetrics.up(instance);
  if (up === null) return { ...base, status: "unknown", unavailableReason: `${reason} ; aucune cible Prometheus « ${instance} »` };
  if (up < 1) {
    return { ...base, status: "degraded", unavailableReason: `La cible Prometheus « ${instance} » est arrêtée (node_exporter injoignable)` };
  }

  const [cpu, ram, temp, uptime] = await Promise.all([
    promMetrics.cpuPercent(instance),
    promMetrics.ramPercent(instance),
    promMetrics.tempC(instance),
    promMetrics.uptimeSeconds(instance),
  ]);
  return {
    ...base,
    status: "online",
    cpuPercent: cpu === null ? undefined : Math.round(cpu * 10) / 10,
    ramPercent: ram === null ? undefined : Math.round(ram * 10) / 10,
    tempC: temp === null ? undefined : temp,
    uptimeSeconds: uptime === null ? undefined : uptime,
  };
}

async function buildHostStatus(host: HostDef, containers: ContainerInfo[]): Promise<HostStatus> {
  if (host.kind === "proxmox") {
    if (!proxmoxAvailable()) return buildHostStatusFromPrometheus(host, "Intégration Proxmox non configurée");
    const node = await getNodeStatus();
    if (!node) {
      return {
        id: host.id,
        name: host.name,
        role: host.role,
        ip: host.ip,
        kind: host.kind,
        status: "offline",
        unavailableReason: proxmoxLastError() ?? "API Proxmox injoignable",
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
    if (!truenasAvailable()) return buildHostStatusFromPrometheus(host, "Intégration TrueNAS non configurée");
    const pools = await listPools();
    if (pools.length === 0) {
      // Either the API call failed (real error set) or it succeeded with a
      // genuinely empty pool list; only the former means the host is down.
      const error = truenasLastError();
      return {
        id: host.id,
        name: host.name,
        role: host.role,
        ip: host.ip,
        kind: host.kind,
        status: error ? "offline" : "unknown",
        unavailableReason: error ?? "Aucun pool remonté",
      };
    }
    const healthy = pools.every((p) => p.healthy);
    return {
      id: host.id,
      name: host.name,
      role: host.role,
      ip: host.ip,
      kind: host.kind,
      status: healthy ? "online" : "degraded",
    };
  }

  // standalone (Raspberry Pi / Home Assistant host)
  if (homeAssistantAvailable()) {
    // Home Assistant decides up/down; node_exporter (if scraped) supplies the
    // CPU/RAM/temp/uptime figures HA doesn't report.
    const [ha, prom] = await Promise.all([getHaStatus(), buildHostStatusFromPrometheus(host, "")]);
    return {
      id: host.id,
      name: host.name,
      role: host.role,
      ip: host.ip,
      kind: host.kind,
      cpuPercent: prom.cpuPercent,
      ramPercent: prom.ramPercent,
      tempC: prom.tempC,
      uptimeSeconds: prom.uptimeSeconds,
      status: ha ? "online" : "offline",
      unavailableReason: ha ? undefined : (homeAssistantLastError() ?? "Home Assistant injoignable"),
    };
  }

  return buildHostStatusFromPrometheus(host, "Aucune intégration configurée pour cette machine");
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
      return { ...base, status: "unknown", unavailableReason: "Intégration Docker non configurée" };
    }
    const fetchError = dockerLastError();
    if (fetchError) {
      return { ...base, status: "unknown", unavailableReason: fetchError };
    }
    const container = findContainer(containers, svc.containerNames);
    if (!container) {
      return { ...base, status: "unknown", unavailableReason: "Conteneur introuvable" };
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
    return { ...base, status: homeAssistantAvailable() ? "online" : "unknown", unavailableReason: homeAssistantAvailable() ? undefined : "Intégration Home Assistant non configurée" };
  }

  if (svc.id === "truenas") {
    return { ...base, status: truenasAvailable() ? "online" : "unknown", unavailableReason: truenasAvailable() ? undefined : "Intégration TrueNAS non configurée" };
  }

  return { ...base, status: "unknown", unavailableReason: "Aucune source de données en direct associée" };
}

const CRITICAL_STATUSES: Status[] = ["offline"];
const WARNING_STATUSES: Status[] = ["degraded", "warning"];

// Set by the notification engine (section 25/44) so a brand-new alert can
// be dispatched to Discord/Home Assistant without this module depending on
// it directly.
type AlertListener = (input: { severity: "warning" | "critical"; source: string; message: string }) => void;
let onNewAlert: AlertListener | null = null;
export function setAlertListener(fn: AlertListener) {
  onNewAlert = fn;
}

// Exported so other engines (e.g. anomaly detection) raise alerts through
// the same dedupe/listener path instead of writing to `events` directly.
export function raiseAlert(source: string, severity: "warning" | "critical", message: string) {
  if (!eventsRepo.hasActiveAlert(source, message)) {
    eventsRepo.resolveAlertsBySource(source); // clear any stale differently-worded alert for this source first
    eventsRepo.record({ category: "alert", severity, source, message });
    onNewAlert?.({ severity, source, message });
  }
}

// System Map correlation (section 40): when a critical host is down, its
// dependent services necessarily go dark too. Rather than raise one alert
// per affected service, roll them into the single host-level alert so a
// single physical failure reads as one actionable item, not ten.
function reconcileAlerts(hosts: HostStatus[], services: ServiceStatus[]) {
  const downHostIds = new Set<string>();

  for (const h of hosts) {
    const source = `host:${h.id}`;
    const def = HOSTS.find((x) => x.id === h.id);
    if (def?.critical && CRITICAL_STATUSES.includes(h.status)) {
      downHostIds.add(h.id);
      const affected = services.filter((s) => s.hostId === h.id && s.critical).map((s) => s.name);
      const message =
        affected.length > 0
          ? `${h.name} est hors ligne — ${affected.length} service(s) dépendant(s) touché(s) : ${affected.join(", ")}`
          : `${h.name} est hors ligne`;
      raiseAlert(source, "critical", message);
    } else {
      eventsRepo.resolveAlertsBySource(source);
    }
  }

  // Docker daemon unreachable on its host, independent of the host itself
  // being up (e.g. the LXC is up but the Docker service inside it crashed):
  // also rolls all Docker-hosted critical services into one alert.
  const dockerHost = hosts.find((h) => h.id === DOCKER_HOST_ID);
  const dockerDown = !downHostIds.has(DOCKER_HOST_ID) && dockerAvailable() && !!dockerLastError();
  const dockerSource = "integration:docker";
  if (dockerDown) {
    const affected = services.filter((s) => s.hostId === DOCKER_HOST_ID && s.critical).map((s) => s.name);
    const message =
      affected.length > 0
        ? `Docker injoignable sur ${dockerHost?.name ?? DOCKER_HOST_ID} — ${affected.length} service(s) touché(s) : ${affected.join(", ")}`
        : `Docker injoignable sur ${dockerHost?.name ?? DOCKER_HOST_ID}`;
    raiseAlert(dockerSource, "critical", message);
  } else {
    eventsRepo.resolveAlertsBySource(dockerSource);
  }

  for (const s of services) {
    const source = `service:${s.id}`;
    const suppressed = downHostIds.has(s.hostId) || (dockerDown && s.hostId === DOCKER_HOST_ID);
    if (suppressed) {
      // Already covered by the host/docker rollup alert above.
      eventsRepo.resolveAlertsBySource(source);
    } else if (s.critical && CRITICAL_STATUSES.includes(s.status)) {
      raiseAlert(source, "critical", `${s.name} est hors ligne`);
    } else if (s.critical && WARNING_STATUSES.includes(s.status)) {
      raiseAlert(source, "warning", `${s.name} est dégradé`);
    } else {
      eventsRepo.resolveAlertsBySource(source);
    }
  }
}

export async function refreshSnapshot(): Promise<Snapshot> {
  // listContainers() never throws - a failed fetch is signaled via
  // dockerLastError(), not an exception - so a failed tick is detected
  // that way rather than with try/catch, and holds the last-known-good
  // list instead of flipping every Docker-hosted service to "not found".
  const fetched = await listContainers();
  const fetchFailed = dockerAvailable() && !!dockerLastError();
  const containers = fetchFailed ? lastGoodContainers : fetched;
  if (!fetchFailed) {
    lastGoodContainers = fetched;
    lastGoodContainersAt = Date.now();
  }

  const hosts = await Promise.all(
    HOSTS.map(async (h) => ({ ...(await buildHostStatus(h, containers)), promInstance: promInstanceFor(h) }))
  );
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
