import { useAuth } from "../store/auth";
import { useIntegrationsConfig, useUsersList, useQuickActionsList, useRemoveQuickAction } from "../api/hooks";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";

export function Administration() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: integrations } = useIntegrationsConfig(isAdmin);
  const { data: users } = useUsersList(isAdmin);
  const { data: quickActions } = useQuickActionsList();
  const removeQuickAction = useRemoveQuickAction();

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Administration</div>
          <div className="page__subtitle">Cockpit configuration and integrations</div>
        </div>
      </div>

      {!isAdmin ? (
        <EmptyState title="Admin access required" description="Sign in with an admin account to manage integrations and users." />
      ) : (
        <>
          <div className="card">
            <div className="section-title" style={{ marginBottom: 12 }}>Integrations</div>
            <div className="row-list">
              {integrations &&
                Object.entries(integrations).map(([key, cfg]) => (
                  <div className="row" key={key}>
                    <span className="row__primary" style={{ textTransform: "capitalize" }}>{key}</span>
                    <StatusBadge status={cfg.enabled ? "online" : "unknown"} label={cfg.enabled ? "Configured" : "Not configured"} />
                  </div>
                ))}
            </div>
            <p className="text-tertiary" style={{ fontSize: 12, marginTop: 12 }}>
              Configure integrations via environment variables (see <code className="mono">.env.example</code>) and
              restart the backend container. Secrets are never exposed to this UI (section 28).
            </p>
          </div>

          <div className="card">
            <div className="section-title" style={{ marginBottom: 12 }}>Users</div>
            <div className="row-list">
              {users?.users.map((u) => (
                <div className="row" key={u.id}>
                  <span className="row__primary">
                    {u.displayName}
                    <div className="row__secondary">{u.email}</div>
                  </span>
                  <span className="mono text-secondary" style={{ textTransform: "uppercase", fontSize: 11 }}>{u.role}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>Quick actions</div>
        {!quickActions?.quickActions.length ? (
          <EmptyState title="No quick actions pinned" description="Pin actions from a resource drawer to see them here." />
        ) : (
          <div className="row-list">
            {quickActions.quickActions.map((qa) => (
              <div className="row" key={qa.id}>
                <span className="row__primary">
                  {qa.label}
                  <div className="row__secondary mono">{qa.action_key} → {qa.target}</div>
                </span>
                <button className="btn btn--sm btn--ghost" onClick={() => removeQuickAction.mutate(qa.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
