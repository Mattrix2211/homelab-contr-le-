import { useQuickActionsList, useRunQuickAction } from "../api/hooks";
import { ActionButton } from "./ActionButton";

export function QuickActionsPanel() {
  const { data } = useQuickActionsList();
  const runQuickAction = useRunQuickAction();
  const quickActions = data?.quickActions ?? [];

  if (quickActions.length === 0) {
    return (
      <div className="card card--slim">
        <span className="section-title">Quick actions</span>
        <span className="text-tertiary" style={{ fontSize: 12.5 }}>None pinned — pin actions from Administration to see them here.</span>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="section-title" style={{ marginBottom: 12 }}>Quick actions</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {quickActions.map((qa) => (
          <ActionButton
            key={qa.id}
            label={qa.label}
            level={qa.level}
            confirmBody={`Run "${qa.label}" (${qa.action_key} on ${qa.target}).`}
            onRun={() => runQuickAction.mutateAsync(qa.id)}
          />
        ))}
      </div>
    </div>
  );
}
