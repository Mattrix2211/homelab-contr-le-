import { env } from "../config/env.js";

let lastError: string | null = null;
let token: string | null = null;
let tokenExpiresAt = 0;

export function npmAvailable(): boolean {
  return env.npm.enabled && !!env.npm.baseUrl && !!env.npm.identity;
}

export function npmLastError(): string | null {
  return lastError;
}

async function ensureToken(): Promise<void> {
  if (token && Date.now() < tokenExpiresAt) return;
  const res = await fetch(new URL("/api/tokens", env.npm.baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: env.npm.identity, secret: env.npm.secret }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`npm login http ${res.status}`);
  const data = (await res.json()) as { token: string; expires: string };
  token = data.token;
  tokenExpiresAt = new Date(data.expires).getTime() - 60_000;
}

async function npm<T = any>(path: string): Promise<T> {
  await ensureToken();
  const res = await fetch(new URL(path, env.npm.baseUrl), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`npm http ${res.status}`);
  return (await res.json()) as T;
}

export interface NpmProxy {
  id: number;
  domainNames: string[];
  enabled: boolean;
  forwardHost: string;
  forwardPort: number;
  certificateId: number | null;
}

export async function listProxies(): Promise<NpmProxy[]> {
  if (!npmAvailable()) return [];
  try {
    const data = await npm<any[]>("/api/nginx/proxy-hosts");
    lastError = null;
    return data.map((p) => ({
      id: p.id,
      domainNames: p.domain_names ?? [],
      enabled: !!p.enabled,
      forwardHost: p.forward_host,
      forwardPort: p.forward_port,
      certificateId: p.certificate_id > 0 ? p.certificate_id : null,
    }));
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}

export interface NpmCertificate {
  id: number;
  niceName: string;
  domainNames: string[];
  expiresAt: string | null;
  provider: string;
}

export async function listCertificates(): Promise<NpmCertificate[]> {
  if (!npmAvailable()) return [];
  try {
    const data = await npm<any[]>("/api/nginx/certificates");
    lastError = null;
    return data.map((c) => ({
      id: c.id,
      niceName: c.nice_name,
      domainNames: c.domain_names ?? [],
      expiresAt: c.expires_on ?? null,
      provider: c.provider,
    }));
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return [];
  }
}
