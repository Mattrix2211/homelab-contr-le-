import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Role,
  HostStatus,
  ServiceStatus,
  ContainerInfo,
  EventRow,
  AuditEntryRow,
  ProxmoxGuest,
  Pool,
  Dataset,
  Disk,
  Snapshot,
  Backup,
  BackupKind,
  AdGuardStats,
  NpmProxy,
  NpmCertificate,
  WireguardPeer,
  FrigateStatus,
  ContainerUpdateInfo,
  AutomationRule,
  TriggerKind,
  NotificationChannel,
  NotificationKind,
  UptimeKumaMonitor,
  AnomalyInfo,
} from "./types";

export function useHosts() {
  return useQuery({
    queryKey: ["hosts"],
    queryFn: () => api.get<{ hosts: HostStatus[]; generatedAt: string }>("/hosts"),
    refetchInterval: 15_000,
  });
}

export function useHost(id: string | undefined) {
  return useQuery({
    queryKey: ["hosts", id],
    queryFn: () => api.get<{ host: HostStatus; services: ServiceStatus[] }>(`/hosts/${id}`),
    enabled: !!id,
    refetchInterval: 15_000,
  });
}

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: () => api.get<{ services: ServiceStatus[]; generatedAt: string }>("/services"),
    refetchInterval: 15_000,
  });
}

export function useContainers() {
  return useQuery({
    queryKey: ["containers"],
    queryFn: () => api.get<{ containers: ContainerInfo[]; generatedAt: string }>("/containers"),
    refetchInterval: 15_000,
  });
}

export function useContainerLogs(id: string | undefined) {
  return useQuery({
    queryKey: ["containers", id, "logs"],
    queryFn: () => api.get<{ logs: string }>(`/containers/${id}/logs?tail=300`),
    enabled: !!id,
  });
}

export function useContainerAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/containers/${id}/actions`, { action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["containers"] });
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useEvents(limit = 200) {
  return useQuery({
    queryKey: ["events", limit],
    queryFn: () => api.get<{ events: EventRow[] }>(`/events?limit=${limit}`),
    refetchInterval: 15_000,
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.get<{ alerts: EventRow[] }>("/events/alerts"),
    refetchInterval: 10_000,
  });
}

export function useAuditLog(enabled: boolean) {
  return useQuery({
    queryKey: ["audit"],
    queryFn: () => api.get<{ entries: AuditEntryRow[] }>("/events/audit"),
    enabled,
    refetchInterval: 20_000,
  });
}

export function useProxmoxGuests() {
  return useQuery({
    queryKey: ["proxmox", "guests"],
    queryFn: () => api.get<{ guests: ProxmoxGuest[] }>("/proxmox/guests"),
    refetchInterval: 15_000,
  });
}

export function useGuestAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vmid, type, action }: { vmid: number; type: "qemu" | "lxc"; action: string }) =>
      api.post(`/proxmox/guests/${vmid}/actions`, { type, action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proxmox", "guests"] }),
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () =>
      api.get<{ hosts: HostStatus[]; services: ServiceStatus[]; containers: ContainerInfo[]; pages: { id: string; label: string; path: string }[] }>(
        `/search?q=${encodeURIComponent(query)}`
      ),
    enabled: query.trim().length > 0,
  });
}

// --- TrueNAS / Storage -----------------------------------------------------

export function useTruenasAvailable() {
  return useQuery({
    queryKey: ["truenas", "available"],
    queryFn: () => api.get<{ available: boolean }>("/truenas/available"),
    staleTime: 60_000,
  });
}

export function usePools() {
  return useQuery({
    queryKey: ["truenas", "pools"],
    queryFn: () => api.get<{ pools: Pool[] }>("/truenas/pools"),
    refetchInterval: 30_000,
  });
}

export function useDatasets() {
  return useQuery({
    queryKey: ["truenas", "datasets"],
    queryFn: () => api.get<{ datasets: Dataset[] }>("/truenas/datasets"),
    refetchInterval: 60_000,
  });
}

export function useDisks() {
  return useQuery({
    queryKey: ["truenas", "disks"],
    queryFn: () => api.get<{ disks: Disk[] }>("/truenas/disks"),
    refetchInterval: 60_000,
  });
}

export function useSnapshots() {
  return useQuery({
    queryKey: ["truenas", "snapshots"],
    queryFn: () => api.get<{ snapshots: Snapshot[] }>("/truenas/snapshots"),
    refetchInterval: 60_000,
  });
}

export function useCreateSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dataset, name }: { dataset: string; name: string }) =>
      api.post("/truenas/snapshots", { dataset, name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["truenas", "snapshots"] }),
  });
}

export function useRunSmartTest() {
  return useMutation({
    mutationFn: ({ disk, type }: { disk: string; type: "SHORT" | "LONG" }) =>
      api.post(`/truenas/disks/${encodeURIComponent(disk)}/smart-test`, { type }),
  });
}

export function useRunScrub() {
  return useMutation({
    mutationFn: (poolId: number) => api.post(`/truenas/pools/${poolId}/scrub`),
  });
}

// --- Backups (section 12) --------------------------------------------------

export function useBackups() {
  return useQuery({
    queryKey: ["backups"],
    queryFn: () => api.get<{ backups: Backup[] }>("/backups"),
    refetchInterval: 30_000,
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; kind: BackupKind; targetRef?: string; triggerUrl?: string }) =>
      api.post("/backups", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backups"] }),
  });
}

export function useRunBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/backups/${id}/run`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backups"] }),
  });
}

