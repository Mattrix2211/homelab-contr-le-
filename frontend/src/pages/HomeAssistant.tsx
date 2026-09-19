import { useHost, useHomeAssistantRestart } from "../api/hooks";
import { ServiceCard } from "../components/ServiceCard";
import { OpenLinkButton } from "../components/OpenLinkButton";
import { ActionButton } from "../components/ActionButton";
import { EmptyState } from "../components/EmptyState";

const DOMOTIQUE_IDS = ["home-assistant", "mosquitto", "zigbee2mqtt", "matterbridge"];

export function HomeAssistant() {
  const { data } = useHost("rpi");
  const restart = useHomeAssistantRestart();
  const services = (data?.services ?? []).filter((s) => DOMOTIQUE_IDS.includes(s.id));

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
            onRun={() => restart.mutateAsync().then(() => {})}
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

      <div className="placeholder-panel">
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 8 }}>
          Entity health, Zigbee/Matter device counts — Phase 2
        </div>
        <p className="text-secondary" style={{ maxWidth: 520, margin: "0 auto" }}>
          The cockpit intentionally stays a technical health view (section 16) — it will never become a second
          domotique dashboard. Unavailable entities and MQTT/Zigbee2MQTT device counts land here in Phase 2.
        </p>
      </div>
    </div>
  );
}
