import { useEffect, useRef } from "react";
import { useEscapeKey } from "../lib/useEscapeKey";

export function ConfirmModal({
  title,
  body,
  confirmLabel = "Confirmer",
  critical,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  critical?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onCancel);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-body"
        tabIndex={-1}
        className={`modal ${critical ? "modal--critical" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div id="confirm-modal-title" className="modal__title">{title}</div>
        <div id="confirm-modal-body" className="modal__body">{body}</div>
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
          <button className={`btn ${critical ? "btn--danger" : "btn--primary"}`} onClick={onConfirm} disabled={loading}>
            {loading ? "En cours…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
