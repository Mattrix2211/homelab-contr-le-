import { useServices } from "../api/hooks";
import { ServiceCard } from "../components/ServiceCard";
import { OpenLinkButton } from "../components/OpenLinkButton";
import { EmptyState } from "../components/EmptyState";

const NETWORK_SERVICE_IDS = ["adguard", "npm"];

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

      <div className="placeholder-panel">
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 8 }}>
          DNS query stats, certificate expiry and WireGuard peers — Phase 2
        </div>
        <p className="text-secondary" style={{ maxWidth: 520, margin: "0 auto" }}>
          Sections 13-15 (AdGuard query/block rates, Nginx Proxy Manager certificate expiry, WireGuard peer
          status) require their respective APIs. The cockpit currently shows live online/offline status only.
        </p>
      </div>
    </div>
  );
}
