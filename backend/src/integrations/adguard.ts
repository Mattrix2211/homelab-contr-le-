import { env } from "../config/env.js";

let lastError: string | null = null;
let sessionCookie: string | null = null;

export function adguardAvailable(): boolean {
  return env.adguard.enabled && !!env.adguard.baseUrl;
}

export function adguardLastError(): string | null {
  return lastError;
}

async function login(): Promise<void> {
  if (!env.adguard.username) {
    // Some AdGuard Home installs run without auth configured.
    sessionCookie = "";
    return;
  }
  const res = await fetch(new URL("/control/login", env.adguard.baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: env.adguard.username, password: env.adguard.password }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`adguard login http ${res.status}`);
  const setCookie = res.headers.get("set-cookie");
  sessionCookie = setCookie?.split(";")[0] ?? "";
}

async function ag<T = any>(path: string, init?: { method?: string; body?: unknown }, retry = true): Promise<T> {
  if (sessionCookie === null) await login();
  const res = await fetch(new URL(path, env.adguard.baseUrl), {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 403 && retry) {
    sessionCookie = null;
    return ag<T>(path, init, false);
  }
  if (!res.ok) throw new Error(`adguard http ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface AdGuardStats {
  numDnsQueries: number;
  numBlockedFiltering: number;
  blockedPercent: number;
  protectionEnabled: boolean;
  topClients: { name: string; count: number }[];
}

export async function getStats(): Promise<AdGuardStats | null> {
  if (!adguardAvailable()) return null;
  try {
    const [stats, status] = await Promise.all([ag<any>("/control/stats"), ag<any>("/control/status")]);
    lastError = null;
    const topClients = (stats.top_clients ?? []).slice(0, 5).map((entry: Record<string, number>) => {
      const [name, count] = Object.entries(entry)[0] ?? ["unknown", 0];
      return { name, count };
    });
    return {
      numDnsQueries: stats.num_dns_queries ?? 0,
      numBlockedFiltering: stats.num_blocked_filtering ?? 0,
      blockedPercent: stats.num_dns_queries ? (stats.num_blocked_filtering / stats.num_dns_queries) * 100 : 0,
      protectionEnabled: !!status.protection_enabled,
      topClients,
    };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return null;
  }
}

export async function setProtection(enabled: boolean): Promise<void> {
  if (!adguardAvailable()) throw new Error("adguard_unavailable");
  await ag("/control/protection", { method: "POST", body: { enabled, duration: 0 } });
}
