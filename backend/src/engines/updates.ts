import { env } from "../config/env.js";
import { getSnapshot } from "./monitoring.js";
import { getLocalImageDigest } from "../integrations/docker.js";
import { getRemoteDigest, parseImageRef } from "../integrations/dockerRegistry.js";

export interface ContainerUpdateInfo {
  containerId: string;
  containerName: string;
  image: string;
  updateAvailable: boolean | null; // null = could not be determined (non-Docker-Hub image, network error, ...)
  checkedAt: string;
}

let cache: ContainerUpdateInfo[] = [];
let checkedAt: string | null = null;

export function getUpdatesCache(): { updates: ContainerUpdateInfo[]; checkedAt: string | null } {
  return { updates: cache, checkedAt };
}

async function checkOne(containerId: string, containerName: string, image: string): Promise<ContainerUpdateInfo> {
  const parsed = parseImageRef(image);
  if (!parsed.isDockerHub) {
    return { containerId, containerName, image, updateAvailable: null, checkedAt: new Date().toISOString() };
  }
  const [remoteDigest, localDigest] = await Promise.all([
    getRemoteDigest(parsed.repo, parsed.tag),
    getLocalImageDigest(image, parsed.repo),
  ]);
  const updateAvailable = remoteDigest && localDigest ? remoteDigest !== localDigest : null;
  return { containerId, containerName, image, updateAvailable, checkedAt: new Date().toISOString() };
}

export async function refreshUpdatesCache(): Promise<void> {
  const containers = getSnapshot().containers.filter((c) => c.state === "running");
  const results = await Promise.all(containers.map((c) => checkOne(c.id, c.name, c.image)));
  cache = results;
  checkedAt = new Date().toISOString();
}

export function startUpdatesLoop(): NodeJS.Timeout | null {
  if (!env.updates.enabled) return null;
  const intervalMs = env.updates.intervalMinutes * 60_000;
  const tick = () => {
    refreshUpdatesCache().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[updates] refresh failed", err);
    });
  };
  // First check shortly after boot, once the monitoring snapshot has data.
  setTimeout(tick, 15_000);
  return setInterval(tick, intervalMs);
}
