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
  "container.restart": "Redémarrer un conteneur",
  "container.start": "Démarrer un conteneur",
  "container.stop": "Arrêter un conteneur",
  "guest.reboot": "Redémarrer une VM/LXC",
  "guest.start": "Démarrer une VM/LXC",
  "homeassistant.restart": "Redémarrer Home Assistant",
  "backup.run": "Lancer une sauvegarde",
};

const TRIGGER_LABELS: Record<string, string> = {
  service_down: "Service arrêté",
  host_down: "Machine arrêtée",
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
      push("success", "Règle d’automatisation créée");
      setShowForm(false);
      setName("");
      setTriggerTarget("");
      setActionTarget("");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Impossible de créer la règle");
    }
  }

  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">Règles d’automatisation</div>
        <button className="btn btn--sm btn--ghost" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Annuler" : "+ Ajouter une règle"}
        </button>
      </div>
      <p className="text-tertiary" style={{ fontSize: 12, marginBottom: 12 }}>
        « Si &lt;service/machine&gt; reste arrêté pendant N minutes, exécuter &lt;action&gt;. » Seules les actions de
        niveau 1/2 sont proposées ici — les actions destructrices de niveau 3 ne sont jamais automatisables (section 21).
      </p>

      {showForm && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          <input placeholder="Nom de la règle" value={name} onChange={(e) => setName(e.target.value)} className="mono" style={inputStyle} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={triggerKind} onChange={(e) => setTriggerKind(e.target.value as TriggerKind)} style={selectStyle}>
              <option value="service_down">Service arrêté</option>
              <option value="host_down">Machine arrêtée</option>
            </select>
            <input
              placeholder="id de la cible du déclencheur (ex. frigate, m83)"
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
            <span className="text-tertiary" style={{ alignSelf: "center", fontSize: 12 }}>minutes d’affilée</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={actionKey} onChange={(e) => setActionKey(e.target.value)} style={selectStyle}>
              {REMEDIATION_ACTION_KEYS.map((key) => (
                <option key={key} value={key}>{ACTION_LABELS[key]}</option>
              ))}
            </select>
            <input
              placeholder="cible de l’action (id de conteneur / qemu:100 / lxc:100)"
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
            <span className="text-tertiary" style={{ alignSelf: "center", fontSize: 12 }}>minutes de délai entre deux exécutions</span>
          </div>
          <button className="btn btn--sm btn--primary" onClick={handleCreate} style={{ alignSelf: "flex-start" }}>
            Enregistrer la règle
          </button>
        </div>
      )}

      {rules.length === 0 ? (
        <EmptyState title="Aucune règle d’automatisation" />
      ) : (
        <div className="row-list">
          {rules.map((r) => (
            <div className="row" key={r.id}>
              <span className="row__primary">
                {r.name}
                <div className="row__secondary mono">
                  {TRIGGER_LABELS[r.trigger_kind] ?? r.trigger_kind} · {r.trigger_target} ≥{r.trigger_minutes} min → {ACTION_LABELS[r.action_key] ?? r.action_key} sur {r.action_target}
                </div>
              </span>
              <StatusBadge status={r.enabled ? "online" : "unknown"} label={r.enabled ? "Activée" : "Désactivée"} />
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn--sm btn--ghost" onClick={() => setEnabled.mutate({ id: r.id, enabled: !r.enabled })}>
                  {r.enabled ? "Désactiver" : "Activer"}
                </button>
                <button className="btn btn--sm btn--ghost" onClick={() => removeRule.mutate(r.id)}>Supprimer</button>
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
      push("success", "Notification de test envoyée");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Échec du test");
    }
  }

  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">Canaux de notification</div>
        <button className="btn btn--sm btn--ghost" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Annuler" : "+ Ajouter un canal"}
        </button>
      </div>

      {showForm && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <select value={kind} onChange={(e) => setKind(e.target.value as NotificationKind)} style={selectStyle}>
            <option value="discord">Discord (webhook)</option>
            <option value="homeassistant">Home Assistant (service notify → mobile)</option>
          </select>
          <input
            placeholder={kind === "discord" ? "https://discord.com/api/webhooks/…" : "mobile_app_matthis_phone"}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <select value={minSeverity} onChange={(e) => setMinSeverity(e.target.value as typeof minSeverity)} style={selectStyle}>
            <option value="info">Info+</option>
            <option value="warning">Avertissement+</option>
            <option value="critical">Critique uniquement</option>
          </select>
          <button className="btn btn--sm btn--primary" onClick={handleCreate}>Enregistrer</button>
        </div>
      )}

      {channels.length === 0 ? (
        <EmptyState title="Aucun canal de notification" description="Ajoutez Discord ou Home Assistant pour être alerté en dehors du cockpit." />
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
                <button className="btn btn--sm btn--ghost" onClick={() => handleTest(c.id)}>Tester</button>
                <button className="btn btn--sm btn--ghost" onClick={() => removeChannel.mutate(c.id)}>Supprimer</button>
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
      push("success", "Action rapide épinglée");
      setShowForm(false);
      setLabel("");
      setTarget("");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Impossible d’épingler l’action rapide");
    }
  }

  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">Actions rapides</div>
        <button className="btn btn--sm btn--ghost" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Annuler" : "+ Épingler une action rapide"}
        </button>
      </div>

      {showForm && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            placeholder="Nom (ex. Redémarrer Frigate)"
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
              <option value="">Choisir un conteneur…</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {needsTarget && actionKey.startsWith("guest.") && (
            <select value={target} onChange={(e) => setTarget(e.target.value)} style={selectStyle}>
              <option value="">Choisir une VM/LXC…</option>
              {guests.map((g) => (
                <option key={`${g.type}:${g.vmid}`} value={`${g.type}:${g.vmid}`}>{g.name} ({g.type} {g.vmid})</option>
              ))}
            </select>
          )}
          {needsTarget && actionKey === "backup.run" && (
            <select value={target} onChange={(e) => setTarget(e.target.value)} style={selectStyle}>
              <option value="">Choisir une sauvegarde…</option>
              {backups.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          )}

          <button className="btn btn--sm btn--primary" onClick={handleCreate}>Enregistrer</button>
        </div>
      )}

      {quickActions.length === 0 ? (
        <EmptyState title="Aucune action rapide épinglée" description="Épinglez une action ci-dessus pour la voir sur le Cockpit." />
      ) : (
        <div className="row-list">
          {quickActions.map((qa) => (
            <div className="row" key={qa.id}>
              <span className="row__primary">
                {qa.label}
                <div className="row__secondary mono">{qa.action_key} → {qa.target}</div>
              </span>
              <button className="btn btn--sm btn--ghost" onClick={() => removeQuickAction.mutate(qa.id)}>
                Supprimer
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
      push("success", `${displayName} créé`);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setRoleField("viewer");
      setShowForm(false);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Impossible de créer l’utilisateur");
    }
  }

  async function handleRoleChange(id: string, newRole: Role) {
    try {
      await setRole.mutateAsync({ id, role: newRole });
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Impossible de changer le rôle");
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeUser.mutateAsync(id);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Impossible de supprimer l’utilisateur");
    }
  }

  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">Utilisateurs</div>
        <button className="btn btn--sm btn--ghost" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Annuler" : "+ Ajouter un utilisateur"}
        </button>
      </div>

      {showForm && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            placeholder="Nom affiché"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 140 }}
          />
          <input
            placeholder="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          />
          <input
            placeholder="Mot de passe (8 caractères min.)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          />
          <select value={role} onChange={(e) => setRoleField(e.target.value as Role)} style={selectStyle}>
            <option value="viewer">Lecteur</option>
            <option value="operator">Opérateur</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn btn--sm btn--primary" onClick={handleCreate}>Enregistrer</button>
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
              <option value="viewer">Lecteur</option>
              <option value="operator">Opérateur</option>
              <option value="admin">Admin</option>
            </select>
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => handleRemove(u.id)}
              disabled={u.id === currentUser?.id}
            >
              Supprimer
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
          <div className="page__subtitle">Configuration du cockpit et des intégrations</div>
        </div>
      </div>

      {!isAdmin ? (
        <EmptyState title="Accès administrateur requis" description="Connectez-vous avec un compte administrateur pour gérer les intégrations et les utilisateurs." />
      ) : (
        <>
          <div className="card">
            <div className="section-title" style={{ marginBottom: 12 }}>Intégrations</div>
            <div className="row-list">
              {integrations &&
                Object.entries(integrations).map(([key, cfg]) => (
                  <div className="row" key={key}>
                    <span className="row__primary" style={{ textTransform: "capitalize" }}>{key}</span>
                    <StatusBadge status={cfg.enabled ? "online" : "unknown"} label={cfg.enabled ? "Configurée" : "Non configurée"} />
                  </div>
                ))}
            </div>
            <p className="text-tertiary" style={{ fontSize: 12, marginTop: 12 }}>
              Les intégrations se configurent via les variables d’environnement (voir <code className="mono">.env.example</code>), puis on
              redémarre le conteneur backend. Les secrets ne sont jamais exposés dans cette interface (section 28).
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
