import { useServices, useAdGuardStats, useToggleAdGuardProtection, useNpmProxies, useNpmCertificates, useWireguardPeers } from "../api/hooks";
import { ServiceCard } from "../components/ServiceCard";
import { OpenLinkButton } from "../components/OpenLinkButton";
import { ActionButton } from "../components/ActionButton";
import { StatusBadge } from "../components/StatusBadge";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { formatBytes, formatPercent, formatRelativeTime } from "../lib/format";

const NETWORK_SERVICE_IDS = ["adguard", "npm"];

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function AdGuardPanel() {
  const { data } = useAdGuardStats();
  const toggle = useToggleAdGuardProtection();

  if (data?.available === false) {
    return <EmptyState title="AdGuard API not configured" description="Set ADGUARD_ENABLED=true and ADGUARD_URL to see query stats." />;
  }
  const stats = data?.stats;
  if (!stats) return <EmptyState title="Loading AdGuard stats…" />;

  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">AdGuard DNS</div>
        <ActionButton
          label={stats.protectionEnabled ? "Disable protection" : "Enable protection"}
          level={2}
          confirmBody="Temporarily changes DNS filtering for the whole network."
          onRun={() => toggle.mutateAsync(!stats.protectionEnabled)}
        />
      </div>
      <div className="grid grid--metrics">
        <MetricCard label="DNS queries" value={stats.numDnsQueries.toLocaleString()} />
        <MetricCard label="Blocked" value={stats.numBlockedFiltering.toLocaleString()} />
        <MetricCard label="Block rate" value={formatPercent(stats.blockedPercent)} />
        <MetricCard label="Protection" value={stats.protectionEnabled ? "ON" : "OFF"} tone={stats.protectionEnabled ? undefined : "warn"} />
      </div>
      {stats.topClients.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Top clients</div>
          <div className="row-list">
            {stats.topClients.map((c) => (
              <div className="row" key={c.name}>
                <span className="row__primary mono">{c.name}</span>
                <span className="mono text-tertiary">{c.count.toLocaleString()} queries</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NpmPanel() {
  const { data: proxiesData } = useNpmProxies();
  const { data: certsData } = useNpmCertificates();

  if (proxiesData?.available === false) {
    return <EmptyState title="Nginx Proxy Manager API not configured" description="Set NPM_ENABLED=true, NPM_URL, NPM_IDENTITY and NPM_SECRET." />;
  }

  const proxies = proxiesData?.proxies ?? [];
  const certs = certsData?.certificates ?? [];

  return (
    <div className="card">
      <div className="section-title" style={{ marginBottom: 12 }}>Nginx Proxy Manager</div>
      {proxies.length === 0 ? (
        <EmptyState title="No proxy hosts" />
      ) : (
        <div className="row-list">
          {proxies.map((p) => (
            <div className="row" key={p.id}>
              <span className="row__primary mono">{p.domainNames.join(", ")}</span>
              <span className="mono text-tertiary">→ {p.forwardHost}:{p.forwardPort}</span>
              <StatusBadge status={p.enabled ? "online" : "offline"} label={p.enabled ? "Enabled" : "Disabled"} />
            </div>
          ))}
        </div>
      )}

      {certs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Certificates</div>
          <div className="row-list">
            {certs.map((c) => {
              const days = daysUntil(c.expiresAt);
              const warn = days !== null && days <= 21;
              return (
                <div className="row" key={c.id}>
                  <span className="row__primary">
                    {c.niceName}
                    <div className="row__secondary mono">{c.domainNames.join(", ")}</div>
                  </span>
                  <span className={`mono ${warn ? "" : "text-tertiary"}`} style={{ color: warn ? "var(--color-amber)" : undefined }}>
                    {days !== null ? `expires in ${days}d` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WireguardPanel() {
  const { data } = useWireguardPeers();
  if (data?.available === false) {
    return <EmptyState title="WireGuard (wg-easy) API not configured" description="Set WIREGUARD_ENABLED=true, WIREGUARD_URL and WIREGUARD_PASSWORD." />;
  }
  const peers = data?.peers ?? [];
  return (
    <div className="card">
      <div className="section-title" style={{ marginBottom: 12 }}>VPN — WireGuard peers</div>
      {peers.length === 0 ? (
        <EmptyState title="No peers configured" />
      ) : (
        <div className="row-list">
          {peers.map((p) => (
            <div className="row" key={p.id}>
              <span className="row__primary">{p.name}</span>
              <span className="mono text-tertiary" style={{ width: 140 }}>
                {p.lastHandshakeAt ? formatRelativeTime(p.lastHandshakeAt) : "never connected"}
              </span>
              <span className="mono text-tertiary" style={{ width: 140 }}>
                ↓{formatBytes(p.transferRxBytes)} ↑{formatBytes(p.transferTxBytes)}
              </span>
              <StatusBadge status={p.connected ? "online" : "unknown"} label={p.connected ? "Connected" : "Idle"} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Network() {
  const { data } = useServices();
  const services = (data?.services ?? []).filter((s) => NETWORK_SERVICE_IDS.includes(s.id));

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Network</div>
          <div className="page__subtitle">DNS, reverse proxy, VPN and connectivity</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <OpenLinkButton linkKey="adguard" label="Open AdGuard" />
          <OpenLinkButton linkKey="npm" label="Open NPM" />
        </div>
      </div>

      {services.length === 0 ? (
        <EmptyState title="No network services detected" description="Check the Docker integration in Administration." />
      ) : (
        <div className="grid grid--services">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}

      <AdGuardPanel />
      <NpmPanel />
      <WireguardPanel />
    </div>
  );
}
