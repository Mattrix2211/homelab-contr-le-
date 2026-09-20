import { useQuickActionsList, useRunQuickAction } from "../api/hooks";
import { ActionButton } from "./ActionButton";

export function QuickActionsPanel() {
  const { data } = useQuickActionsList();
  const runQuickAction = useRunQuickAction();
  const quickActions = data?.quickActions ?? [];

  if (quickActions.length === 0) {
    return (
      <div className="card card--slim">
        <span className="section-title">Actions rapides</span>
        <span className="text-tertiary" style={{ fontSize: 12.5 }}>Aucune épinglée — épinglez des actions depuis Administration pour les voir ici.</span>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="section-title" style={{ marginBottom: 12 }}>Actions rapides</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {quickActions.map((qa) => (
          <ActionButton
            key={qa.id}
            label={qa.label}
            level={qa.level}
            confirmBody={`Exécuter « ${qa.label} » (${qa.action_key} sur ${qa.target}).`}
            onRun={() => runQuickAction.mutateAsync(qa.id)}
          />
        ))}
      </div>
    </div>
  );
}
