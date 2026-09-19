import { useAlerts } from "../api/hooks";

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
        <button className="btn btn--ghost btn--sm" onClick={onToggleSidebar} aria-label="Toggle navigation">
          ☰
        </button>
        <button className="topbar__search" onClick={onOpenPalette}>
          <span>Search hosts, services, containers…</span>
          <kbd>Ctrl K</kbd>
        </button>
      </div>
      <div className="topbar__actions">
        {alertCount > 0 && (
          <span className="status-badge status-badge--warning">
            <span className="status-badge__dot" />
            {alertCount} alert{alertCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </header>
  );
}
