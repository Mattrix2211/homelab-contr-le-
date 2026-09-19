import { useState, type CSSProperties } from "react";
import { useAuth } from "../store/auth";
import {
  useIntegrationsConfig,
  useUsersList,
  useCreateUser,
  useSetUserRole,
  useRemoveUser,
  useQuickActionsList,
  useRemoveQuickAction,
  useCreateQuickAction,
  useAutomationRules,
  useCreateAutomationRule,
  useSetAutomationRuleEnabled,
  useRemoveAutomationRule,
  useNotificationChannels,
  useCreateNotificationChannel,
  useRemoveNotificationChannel,
  useTestNotificationChannel,
  useContainers,
  useProxmoxGuests,
  useBackups,
} from "../api/hooks";
import type { Role } from "../api/types";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { useToast } from "../store/toast";
import type { TriggerKind, NotificationKind } from "../api/types";

// Single source of truth for action labels shown across both panels below,
// so a renamed action can't drift out of sync between the two forms.
const ACTION_LABELS: Record<string, string> = {
  "container.restart": "Restart container",
  "container.start": "Start container",
  "container.stop": "Stop container",
  "guest.reboot": "Reboot VM/LXC",
  "guest.start": "Start VM/LXC",
  "homeassistant.restart": "Restart Home Assistant",
  "backup.run": "Run backup",
};

const REMEDIATION_ACTION_KEYS = ["container.restart", "container.start", "guest.reboot", "guest.start", "homeassistant.restart"];

