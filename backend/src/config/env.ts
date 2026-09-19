import "dotenv/config";

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: num(process.env.PORT, 4000),
  dbPath: process.env.DB_PATH ?? "/data/homelab.db",

  jwtSecret: process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
  sessionTtlHours: num(process.env.SESSION_TTL_HOURS, 12),
  // Session cookie "Secure" flag. Browsers drop Secure cookies over plain HTTP,
  // so leave false for http://<lan-ip> and set true behind HTTPS.
  cookieSecure: bool(process.env.COOKIE_SECURE, false),

  adminEmail: process.env.ADMIN_EMAIL ?? "admin@homelab.local",
  adminPassword: process.env.ADMIN_PASSWORD ?? "changeme",

  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  // Integrations - all optional, cockpit degrades gracefully when unset.
  docker: {
    enabled: bool(process.env.DOCKER_ENABLED, true),
    socketPath: process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock",
  },
  prometheus: {
    enabled: bool(process.env.PROMETHEUS_ENABLED, false),
    baseUrl: process.env.PROMETHEUS_URL ?? "",
  },
  proxmox: {
    enabled: bool(process.env.PROXMOX_ENABLED, false),
    baseUrl: process.env.PROXMOX_URL ?? "",
    tokenId: process.env.PROXMOX_TOKEN_ID ?? "",
    tokenSecret: process.env.PROXMOX_TOKEN_SECRET ?? "",
    node: process.env.PROXMOX_NODE ?? "m83",
    insecureTls: bool(process.env.PROXMOX_INSECURE_TLS, true),
  },
  homeassistant: {
    enabled: bool(process.env.HOMEASSISTANT_ENABLED, false),
    baseUrl: process.env.HOMEASSISTANT_URL ?? "",
    token: process.env.HOMEASSISTANT_TOKEN ?? "",
  },
  truenas: {
    enabled: bool(process.env.TRUENAS_ENABLED, false),
    baseUrl: process.env.TRUENAS_URL ?? "",
    apiKey: process.env.TRUENAS_API_KEY ?? "",
  },
  // Reads Uptime Kuma's built-in Prometheus /metrics endpoint (Settings >
  // API Keys, then enable "Show Prometheus metrics"), not the websocket
  // dashboard API - the metrics endpoint is the only stable, documented,
  // key-authenticated read path Uptime Kuma exposes.
  uptimeKuma: {
    enabled: bool(process.env.UPTIME_KUMA_ENABLED, false),
    baseUrl: process.env.UPTIME_KUMA_URL ?? "",
    apiKey: process.env.UPTIME_KUMA_API_KEY ?? "",
  },
  adguard: {
    enabled: bool(process.env.ADGUARD_ENABLED, false),
    baseUrl: process.env.ADGUARD_URL ?? "",
    username: process.env.ADGUARD_USERNAME ?? "",
    password: process.env.ADGUARD_PASSWORD ?? "",
  },
  npm: {
    enabled: bool(process.env.NPM_ENABLED, false),
    baseUrl: process.env.NPM_URL ?? "",
    identity: process.env.NPM_IDENTITY ?? "",
    secret: process.env.NPM_SECRET ?? "",
  },
  // Targets the wg-easy REST API (the most common self-hosted WireGuard UI
  // with a documented HTTP API). Plain wg-quick setups have no REST API
  // and are not supported here - the host stays "not configured".
  wireguard: {
    enabled: bool(process.env.WIREGUARD_ENABLED, false),
    baseUrl: process.env.WIREGUARD_URL ?? "",
    password: process.env.WIREGUARD_PASSWORD ?? "",
  },
  frigate: {
    enabled: bool(process.env.FRIGATE_ENABLED, false),
    baseUrl: process.env.FRIGATE_URL ?? "",
  },
  zigbee2mqtt: {
    enabled: bool(process.env.ZIGBEE2MQTT_ENABLED, false),
    baseUrl: process.env.ZIGBEE2MQTT_URL ?? "",
  },
  updates: {
    enabled: bool(process.env.UPDATE_CHECK_ENABLED, true),
    intervalMinutes: num(process.env.UPDATE_CHECK_INTERVAL_MINUTES, 60),
  },

  // Statistical anomaly detection on CPU/RAM (per-host node_exporter
  // metrics via Prometheus): baseline mean/stddev over a lookback window,
  // flag when the current value is `zThreshold` standard deviations away.
  // Depends on Prometheus being enabled; independently toggleable so it can
  // be turned off even when Prometheus is used only for the Monitoring
  // page's manual charts.
  anomaly: {
    enabled: bool(process.env.ANOMALY_DETECTION_ENABLED, true),
    intervalMinutes: num(process.env.ANOMALY_CHECK_INTERVAL_MINUTES, 30),
    lookbackDays: num(process.env.ANOMALY_LOOKBACK_DAYS, 14),
    zThreshold: num(process.env.ANOMALY_Z_THRESHOLD, 3),
    // Below this many hourly samples, the baseline is too thin to trust -
    // skip rather than flag on a nearly-empty history.
    minSamples: num(process.env.ANOMALY_MIN_SAMPLES, 48),
    // Below this stddev (percentage points), a metric is essentially flat -
    // skip rather than flag on noise from a near-zero denominator.
    minStdDev: num(process.env.ANOMALY_MIN_STDDEV, 3),
  },

  // Non-secret "open native UI" links (section 45). Safe to expose to the
  // frontend as-is - these are addresses, never credentials.
  links: {
    proxmox: process.env.LINK_PROXMOX_URL ?? "",
    truenas: process.env.LINK_TRUENAS_URL ?? "",
    grafana: process.env.LINK_GRAFANA_URL ?? "",
    adguard: process.env.LINK_ADGUARD_URL ?? "",
    npm: process.env.LINK_NPM_URL ?? "",
    portainer: process.env.LINK_PORTAINER_URL ?? "",
    homeassistant: process.env.LINK_HOMEASSISTANT_URL ?? "",
    frigate: process.env.LINK_FRIGATE_URL ?? "",
    uptimeKuma: process.env.LINK_UPTIME_KUMA_URL ?? "",
  },
};