export function useRemoveBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/backups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backups"] }),
  });
}

// --- Network (sections 13-15) -----------------------------------------------

export function useAdGuardStats() {
  return useQuery({
    queryKey: ["network", "adguard"],
    queryFn: () => api.get<{ available: boolean; stats: AdGuardStats | null }>("/network/adguard/stats"),
    refetchInterval: 15_000,
  });
}

export function useToggleAdGuardProtection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enable: boolean) => api.post("/network/adguard/protection", { enable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["network", "adguard"] }),
  });
}

export function useNpmProxies() {
  return useQuery({
    queryKey: ["network", "npm", "proxies"],
    queryFn: () => api.get<{ available: boolean; proxies: NpmProxy[] }>("/network/npm/proxies"),
    refetchInterval: 60_000,
  });
}

export function useNpmCertificates() {
  return useQuery({
    queryKey: ["network", "npm", "certificates"],
    queryFn: () => api.get<{ available: boolean; certificates: NpmCertificate[] }>("/network/npm/certificates"),
    refetchInterval: 60_000,
  });
}

export function useWireguardPeers() {
  return useQuery({
    queryKey: ["network", "wireguard"],
    queryFn: () => api.get<{ available: boolean; peers: WireguardPeer[] }>("/network/wireguard/peers"),
    refetchInterval: 30_000,
  });
}

// --- Frigate (section 17) ---------------------------------------------------

export function useFrigateStatus() {
  return useQuery({
    queryKey: ["frigate", "status"],
    queryFn: () => api.get<FrigateStatus>("/frigate/status"),
    refetchInterval: 20_000,
  });
}

// --- Updates (section 39) ---------------------------------------------------

export function useUpdates() {
  return useQuery({
    queryKey: ["updates"],
    queryFn: () => api.get<{ updates: ContainerUpdateInfo[]; checkedAt: string | null }>("/updates"),
    refetchInterval: 60_000,
  });
}

// --- Automation rules (section 44) -------------------------------------------

export function useAutomationRules() {
  return useQuery({
    queryKey: ["automation-rules"],
    queryFn: () => api.get<{ rules: AutomationRule[] }>("/automation-rules"),
  });
}

export function useCreateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      triggerKind: TriggerKind;
      triggerTarget: string;
      triggerMinutes: number;
      actionKey: string;
      actionTarget: string;
      cooldownMinutes: number;
    }) => api.post("/automation-rules", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
  });
}

export function useSetAutomationRuleEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.post(`/automation-rules/${id}/enabled`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
  });
}

export function useRemoveAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/automation-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
  });
}

// --- Notification channels (section 25) ---------------------------------------

export function useNotificationChannels() {
  return useQuery({
    queryKey: ["notification-channels"],
    queryFn: () => api.get<{ channels: NotificationChannel[] }>("/notification-channels"),
  });
}

export function useCreateNotificationChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: NotificationKind; target: string; minSeverity: "info" | "warning" | "critical" }) =>
      api.post("/notification-channels", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-channels"] }),
  });
}

export function useTestNotificationChannel() {
  return useMutation({
    mutationFn: (id: string) => api.post(`/notification-channels/${id}/test`),
  });
}

export function useRemoveNotificationChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/notification-channels/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-channels"] }),
  });
}

// --- Dashboard preferences (section 44) ---------------------------------------

export function useCockpitLayout() {
  return useQuery({
    queryKey: ["preferences", "cockpit-layout"],
    queryFn: () => api.get<{ layout: { id: string; visible: boolean }[] | null }>("/preferences/cockpit-layout"),
  });
}

export function useSetCockpitLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (layout: { id: string; visible: boolean }[]) => api.post("/preferences/cockpit-layout", { layout }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preferences", "cockpit-layout"] }),
  });
}

export function useMarkNotificationsSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/preferences/notifications-seen"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preferences", "notifications-last-seen"] }),
  });
}

export function useNotificationsLastSeen() {
  return useQuery({
    queryKey: ["preferences", "notifications-last-seen"],
    queryFn: () => api.get<{ lastSeenAt: string | null }>("/preferences/notifications-last-seen"),
  });
}

// --- Uptime Kuma (section 37) -----------------------------------------------

