import { useHost, useHomeAssistantRestart, useHomeAssistantEntitiesSummary, useZigbeeDeviceCount } from "../api/hooks";
import { ServiceCard } from "../components/ServiceCard";
import { OpenLinkButton } from "../components/OpenLinkButton";
import { ActionButton } from "../components/ActionButton";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";

const DOMOTIQUE_IDS = ["home-assistant", "mosquitto", "zigbee2mqtt", "matterbridge"];

export function HomeAssistant() {
  const { data } = useHost("rpi");
  const restart = useHomeAssistantRestart();
  const { data: entitiesData } = useHomeAssistantEntitiesSummary();
  const { data: zigbeeData } = useZigbeeDeviceCount();
  const services = (data?.services ?? []).filter((s) => DOMOTIQUE_IDS.includes(s.id));

  const summary = entitiesData?.summary;

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Home Assistant</div>
          <div className="page__subtitle">État de l’écosystème domotique — Raspberry Pi</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <OpenLinkButton linkKey="homeassistant" label="Ouvrir Home Assistant" />
          <ActionButton
            label="Redémarrer Home Assistant"
            level={2}
            confirmBody="Toutes les automatisations et le tableau de bord seront brièvement indisponibles."
            onRun={() => restart.mutateAsync()}
          />
        </div>
      </div>

      {services.length === 0 ? (
        <EmptyState title="La pile domotique ne remonte aucune donnée" description="Configurez HOMEASSISTANT_URL et HOMEASSISTANT_TOKEN dans le fichier .env du serveur." />
      ) : (
        <div className="grid grid--services">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}

      {entitiesData?.available === false ? (
        <EmptyState title="Santé des entités indisponible" description="Configurez HOMEASSISTANT_URL et HOMEASSISTANT_TOKEN pour voir le nombre d’entités et d’appareils Zigbee." />
      ) : summary ? (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>Santé des entités</div>
          <div className="grid grid--metrics">
            <MetricCard label="Entités au total" value={summary.totalEntities.toLocaleString()} />
            <MetricCard
              label="Indisponibles"
              value={summary.unavailableCount.toLocaleString()}
              tone={summary.unavailableCount > 0 ? "warn" : undefined}
            />
            <MetricCard
              label="Appareils Zigbee"
              value={zigbeeData?.available && zigbeeData.count !== null ? String(zigbeeData.count) : "—"}
            />
          </div>
          {summary.unavailableEntities.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="section-title" style={{ marginBottom: 8 }}>Entités indisponibles</div>
              <div className="row-list">
                {summary.unavailableEntities.map((e) => (
                  <div className="row" key={e.entityId}>
                    <span className="row__primary">{e.friendlyName}</span>
                    <span className="mono text-tertiary">{e.entityId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
