export function ConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
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
  return (
    <div className="overlay" onClick={onCancel}>
      <div className={`modal ${critical ? "modal--critical" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal__title">{title}</div>
        <div className="modal__body">{body}</div>
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className={`btn ${critical ? "btn--danger" : "btn--primary"}`} onClick={onConfirm} disabled={loading}>
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
