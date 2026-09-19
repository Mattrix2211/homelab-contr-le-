import Dockerode from "dockerode";
import { env } from "../config/env.js";
import type { ContainerInfo, Status } from "../types.js";

let docker: Dockerode | null = null;
let lastError: string | null = null;

if (env.docker.enabled) {
  try {
    docker = new Dockerode({ socketPath: env.docker.socketPath });
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }
}

export function dockerAvailable(): boolean {
  return docker !== null;
}

export function dockerLastError(): string | null {
  return lastError;
}

function mapState(state: string, health?: string): Status {
  if (health === "unhealthy") return "degraded";
  if (state === "running") return health === "starting" ? "warning" : "online";
  if (state === "paused") return "warning";
  if (state === "exited" || state === "dead") return "offline";
  return "unknown";
}

export async function listContainers(): Promise<ContainerInfo[]> {
  if (!docker) return [];
  try {
    const containers = await docker.listContainers({ all: true });
    const results = await Promise.all(
      containers.map(async (c) => {
        let cpuPercent: number | undefined;
        let ramMb: number | undefined;
        let ramLimitMb: number | undefined;
        try {
          const container = docker!.getContainer(c.Id);
          const stats = await container.stats({ stream: false });
          const cpuDelta =
            stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage ?? 0);
          const systemDelta =
            stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage ?? 0);
          const cpuCount = stats.cpu_stats.online_cpus || 1;
          if (systemDelta > 0 && cpuDelta > 0) {
            cpuPercent = (cpuDelta / systemDelta) * cpuCount * 100;
          }
          if (stats.memory_stats?.usage) {
            ramMb = stats.memory_stats.usage / 1024 / 1024;
            ramLimitMb = stats.memory_stats.limit / 1024 / 1024;
          }
        } catch {
          // container might not support stats right now; skip silently
        }

        const health = (c as any).Status?.includes("(healthy)")
          ? "healthy"
          : (c as any).Status?.includes("(unhealthy)")
            ? "unhealthy"
            : undefined;

        return {
          id: c.Id.slice(0, 12),
          name: c.Names[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12),
          image: c.Image,
          status: mapState(c.State, health),
          state: c.State,
          health,
          uptimeSeconds:
            c.State === "running" ? Math.max(0, Math.floor(Date.now() / 1000 - c.Created)) : undefined,
          cpuPercent,
          ramMb,
          ramLimitMb,
          ports: (c.Ports ?? [])
            .filter((p) => p.PublicPort)
            .map((p) => `${p.PublicPort}:${p.PrivatePort}/${p.Type}`),
          createdAt: new Date(c.Created * 1000).toISOString(),
        } satisfies ContainerInfo;
      })
    );
    lastError = null;
    return results;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}

export async function getContainerLogs(id: string, tail = 200): Promise<string> {
  if (!docker) throw new Error("docker_unavailable");
  const container = docker.getContainer(id);
  const [info, buffer] = await Promise.all([
    container.inspect(),
    container.logs({ stdout: true, stderr: true, tail, timestamps: true }) as unknown as Promise<Buffer>,
  ]);

  // Docker only multiplexes stdout/stderr with an 8-byte frame header per
  // chunk when the container was created without a TTY; a Tty:true
  // container's log stream is raw text and demuxing it corrupts the output.
  if (info.Config.Tty) {
    return buffer.toString("utf-8");
  }

  let out = "";
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset + 4);
    const start = offset + 8;
    out += buffer.toString("utf-8", start, start + size);
    offset = start + size;
  }
  return out || buffer.toString("utf-8");
}

export type ContainerAction = "start" | "stop" | "restart" | "pause" | "unpause";

export async function performContainerAction(id: string, action: ContainerAction): Promise<void> {
  if (!docker) throw new Error("docker_unavailable");
  const container = docker.getContainer(id);
  switch (action) {
    case "start":
      return container.start();
    case "stop":
      return container.stop({ t: 10 });
    case "restart":
      return container.restart({ t: 10 });
    case "pause":
      return container.pause();
    case "unpause":
      return container.unpause();
  }
}

export async function inspectContainer(id: string) {
  if (!docker) throw new Error("docker_unavailable");
  return docker.getContainer(id).inspect();
}

// Returns the sha256 digest (e.g. "sha256:abcd...") this locally pulled
// image was fetched as, matched against `repo` (e.g. "library/nginx"), or
// null if the image has no matching RepoDigest (built locally, digest-less
// pull, etc.) - used by the update-check engine.
export async function getLocalImageDigest(imageRef: string, repo: string): Promise<string | null> {
  if (!docker) return null;
  try {
    const image = docker.getImage(imageRef);
    const info = await image.inspect();
    const repoDigests: string[] = info.RepoDigests ?? [];
    // A locally pulled official (unnamespaced) image's RepoDigest is just
    // "<name>@sha256:...", with no "library/" prefix - only a namespaced
    // repo (or one with an explicit registry host, e.g. "docker.io/library/
    // nginx@...") appears in the fuller forms below.
    const baseName = repo.split("/").pop();
    const match = repoDigests.find(
      (d) => d.startsWith(`${repo}@`) || d.startsWith(`${baseName}@`) || d.includes(`/${baseName}@`)
    );
    return match ? match.split("@")[1] : null;
  } catch {
    return null;
  }
}
