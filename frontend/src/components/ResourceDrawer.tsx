import { useEffect, useRef, type ReactNode } from "react";
import type { Status } from "../api/types";
import { StatusBadge } from "./StatusBadge";
import { useEscapeKey } from "../lib/useEscapeKey";

export function ResourceDrawer({
  title,
  status,
  subtitle,
  onClose,
  children,
  actions,
}: {
  title: string;
  status?: Status;
  subtitle?: string;
  onClose: () => void;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="drawer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer__header">
          <div>
            <div className="drawer__title">{title}</div>
            {subtitle && <div className="text-tertiary" style={{ fontSize: 12, marginTop: 4 }}>{subtitle}</div>}
            {status && (
              <div style={{ marginTop: 8 }}>
                <StatusBadge status={status} />
              </div>
            )}
          </div>
          <button className="drawer__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        {children}
        {actions && <div className="drawer__actions">{actions}</div>}
      </div>
    </div>
  );
}

export function DrawerMetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row" style={{ padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
      <span className="metric-row__label">{label}</span>
      <span className="metric-row__value">{value}</span>
    </div>
  );
}
