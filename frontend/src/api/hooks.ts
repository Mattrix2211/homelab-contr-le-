import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "./client";
import type { HostStatus, ServiceStatus, ContainerInfo, EventRow, AuditEntryRow, ProxmoxGuest } from "./types";

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

export function useQuickActionsList() {
  return useQuery({
    queryKey: ["quick-actions"],
    queryFn: () => api.get<{ quickActions: { id: string; label: string; action_key: string; target: string }[] }>("/quick-actions"),
  });
}

export function useRemoveQuickAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/quick-actions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quick-actions"] }),
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
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    ws.onmessage = (event) => {
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
    return () => ws.close();
  }, [qc]);
}
