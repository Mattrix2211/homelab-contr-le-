import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearch } from "../api/hooks";
import { useEscapeKey } from "../lib/useEscapeKey";

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data } = useSearch(query);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEscapeKey(onClose);

  function go(path: string) {
    navigate(path);
    onClose();
  }

  const hasResults =
    data && (data.pages.length + data.hosts.length + data.services.length + data.containers.length > 0);

  return (
    <div className="overlay" onClick={onClose} style={{ alignItems: "flex-start" }}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette__input"
          placeholder="Rechercher machines, services, conteneurs, pages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="palette__results">
          {!query && (
            <div className="palette__empty">Tapez pour chercher dans le HomeLab — essayez « frigate », « proxmox » ou « stockage ».</div>
          )}
          {query && !hasResults && <div className="palette__empty">Aucun résultat pour « {query} »</div>}

          {data && data.pages.length > 0 && (
            <>
              <div className="palette__group-label">Pages</div>
              {data.pages.map((p) => (
                <div key={p.id} className="palette__item" onClick={() => go(p.path)}>
                  <span>Aller à {p.label}</span>
                </div>
              ))}
            </>
          )}

          {data && data.hosts.length > 0 && (
            <>
              <div className="palette__group-label">Machines</div>
              {data.hosts.map((h) => (
                <div key={h.id} className="palette__item" onClick={() => go("/infrastructure")}>
                  <span>{h.name}</span>
                  <span className="text-tertiary mono" style={{ fontSize: 11 }}>{h.ip}</span>
                </div>
              ))}
            </>
          )}

          {data && data.services.length > 0 && (
            <>
              <div className="palette__group-label">Services</div>
              {data.services.map((s) => (
                <div key={s.id} className="palette__item" onClick={() => go("/services")}>
                  <span>{s.name}</span>
                </div>
              ))}
            </>
          )}

          {data && data.containers.length > 0 && (
            <>
              <div className="palette__group-label">Conteneurs</div>
              {data.containers.map((c) => (
                <div key={c.id} className="palette__item" onClick={() => go("/services")}>
                  <span>{c.name}</span>
                  <span className="text-tertiary mono" style={{ fontSize: 11 }}>{c.image}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