function AutomationRulesPanel() {
  const { data } = useAutomationRules();
  const createRule = useCreateAutomationRule();
  const setEnabled = useSetAutomationRuleEnabled();
  const removeRule = useRemoveAutomationRule();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [triggerKind, setTriggerKind] = useState<TriggerKind>("service_down");
  const [triggerTarget, setTriggerTarget] = useState("");
  const [triggerMinutes, setTriggerMinutes] = useState(5);
  const [actionKey, setActionKey] = useState(REMEDIATION_ACTION_KEYS[0]);
  const [actionTarget, setActionTarget] = useState("");
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const { push } = useToast();

  const rules = data?.rules ?? [];

  async function handleCreate() {
    if (!name || !triggerTarget || !actionTarget) return;
    try {
      await createRule.mutateAsync({ name, triggerKind, triggerTarget, triggerMinutes, actionKey, actionTarget, cooldownMinutes });
      push("success", "Automation rule created");
      setShowForm(false);
      setName("");
      setTriggerTarget("");
      setActionTarget("");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not create rule");
    }
  }

  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">Automation rules</div>
        <button className="btn btn--sm btn--ghost" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add rule"}
        </button>
      </div>
      <p className="text-tertiary" style={{ fontSize: 12, marginBottom: 12 }}>
        "If &lt;service/host&gt; stays down for N minutes, run &lt;action&gt;." Only level 1/2 actions are
        available here — level 3 destructive actions are never automatable (section 21).
      </p>

      {showForm && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          <input placeholder="Rule name" value={name} onChange={(e) => setName(e.target.value)} className="mono" style={inputStyle} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={triggerKind} onChange={(e) => setTriggerKind(e.target.value as TriggerKind)} style={selectStyle}>
              <option value="service_down">Service down</option>
              <option value="host_down">Host down</option>
            </select>
            <input
              placeholder="trigger target id (e.g. frigate, m83)"
              value={triggerTarget}
              onChange={(e) => setTriggerTarget(e.target.value)}
              style={inputStyle}
            />
            <input
              type="number"
              min={1}
              value={triggerMinutes}
              onChange={(e) => setTriggerMinutes(Number(e.target.value))}
              style={{ ...inputStyle, width: 90 }}
            />
            <span className="text-tertiary" style={{ alignSelf: "center", fontSize: 12 }}>minutes sustained</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={actionKey} onChange={(e) => setActionKey(e.target.value)} style={selectStyle}>
              {REMEDIATION_ACTION_KEYS.map((key) => (
                <option key={key} value={key}>{ACTION_LABELS[key]}</option>
              ))}
            </select>
            <input
              placeholder="action target (container id / qemu:100 / lxc:100)"
              value={actionTarget}
              onChange={(e) => setActionTarget(e.target.value)}
              style={inputStyle}
            />
            <input
              type="number"
              min={1}
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(Number(e.target.value))}
              style={{ ...inputStyle, width: 90 }}
            />
            <span className="text-tertiary" style={{ alignSelf: "center", fontSize: 12 }}>cooldown minutes</span>
          </div>
          <button className="btn btn--sm btn--primary" onClick={handleCreate} style={{ alignSelf: "flex-start" }}>
            Save rule
          </button>
        </div>
      )}

      {rules.length === 0 ? (
        <EmptyState title="No automation rules" />
      ) : (
        <div className="row-list">
          {rules.map((r) => (
            <div className="row" key={r.id}>
              <span className="row__primary">
                {r.name}
                <div className="row__secondary mono">
                  {r.trigger_kind} · {r.trigger_target} ≥{r.trigger_minutes}m → {r.action_key} on {r.action_target}
                </div>
              </span>
              <StatusBadge status={r.enabled ? "online" : "unknown"} label={r.enabled ? "Enabled" : "Disabled"} />
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn--sm btn--ghost" onClick={() => setEnabled.mutate({ id: r.id, enabled: !r.enabled })}>
                  {r.enabled ? "Disable" : "Enable"}
                </button>
                <button className="btn btn--sm btn--ghost" onClick={() => removeRule.mutate(r.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationChannelsPanel() {
  const { data } = useNotificationChannels();
  const createChannel = useCreateNotificationChannel();
  const removeChannel = useRemoveNotificationChannel();
  const testChannel = useTestNotificationChannel();
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<NotificationKind>("discord");
  const [target, setTarget] = useState("");
  const [minSeverity, setMinSeverity] = useState<"info" | "warning" | "critical">("warning");
  const { push } = useToast();

  const channels = data?.channels ?? [];

  async function handleCreate() {
    if (!target) return;
    await createChannel.mutateAsync({ kind, target, minSeverity });
    setTarget("");
    setShowForm(false);
  }

  async function handleTest(id: string) {
    try {
      await testChannel.mutateAsync(id);
      push("success", "Test notification sent");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Test failed");
    }
  }

  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">Notification channels</div>
        <button className="btn btn--sm btn--ghost" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add channel"}
        </button>
      </div>

      {showForm && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <select value={kind} onChange={(e) => setKind(e.target.value as NotificationKind)} style={selectStyle}>
            <option value="discord">Discord (webhook)</option>
            <option value="homeassistant">Home Assistant (notify service → mobile)</option>
          </select>
          <input
            placeholder={kind === "discord" ? "https://discord.com/api/webhooks/…" : "mobile_app_matthis_phone"}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <select value={minSeverity} onChange={(e) => setMinSeverity(e.target.value as typeof minSeverity)} style={selectStyle}>
            <option value="info">Info+</option>
            <option value="warning">Warning+</option>
            <option value="critical">Critical only</option>
          </select>
          <button className="btn btn--sm btn--primary" onClick={handleCreate}>Save</button>
        </div>
      )}

      {channels.length === 0 ? (
        <EmptyState title="No notification channels" description="Add Discord or Home Assistant to get alerted outside the cockpit." />
      ) : (
        <div className="row-list">
          {channels.map((c) => (
            <div className="row" key={c.id}>
              <span className="row__primary">
                {c.kind === "discord" ? "Discord" : "Home Assistant"}
                <div className="row__secondary mono">{c.target}</div>
              </span>
              <span className="mono text-tertiary" style={{ textTransform: "uppercase", fontSize: 11 }}>{c.min_severity}+</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn--sm btn--ghost" onClick={() => handleTest(c.id)}>Test</button>
                <button className="btn btn--sm btn--ghost" onClick={() => removeChannel.mutate(c.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const QUICK_ACTION_KEYS = ["container.restart", "container.start", "container.stop", "guest.reboot", "guest.start", "homeassistant.restart", "backup.run"];

function QuickActionsAdminPanel() {
  const { data } = useQuickActionsList();
  const removeQuickAction = useRemoveQuickAction();
  const createQuickAction = useCreateQuickAction();
  const { data: containersData } = useContainers();
  const { data: guestsData } = useProxmoxGuests();
  const { data: backupsData } = useBackups();

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [actionKey, setActionKey] = useState(QUICK_ACTION_KEYS[0]);
  const [target, setTarget] = useState("");
  const { push } = useToast();

  const quickActions = data?.quickActions ?? [];
  const containers = containersData?.containers ?? [];
  const guests = guestsData?.guests ?? [];
  const backups = backupsData?.backups ?? [];
  const needsTarget = actionKey !== "homeassistant.restart";

  async function handleCreate() {
    if (!label || (needsTarget && !target)) return;
    try {
      await createQuickAction.mutateAsync({ label, actionKey, target: needsTarget ? target : "home-assistant" });
      push("success", "Quick action pinned");
      setShowForm(false);
      setLabel("");
      setTarget("");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not pin quick action");
    }
  }

  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">Quick actions</div>
        <button className="btn btn--sm btn--ghost" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Pin quick action"}
        </button>
      </div>

      {showForm && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            placeholder="Label (e.g. Restart Frigate)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          />
          <select
            value={actionKey}
            onChange={(e) => {
              setActionKey(e.target.value);
              setTarget("");
            }}
            style={selectStyle}
          >
            {QUICK_ACTION_KEYS.map((key) => (
              <option key={key} value={key}>{ACTION_LABELS[key]}</option>
            ))}
          </select>

          {needsTarget && actionKey.startsWith("container.") && (
            <select value={target} onChange={(e) => setTarget(e.target.value)} style={selectStyle}>
              <option value="">Select container…</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {needsTarget && actionKey.startsWith("guest.") && (
            <select value={target} onChange={(e) => setTarget(e.target.value)} style={selectStyle}>
              <option value="">Select VM/LXC…</option>
              {guests.map((g) => (
                <option key={`${g.type}:${g.vmid}`} value={`${g.type}:${g.vmid}`}>{g.name} ({g.type} {g.vmid})</option>
              ))}
            </select>
          )}
          {needsTarget && actionKey === "backup.run" && (
            <select value={target} onChange={(e) => setTarget(e.target.value)} style={selectStyle}>
              <option value="">Select backup…</option>
              {backups.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          )}

          <button className="btn btn--sm btn--primary" onClick={handleCreate}>Save</button>
        </div>
      )}

      {quickActions.length === 0 ? (
        <EmptyState title="No quick actions pinned" description="Pin an action above to see it on the Cockpit." />
      ) : (
        <div className="row-list">
          {quickActions.map((qa) => (
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
  );
}

function UsersPanel() {
  const { user: currentUser } = useAuth();
  const { data } = useUsersList(true);
  const createUser = useCreateUser();
  const setRole = useSetUserRole();
  const removeUser = useRemoveUser();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRoleField] = useState<Role>("viewer");
  const { push } = useToast();

  const users = data?.users ?? [];

  async function handleCreate() {
    if (!email || !password || !displayName) return;
    try {
      await createUser.mutateAsync({ email, password, role, displayName });
      push("success", `${displayName} created`);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setRoleField("viewer");
      setShowForm(false);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not create user");
    }
  }

  async function handleRoleChange(id: string, newRole: Role) {
    try {
      await setRole.mutateAsync({ id, role: newRole });
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not change role");
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeUser.mutateAsync(id);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not remove user");
    }
  }

  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">Users</div>
        <button className="btn btn--sm btn--ghost" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add user"}
        </button>
      </div>

      {showForm && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 140 }}
          />
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          />
          <input
            placeholder="Password (min. 8 chars)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          />
          <select value={role} onChange={(e) => setRoleField(e.target.value as Role)} style={selectStyle}>
            <option value="viewer">Viewer</option>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn btn--sm btn--primary" onClick={handleCreate}>Save</button>
        </div>
      )}

      <div className="row-list">
        {users.map((u) => (
          <div className="row" key={u.id}>
            <span className="row__primary">
              {u.displayName}
              <div className="row__secondary">{u.email}</div>
            </span>
            <select
              value={u.role}
              onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
              disabled={u.id === currentUser?.id}
              style={{ ...selectStyle, fontSize: 12 }}
            >
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => handleRemove(u.id)}
              disabled={u.id === currentUser?.id}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  background: "var(--color-background)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "6px 10px",
  color: "var(--color-text-primary)",
};

const selectStyle: CSSProperties = { ...inputStyle };

export function Administration() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: integrations } = useIntegrationsConfig(isAdmin);

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

          <UsersPanel />

          <AutomationRulesPanel />
          <NotificationChannelsPanel />
          <QuickActionsAdminPanel />
        </>
      )}
    </div>
  );
}
