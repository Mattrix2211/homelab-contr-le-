export type Status = "online" | "degraded" | "warning" | "offline" | "unknown";
export type Role = "viewer" | "operator" | "admin";

export interface HostStatus {
  id: string;
  name: string;
  role: string;
  ip: string;
  kind: "proxmox" | "truenas" | "standalone";
  status: Status;
  cpuPercent?: number;
  ramPercent?: number;
  tempC?: number;
  uptimeSeconds?: number;
  unavailableReason?: string;
}

export interface ServiceStatus {
  id: string;
  name: string;
  category: string;
  hostId: string;
  status: Status;
  cpuPercent?: number;
  ramMb?: number;
  uptimeSeconds?: number;
  critical: boolean;
  dependsOn?: string[];
  containerName?: string;
  unavailableReason?: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: Status;
  state: string;
  health?: string;
  uptimeSeconds?: number;
  cpuPercent?: number;
  ramMb?: number;
  ramLimitMb?: number;
  ports: string[];
  createdAt: string;
}

export interface EventRow {
  id: string;
  category: "alert" | "system" | "action";
  severity: "info" | "warning" | "critical";
  source: string;
  message: string;
  metadata: string | null;
  active: number;
  created_at: string;
  resolved_at: string | null;
}

export interface AuditEntryRow {
  id: string;
  user_display_name: string;
  action: string;
  target: string;
  params: string | null;
  result: "success" | "error" | "denied";
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  displayName: string;
}

export interface ProxmoxGuest {
  vmid: number;
  name: string;
  type: "qemu" | "lxc";
  status: "running" | "stopped" | "paused" | "unknown";
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
}
