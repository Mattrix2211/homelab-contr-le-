import type { Role, UserRow, SessionRow } from "./db/repo.js";

export type { Role };

export interface AuthContext {
  user: Pick<UserRow, "id" | "email" | "role" | "display_name">;
  session: SessionRow;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export type Status = "online" | "degraded" | "warning" | "offline" | "unknown";

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
  dataAge?: number; // ms since last successful sync, if stale
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
  externalUrl?: string;
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
