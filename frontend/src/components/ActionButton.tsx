import { useState } from "react";
import { ConfirmModal } from "./ConfirmModal";
import { useToast } from "../store/toast";

export type ActionLevel = 1 | 2 | 3;

interface ActionButtonProps {
  label: string;
  level: ActionLevel;
  confirmBody?: string;
  variant?: "primary" | "danger" | "ghost";
  disabled?: boolean;
  onRun: () => Promise<unknown>;
}

// Enforces the three confirmation levels from section 21: level 1 runs
// immediately, level 2 requires an explicit modal confirmation, level 3
// (destructive) is intentionally not wired to a one-click handler anywhere
// in the frontend - those flows stay in the native admin UIs.
export function ActionButton({ label, level, confirmBody, variant = "ghost", disabled, onRun }: ActionButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const { push } = useToast();

  async function execute() {
    setLoading(true);
    try {
      await onRun();
      push("success", `${label} : réussi`);
      setConfirming(false);
    } catch (err) {
      push("error", err instanceof Error ? err.message : `${label} : échec`);
    } finally {
      setLoading(false);
    }
  }

  function handleClick() {
    if (level >= 2) {
      setConfirming(true);
    } else {
      execute();
    }
  }

  return (
    <>
      <button className={`btn btn--sm btn--${variant}`} onClick={handleClick} disabled={disabled || loading}>
        {loading && level < 2 ? "En cours…" : label}
      </button>
      {confirming && (
        <ConfirmModal
          title={`${label}?`}
          body={confirmBody ?? `Cette action va exécuter : ${label.toLowerCase()}.`}
          confirmLabel={label}
          critical={level === 3}
          loading={loading}
          onConfirm={execute}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
