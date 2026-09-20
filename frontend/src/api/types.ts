export type Status = "online" | "degraded" | "warning" | "offline" | "unknown";
export type Role = "viewer" | "operator" | "admin";

export interface HostStatus {
  id: string;
  name: string;
  role: string;
  ip: string;
  promInstance?: string;
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

// --- TrueNAS / Storage ---------------------------------------------------

export interface Pool {
  id: number;
  name: string;
  healthy: boolean;
  usedBytes: number;
  totalBytes: number;
}

export interface Dataset {
  id: string;
  name: string;
  usedBytes: number;
  availableBytes: number;
  mountpoint: string | null;
}

export interface Disk {
  name: string;
  model: string | null;
  tempC: number | null;
  smartPassed: boolean | null;
}

export interface Snapshot {
  id: string;
  name: string;
  dataset: string;
  usedBytes: number;
  createdAt: string | null;
}

// --- Backups (section 12) -------------------------------------------------

export type BackupKind = "homeassistant" | "truenas-snapshot" | "custom";
export type BackupStatus = "success" | "error" | "running";

export interface Backup {
  id: string;
  label: string;
  kind: BackupKind;
  target_ref: string | null;
  trigger_url: string | null;
  last_run_at: string | null;
  last_status: BackupStatus | null;
  last_duration_ms: number | null;
  last_size_bytes: number | null;
  last_error: string | null;
  created_at: string;
}

// --- Network (sections 13-15) ---------------------------------------------

export interface AdGuardStats {
  numDnsQueries: number;
  numBlockedFiltering: number;
  blockedPercent: number;
  protectionEnabled: boolean;
  topClients: { name: string; count: number }[];
}

export interface NpmProxy {
  id: number;
  domainNames: string[];
  enabled: boolean;
  forwardHost: string;
  forwardPort: number;
  certificateId: number | null;
}

export interface NpmCertificate {
  id: number;
  niceName: string;
  domainNames: string[];
  expiresAt: string | null;
  provider: string;
}

export interface WireguardPeer {
  id: string;
  name: string;
  enabled: boolean;
  connected: boolean;
  lastHandshakeAt: string | null;
  transferRxBytes: number;
  transferTxBytes: number;
}

// --- Frigate (section 17) --------------------------------------------------

export interface FrigateCamera {
  name: string;
  online: boolean;
  detectionFps: number | null;
}

export interface FrigateEvent {
  id: string;
  camera: string;
  label: string;
  startTime: string;
  hasClip: boolean;
  hasSnapshot: boolean;
}

export interface FrigateStatus {
  available: boolean;
  cameras: FrigateCamera[];
  events: FrigateEvent[];
  cpuPercent: number | null;
  storageUsedBytes: number | null;
}

// --- Updates (section 39) --------------------------------------------------

export interface ContainerUpdateInfo {
  containerId: string;
  containerName: string;
  image: string;
  updateAvailable: boolean | null; // null = could not be determined
  checkedAt: string;
}

// --- Automation rules (section 44) -----------------------------------------

export type TriggerKind = "service_down" | "host_down";

export interface AutomationRule {
  id: string;
  name: string;
  trigger_kind: TriggerKind;
  trigger_target: string;
  trigger_minutes: number;
  action_key: string;
  action_target: string;
  cooldown_minutes: number;
  enabled: number;
  last_triggered_at: string | null;
  created_at: string;
}

// --- Notification channels (section 25) -------------------------------------

export type NotificationKind = "discord" | "homeassistant";

// --- Uptime Kuma (section 37) -----------------------------------------------

export interface UptimeKumaMonitor {
  name: string;
  up: boolean;
  responseTimeMs: number | null;
}

export interface NotificationChannel {
  id: string;
  kind: NotificationKind;
  target: string;
  min_severity: "info" | "warning" | "critical";
  enabled: number;
  created_at: string;
}

// --- Anomaly detection (section 44) -----------------------------------------

export interface AnomalyInfo {
  hostId: string;
  hostName: string;
  metric: "cpu" | "ram";
  metricLabel: string;
  current: number;
  baselineMean: number;
  baselineStdDev: number;
  zScore: number;
  detectedAt: string;
}
