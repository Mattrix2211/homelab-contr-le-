import { Agent, fetch as undiciFetch } from "undici";
import { env } from "../config/env.js";

let lastError: string | null = null;

export function proxmoxAvailable(): boolean {
  return env.proxmox.enabled && !!env.proxmox.baseUrl && !!env.proxmox.tokenId;
}

export function proxmoxLastError(): string | null {
  return lastError;
}

const agent = new Agent({
  connect: { rejectUnauthorized: !env.proxmox.insecureTls },
});

async function pve<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const url = new URL(path, env.proxmox.baseUrl);
  const res = await undiciFetch(url, {
    method: init?.method ?? "GET",
    dispatcher: agent,
    headers: {
      Authorization: `PVEAPIToken=${env.proxmox.tokenId}=${env.proxmox.tokenSecret}`,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`proxmox http ${res.status}`);
  }
  const json = (await res.json()) as any;
  return json.data as T;
}

export interface ProxmoxNodeStatus {
  status: string;
  uptime: number;
  cpu: number;
  memory: { used: number; total: number };
  rootfs: { used: number; total: number };
}

export async function getNodeStatus(): Promise<ProxmoxNodeStatus | null> {
  if (!proxmoxAvailable()) return null;
  try {
    const data = await pve<any>(`/api2/json/nodes/${env.proxmox.node}/status`);
    lastError = null;
    return {
      status: "online",
      uptime: data.uptime,
      cpu: data.cpu * 100,
      memory: { used: data.memory.used, total: data.memory.total },
      rootfs: { used: data.rootfs.used, total: data.rootfs.total },
    };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return null;
  }
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

export async function listGuests(): Promise<ProxmoxGuest[]> {
  if (!proxmoxAvailable()) return [];
  try {
    const [vms, lxcs] = await Promise.all([
      pve<any[]>(`/api2/json/nodes/${env.proxmox.node}/qemu`),
      pve<any[]>(`/api2/json/nodes/${env.proxmox.node}/lxc`),
    ]);
    lastError = null;
    const map = (items: any[], type: "qemu" | "lxc"): ProxmoxGuest[] =>
      items.map((g) => ({
        vmid: g.vmid,
        name: g.name,
        type,
        status: g.status,
        cpu: (g.cpu ?? 0) * 100,
        mem: g.mem ?? 0,
        maxmem: g.maxmem ?? 0,
        disk: g.disk ?? 0,
        maxdisk: g.maxdisk ?? 0,
        uptime: g.uptime ?? 0,
      }));
    return [...map(vms, "qemu"), ...map(lxcs, "lxc")];
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}

export type GuestAction = "start" | "shutdown" | "stop" | "reboot";

export async function performGuestAction(
  type: "qemu" | "lxc",
  vmid: number,
  action: GuestAction
): Promise<void> {
  if (!proxmoxAvailable()) throw new Error("proxmox_unavailable");
  await pve(`/api2/json/nodes/${env.proxmox.node}/${type}/${vmid}/status/${action}`, {
    method: "POST",
  });
}

export async function recentTasks(limit = 20) {
  if (!proxmoxAvailable()) return [];
  try {
    const data = await pve<any[]>(
      `/api2/json/nodes/${env.proxmox.node}/tasks?limit=${limit}`
    );
    lastError = null;
    return data;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}