export function useUptimeKumaMonitors() {
  return useQuery({
    queryKey: ["uptime-kuma", "monitors"],
    queryFn: () => api.get<{ available: boolean; monitors: UptimeKumaMonitor[] }>("/uptime-kuma/monitors"),
    refetchInterval: 30_000,
  });
}

// --- Anomaly detection (section 44) -----------------------------------------

export function useAnomalies() {
  return useQuery({
    queryKey: ["anomalies"],
    queryFn: () => api.get<{ anomalies: AnomalyInfo[]; checkedAt: string | null }>("/anomalies"),
    refetchInterval: 60_000,
  });
}

export function useIntegrationsConfig(enabled: boolean) {
  return useQuery({
    queryKey: ["config", "integrations"],
    queryFn: () =>
      api.get<Record<string, { enabled: boolean; baseUrl?: string | null; socketPath?: string; node?: string }>>(
        "/config/integrations"
      ),
    enabled,
  });
}

export function useUsersList(enabled: boolean) {
  return useQuery({
    queryKey: ["config", "users"],
    queryFn: () => api.get<{ users: { id: string; email: string; role: string; displayName: string; lastLoginAt: string | null }[] }>(
      "/config/users"
    ),
    enabled,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string; role: Role; displayName: string }) =>
      api.post("/config/users", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config", "users"] }),
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.patch(`/config/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config", "users"] }),
  });
}

export function useRemoveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/config/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config", "users"] }),
  });
}

export interface QuickAction {
  id: string;
  label: string;
  action_key: string;
  target: string;
  level: 1 | 2 | 3;
}

export function useQuickActionsList() {
  return useQuery({
    queryKey: ["quick-actions"],
    queryFn: () => api.get<{ quickActions: QuickAction[] }>("/quick-actions"),
  });
}

export function useRemoveQuickAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/quick-actions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quick-actions"] }),
  });
}

export function useCreateQuickAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; actionKey: string; target: string }) => api.post("/quick-actions", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quick-actions"] }),
  });
}

export function useRunQuickAction() {
  return useMutation({
    mutationFn: (id: string) => api.post(`/quick-actions/${id}/run`),
  });
}

export function usePrometheusAvailable() {
  return useQuery({
    queryKey: ["metrics", "available"],
    queryFn: () => api.get<{ available: boolean }>("/metrics/available"),
    staleTime: 60_000,
  });
}

export function useMetricRange(promql: string, rangeMinutes: number, stepSeconds: number, enabled = true) {
  return useQuery({
    queryKey: ["metrics", "range", promql, rangeMinutes, stepSeconds],
    queryFn: () =>
      api.get<{ available: boolean; samples: { t: number; v: number }[] }>(
        `/metrics/range?promql=${encodeURIComponent(promql)}&rangeMinutes=${rangeMinutes}&stepSeconds=${stepSeconds}`
      ),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useHomeAssistantEntitiesSummary() {
  return useQuery({
    queryKey: ["home-assistant", "entities-summary"],
    queryFn: () =>
      api.get<{
        available: boolean;
        summary: { totalEntities: number; unavailableCount: number; unavailableEntities: { entityId: string; friendlyName: string }[] } | null;
      }>("/home-assistant/entities-summary"),
    refetchInterval: 30_000,
  });
}

export function useZigbeeDeviceCount() {
  return useQuery({
    queryKey: ["home-assistant", "zigbee-devices"],
    queryFn: () => api.get<{ available: boolean; count: number | null }>("/home-assistant/zigbee-devices"),
    refetchInterval: 60_000,
  });
}

export function useHomeAssistantRestart() {
  return useMutation({
    mutationFn: () => api.post("/home-assistant/restart"),
  });
}

export function useLinks() {
  return useQuery({
    queryKey: ["links"],
    queryFn: () => api.get<{ links: Record<string, string> }>("/links"),
    staleTime: 5 * 60_000,
  });
}

// Live snapshot pushed by the backend over WebSocket; invalidates the
// relevant react-query caches so every page re-renders with fresh data
// without needing to poll aggressively (section 31).
export function useLiveSnapshot() {
  const qc = useQueryClient();
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let attempt = 0;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
      ws = socket;

      socket.onopen = () => {
        attempt = 0;
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "snapshot") {
            qc.setQueryData(["hosts"], { hosts: msg.data.hosts, generatedAt: msg.data.generatedAt });
            qc.setQueryData(["services"], { services: msg.data.services, generatedAt: msg.data.generatedAt });
            qc.setQueryData(["containers"], { containers: msg.data.containers, generatedAt: msg.data.generatedAt });
          }
        } catch {
          // ignore malformed frames
        }
      };

      // Reconnect with capped exponential backoff (1s, 2s, 4s, ... up to
      // 30s) rather than giving up silently - the 15s REST refetchInterval
      // fallback covers freshness in the meantime, so there's no rush.
      socket.onclose = () => {
        if (cancelled) return;
        const delay = Math.min(30_000, 1000 * 2 ** attempt);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [qc]);
}
