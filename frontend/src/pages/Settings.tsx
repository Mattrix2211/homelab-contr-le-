import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCockpitLayout, useHosts, useServices, useSetCockpitLayout } from "../api/hooks";
import {
  DEFAULT_CRITICAL_SERVICE_IDS,
  DEFAULT_DISPLAY_SETTINGS,
  useDisplaySettings,
  useOrderedSections,
  useSetDisplaySettings,
  type DisplaySettings,
} from "../lib/displaySettings";
import { formatCategory } from "../lib/format";
import { useToast } from "../store/toast";

// Every change is saved immediately (no Save button) and applies to the
// signed-in user only; nothing here touches the backend configuration.

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="section-title" style={{ marginBottom: hint ? 4 : 12 }}>{title}</div>
      {hint && <p className="text-tertiary" style={{ fontSize: 12, marginBottom: 12 }}>{hint}</p>}
      {children}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  sub,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  sub?: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="row">
      <label className="row__primary" style={{ display: "flex", alignItems: "center", gap: 10, cursor: disabled ? "default" : "pointer" }}>
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
        <span>
          {label}
          {sub && <div className="row__secondary">{sub}</div>}
        </span>
      </label>
      {children}
    </div>
  );
}

const numberInputStyle = {
  background: "var(--color-background)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "6px 10px",
  color: "var(--color-text-primary)",
  width: 90,
} as const;

export function Settings() {
  const { push } = useToast();
  const settings = useDisplaySettings();
  const setSettings = useSetDisplaySettings();
  const { isLoading: layoutLoading } = useCockpitLayout();
  const sections = useOrderedSections();
  const setLayout = useSetCockpitLayout();
  const { data: hostsData } = useHosts();
  const { data: servicesData } = useServices();

  const hosts = hostsData?.hosts ?? [];
  const services = servicesData?.services ?? [];
  const criticalIds = settings.criticalServiceIds ?? DEFAULT_CRITICAL_SERVICE_IDS;

  const [loadWarn, setLoadWarn] = useState<number | null>(null);
  const [loadCrit, setLoadCrit] = useState<number | null>(null);
  const warnValue = loadWarn ?? settings.loadWarn;
  const critValue = loadCrit ?? settings.loadCrit;
  const thresholdsValid =
    Number.isInteger(warnValue) && Number.isInteger(critValue) && warnValue >= 1 && critValue <= 100 && warnValue < critValue;
  const thresholdsDirty = warnValue !== settings.loadWarn || critValue !== settings.loadCrit;

  async function saveSettings(next: DisplaySettings) {
    try {
      await setSettings.mutateAsync(next);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Enregistrement impossible");
    }
  }

  async function saveLayout(next: { id: string; visible: boolean }[]) {
    try {
      await setLayout.mutateAsync(next);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Enregistrement impossible");
    }
  }

  function moveSection(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    saveLayout(next.map((s) => ({ id: s.id, visible: s.visible })));
  }

  function toggleSection(index: number) {
    saveLayout(sections.map((s, i) => ({ id: s.id, visible: i === index ? !s.visible : s.visible })));
  }

  function toggleService(id: string) {
    const next = criticalIds.includes(id) ? criticalIds.filter((x) => x !== id) : [...criticalIds, id];
    saveSettings({ ...settings, criticalServiceIds: next });
  }

  function toggleHost(id: string) {
    const hidden = settings.hiddenHostIds.includes(id);
    saveSettings({
      ...settings,
      hiddenHostIds: hidden ? settings.hiddenHostIds.filter((x) => x !== id) : [...settings.hiddenHostIds, id],
    });
  }

  async function saveThresholds() {
    if (!thresholdsValid) return;
    await saveSettings({ ...settings, loadWarn: warnValue, loadCrit: critValue });
    setLoadWarn(null);
    setLoadCrit(null);
  }

  async function resetAll() {
    await saveSettings(DEFAULT_DISPLAY_SETTINGS);
    await saveLayout(sections.map((s) => ({ id: s.id, visible: true })));
    setLoadWarn(null);
    setLoadCrit(null);
    push("success", "Réglages d’affichage réinitialisés");
  }

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Paramètres</div>
          <div className="page__subtitle">Choisissez ce que le Cockpit affiche. Les changements sont enregistrés tout de suite et ne concernent que votre compte.</div>
        </div>
        <button className="btn btn--sm btn--ghost" onClick={resetAll}>Tout réinitialiser</button>
      </div>

      <Panel title="Sections du Cockpit" hint="Affichez, masquez et réordonnez les blocs de la page d’accueil.">
        <div className="row-list">
          {sections.map((s, i) => (
            <CheckRow key={s.id} checked={s.visible} onChange={() => toggleSection(i)} label={s.label} disabled={layoutLoading}>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn--sm btn--ghost" onClick={() => moveSection(i, -1)} disabled={layoutLoading || i === 0} aria-label="Monter">↑</button>
                <button className="btn btn--sm btn--ghost" onClick={() => moveSection(i, 1)} disabled={layoutLoading || i === sections.length - 1} aria-label="Descendre">↓</button>
              </div>
            </CheckRow>
          ))}
        </div>
      </Panel>

      <Panel title="Machines affichées" hint="Décochez une machine pour la retirer du Cockpit (elle reste supervisée et alertée).">
        <div className="row-list">
          {hosts.map((h) => (
            <CheckRow key={h.id} checked={!settings.hiddenHostIds.includes(h.id)} onChange={() => toggleHost(h.id)} label={h.name} sub={`${h.role} · ${h.ip}`} />
          ))}
        </div>
      </Panel>

      <Panel
        title="Services critiques"
        hint="Les services cochés apparaissent dans « Services critiques » sur le Cockpit."
      >
        <div className="row-list">
          {services.map((s) => (
            <CheckRow key={s.id} checked={criticalIds.includes(s.id)} onChange={() => toggleService(s.id)} label={s.name} sub={formatCategory(s.category)} />
          ))}
        </div>
        {settings.criticalServiceIds !== null && (
          <div style={{ marginTop: 12 }}>
            <button className="btn btn--sm btn--ghost" onClick={() => saveSettings({ ...settings, criticalServiceIds: null })}>
              Revenir à la liste par défaut
            </button>
          </div>
        )}
      </Panel>

      <Panel
        title="Seuils de charge"
        hint="Un CPU ou une RAM au-dessus du premier seuil passe en ambre, au-dessus du second en rouge."
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label className="text-secondary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Ambre à partir de
            <input type="number" min={1} max={99} className="mono" style={numberInputStyle} value={warnValue} onChange={(e) => setLoadWarn(Number(e.target.value))} />
            %
          </label>
          <label className="text-secondary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Rouge à partir de
            <input type="number" min={2} max={100} className="mono" style={numberInputStyle} value={critValue} onChange={(e) => setLoadCrit(Number(e.target.value))} />
            %
          </label>
          <button className="btn btn--sm btn--primary" onClick={saveThresholds} disabled={!thresholdsValid || !thresholdsDirty}>
            Enregistrer
          </button>
        </div>
        {!thresholdsValid && (
          <p style={{ color: "var(--color-amber)", fontSize: 12, marginTop: 8 }}>
            Le seuil ambre doit être inférieur au seuil rouge (entre 1 et 100).
          </p>
        )}
      </Panel>

      <p className="text-tertiary" style={{ fontSize: 12.5 }}>
        Les intégrations (Home Assistant, Proxmox, TrueNAS…), les utilisateurs, les règles d’automatisation et les notifications se gèrent dans{" "}
        <Link to="/administration">Administration</Link>.
      </p>
    </div>
  );
}
