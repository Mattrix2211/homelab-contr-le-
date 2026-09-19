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
          <div className="page__subtitle">Domotique ecosystem health — Raspberry Pi</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <OpenLinkButton linkKey="homeassistant" label="Open Home Assistant" />
          <ActionButton
            label="Restart Home Assistant"
            level={2}
            confirmBody="All automations and the dashboard will be briefly unavailable."
            onRun={() => restart.mutateAsync()}
          />
        </div>
      </div>

      {services.length === 0 ? (
        <EmptyState title="Domotique stack not reporting" description="Configure HOMEASSISTANT_URL and HOMEASSISTANT_TOKEN in Administration." />
      ) : (
        <div className="grid grid--services">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}

      {entitiesData?.available === false ? (
        <EmptyState title="Entity health not available" description="Configure HOMEASSISTANT_URL and HOMEASSISTANT_TOKEN to see entity/Zigbee counts." />
      ) : summary ? (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>Entity health</div>
          <div className="grid grid--metrics">
            <MetricCard label="Total entities" value={summary.totalEntities.toLocaleString()} />
            <MetricCard
              label="Unavailable"
              value={summary.unavailableCount.toLocaleString()}
              tone={summary.unavailableCount > 0 ? "warn" : undefined}
            />
            <MetricCard
              label="Zigbee devices"
              value={zigbeeData?.available && zigbeeData.count !== null ? String(zigbeeData.count) : "—"}
            />
          </div>
          {summary.unavailableEntities.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="section-title" style={{ marginBottom: 8 }}>Unavailable entities</div>
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
