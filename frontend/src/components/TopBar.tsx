import { useAlerts } from "../api/hooks";
import { NotificationCenter } from "./NotificationCenter";

export function TopBar({
  onOpenPalette,
  onToggleSidebar,
}: {
  onOpenPalette: () => void;
  onToggleSidebar: () => void;
}) {
  const { data } = useAlerts();
  const alertCount = data?.alerts.length ?? 0;

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn--ghost btn--sm" onClick={onToggleSidebar} aria-label="Afficher/masquer la navigation">
          ☰
        </button>
        <button className="topbar__search" onClick={onOpenPalette}>
          <span>Rechercher machines, services, conteneurs…</span>
          <kbd>Ctrl K</kbd>
        </button>
      </div>
      <div className="topbar__actions">
        {alertCount > 0 && (
          <span className="status-badge status-badge--warning">
            <span className="status-badge__dot" />
            {alertCount} alerte{alertCount > 1 ? "s" : ""}
          </span>
        )}
        <NotificationCenter />
      </div>
    </header>
  );
}
