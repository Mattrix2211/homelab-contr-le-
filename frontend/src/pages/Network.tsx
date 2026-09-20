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
    return <EmptyState title="API AdGuard non configurée" description="Définissez ADGUARD_ENABLED=true et ADGUARD_URL pour voir les statistiques de requêtes." />;
  }
  const stats = data?.stats;
  if (!stats) return <EmptyState title="Chargement des statistiques AdGuard…" />;

  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">AdGuard DNS</div>
        <ActionButton
          label={stats.protectionEnabled ? "Désactiver la protection" : "Activer la protection"}
          level={2}
          confirmBody="Modifie temporairement le filtrage DNS pour tout le réseau."
          onRun={() => toggle.mutateAsync(!stats.protectionEnabled)}
        />
      </div>
      <div className="grid grid--metrics">
        <MetricCard label="Requêtes DNS" value={stats.numDnsQueries.toLocaleString()} />
        <MetricCard label="Bloquées" value={stats.numBlockedFiltering.toLocaleString()} />
        <MetricCard label="Taux de blocage" value={formatPercent(stats.blockedPercent)} />
        <MetricCard label="Protection" value={stats.protectionEnabled ? "ACTIVE" : "INACTIVE"} tone={stats.protectionEnabled ? undefined : "warn"} />
      </div>
      {stats.topClients.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Clients les plus actifs</div>
          <div className="row-list">
            {stats.topClients.map((c) => (
              <div className="row" key={c.name}>
                <span className="row__primary mono">{c.name}</span>
                <span className="mono text-tertiary">{c.count.toLocaleString()} requêtes</span>
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
    return <EmptyState title="API Nginx Proxy Manager non configurée" description="Définissez NPM_ENABLED=true, NPM_URL, NPM_IDENTITY et NPM_SECRET." />;
  }

  const proxies = proxiesData?.proxies ?? [];
  const certs = certsData?.certificates ?? [];

  return (
    <div className="card">
      <div className="section-title" style={{ marginBottom: 12 }}>Nginx Proxy Manager</div>
      {proxies.length === 0 ? (
        <EmptyState title="Aucun hôte proxy" />
      ) : (
        <div className="row-list">
          {proxies.map((p) => (
            <div className="row" key={p.id}>
              <span className="row__primary mono">{p.domainNames.join(", ")}</span>
              <span className="mono text-tertiary">→ {p.forwardHost}:{p.forwardPort}</span>
              <StatusBadge status={p.enabled ? "online" : "offline"} label={p.enabled ? "Activé" : "Désactivé"} />
            </div>
          ))}
        </div>
      )}

      {certs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Certificats</div>
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
                    {days !== null ? `expire dans ${days} j` : "—"}
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
    return <EmptyState title="API WireGuard (wg-easy) non configurée" description="Définissez WIREGUARD_ENABLED=true, WIREGUARD_URL et WIREGUARD_PASSWORD." />;
  }
  const peers = data?.peers ?? [];
  return (
    <div className="card">
      <div className="section-title" style={{ marginBottom: 12 }}>VPN — pairs WireGuard</div>
      {peers.length === 0 ? (
        <EmptyState title="Aucun pair configuré" />
      ) : (
        <div className="row-list">
          {peers.map((p) => (
            <div className="row" key={p.id}>
              <span className="row__primary">{p.name}</span>
              <span className="mono text-tertiary" style={{ width: 140 }}>
                {p.lastHandshakeAt ? formatRelativeTime(p.lastHandshakeAt) : "jamais connecté"}
              </span>
              <span className="mono text-tertiary" style={{ width: 140 }}>
                ↓{formatBytes(p.transferRxBytes)} ↑{formatBytes(p.transferTxBytes)}
              </span>
              <StatusBadge status={p.connected ? "online" : "unknown"} label={p.connected ? "Connecté" : "Inactif"} />
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
          <div className="page__title">Réseau</div>
          <div className="page__subtitle">DNS, reverse proxy, VPN et connectivité</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <OpenLinkButton linkKey="adguard" label="Ouvrir AdGuard" />
          <OpenLinkButton linkKey="npm" label="Ouvrir NPM" />
        </div>
      </div>

      {services.length === 0 ? (
        <EmptyState title="Aucun service réseau détecté" description="Vérifiez l’intégration Docker (voir Administration)." />
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
