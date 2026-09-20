import { NavLink } from "react-router-dom";
import { useAuth } from "../store/auth";

const NAV = [
  { index: "01", label: "Cockpit", path: "/" },
  { index: "02", label: "Infrastructure", path: "/infrastructure" },
  { index: "03", label: "Services", path: "/services" },
  { index: "04", label: "Stockage", path: "/storage" },
  { index: "05", label: "Réseau", path: "/network" },
  { index: "06", label: "Home Assistant", path: "/home-assistant" },
  { index: "07", label: "Supervision", path: "/monitoring" },
  { index: "08", label: "Événements", path: "/events" },
  { index: "09", label: "Administration", path: "/administration" },
  { index: "10", label: "Paramètres", path: "/parametres" },
];

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate?: () => void }) {
  const { user, logout } = useAuth();

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark">MK</span>
        <span>HomeLab Control Center</span>
      </div>
      <nav className="sidebar__nav">
        {NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            onClick={onNavigate}
            className={({ isActive }) => `sidebar__link${isActive ? " active" : ""}`}
          >
            <span className="sidebar__link-index">{item.index}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar__footer">
        <div className="text-secondary" style={{ fontSize: 12 }}>
          {user?.displayName} · <span className="mono">{user?.role}</span>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={() => logout()}>
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
