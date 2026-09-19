import { env } from "../config/env.js";

// Targets the wg-easy REST API (see env.ts for why: it's the most common
// self-hosted WireGuard UI with a documented HTTP API; plain wg-quick has
// none, so those setups show "not configured" here).

let lastError: string | null = null;
let sessionCookie: string | null = null;

export function wireguardAvailable(): boolean {
  return env.wireguard.enabled && !!env.wireguard.baseUrl;
}

export function wireguardLastError(): string | null {
  return lastError;
}

async function login(): Promise<void> {
  const res = await fetch(new URL("/api/session", env.wireguard.baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: env.wireguard.password }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`wireguard login http ${res.status}`);
  // "" (no Set-Cookie header) is a valid outcome, distinct from null
  // ("no session established yet") - using ?? "" here would make listPeers'
  // `if (!sessionCookie)` check re-login on every single call.
  sessionCookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
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

export async function listPeers(): Promise<WireguardPeer[]> {
  if (!wireguardAvailable()) return [];
  try {
    if (sessionCookie === null) await login();
    let res = await fetch(new URL("/api/wireguard/client", env.wireguard.baseUrl), {
      headers: sessionCookie ? { Cookie: sessionCookie } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401) {
      await login();
      res = await fetch(new URL("/api/wireguard/client", env.wireguard.baseUrl), {
        headers: sessionCookie ? { Cookie: sessionCookie } : {},
        signal: AbortSignal.timeout(5000),
      });
    }
    if (!res.ok) throw new Error(`wireguard http ${res.status}`);
    const data = (await res.json()) as any[];
    lastError = null;
    const now = Date.now();
    return data.map((c) => ({
      id: c.id,
      name: c.name,
      enabled: !!c.enabled,
      connected: c.latestHandshakeAt ? now - new Date(c.latestHandshakeAt).getTime() < 3 * 60_000 : false,
      lastHandshakeAt: c.latestHandshakeAt ?? null,
      transferRxBytes: c.transferRx ?? 0,
      transferTxBytes: c.transferTx ?? 0,
    }));
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}
