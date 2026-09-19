import { useState } from "react";
import {
  useHost,
  usePools,
  useDatasets,
  useDisks,
  useSnapshots,
  useCreateSnapshot,
  useRunScrub,
  useTruenasAvailable,
  useBackups,
  useCreateBackup,
  useRunBackup,
  useRemoveBackup,
} from "../api/hooks";
import { StorageCard } from "../components/StorageCard";
import { HostCard } from "../components/HostCard";
import { DiskCard } from "../components/DiskCard";
import { OpenLinkButton } from "../components/OpenLinkButton";
import { ActionButton } from "../components/ActionButton";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { SkeletonGrid } from "../components/Skeleton";
import { formatBytes, formatRelativeTime } from "../lib/format";
import { useToast } from "../store/toast";
import { useAuth } from "../store/auth";
import type { BackupKind } from "../api/types";

function SnapshotsPanel() {
  const { data } = useSnapshots();
  const createSnapshot = useCreateSnapshot();
  const [dataset, setDataset] = useState("");
  const [name, setName] = useState("");
  const { push } = useToast();

  async function handleCreate() {
    if (!dataset || !name) return;
    try {
      await createSnapshot.mutateAsync({ dataset, name });
      push("success", `Snapshot ${name} created`);
      setName("");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Snapshot failed");
    }
  }

  const snapshots = data?.snapshots ?? [];

  return (
    <div className="card">
      <div className="section-title" style={{ marginBottom: 12 }}>Snapshots</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder="dataset (e.g. main/homeassistant)"
          value={dataset}
          onChange={(e) => setDataset(e.target.value)}
          style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "6px 10px", color: "var(--color-text-primary)", flex: 1, minWidth: 160 }}
        />
        <input
          placeholder="snapshot name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "6px 10px", color: "var(--color-text-primary)", flex: 1, minWidth: 160 }}
        />
        <button className="btn btn--sm btn--primary" onClick={handleCreate} disabled={createSnapshot.isPending}>
          Create snapshot
        </button>
      </div>
      {snapshots.length === 0 ? (
        <EmptyState title="No snapshots" />
      ) : (
        <div className="row-list">
          {snapshots.slice(0, 30).map((s) => (
            <div className="row" key={s.id}>
              <span className="row__primary">
                {s.name}
                <div className="row__secondary mono">{s.dataset}</div>
              </span>
              <span className="mono text-tertiary" style={{ width: 90 }}>{formatBytes(s.usedBytes)}</span>
              <span className="mono text-tertiary" style={{ width: 110, textAlign: "right" }}>
                {s.createdAt ? formatRelativeTime(s.createdAt) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BackupsPanel() {
  const { data } = useBackups();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canRun = user?.role === "operator" || user?.role === "admin";
  const runBackup = useRunBackup();
  const removeBackup = useRemoveBackup();
  const createBackup = useCreateBackup();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<BackupKind>("custom");
  const [targetRef, setTargetRef] = useState("");
  const [triggerUrl, setTriggerUrl] = useState("");
  const { push } = useToast();

  const backups = data?.backups ?? [];

  async function handleCreate() {
    if (!label) return;
    try {
      await createBackup.mutateAsync({
        label,
        kind,
        targetRef: kind !== "custom" ? targetRef || undefined : undefined,
        triggerUrl: kind === "custom" ? triggerUrl || undefined : undefined,
      });
      setLabel("");
      setTargetRef("");
      setTriggerUrl("");
      setShowForm(false);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not create backup");
    }
  }

  return (
    <div className="card">
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div className="section-title">Backups (3-2-1)</div>
        {isAdmin && (
          <button className="btn btn--sm btn--ghost" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Add backup"}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            placeholder="Label (e.g. Home Assistant)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "6px 10px", color: "var(--color-text-primary)", flex: 1, minWidth: 160 }}
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as BackupKind)}
            style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)", padding: "6px 10px" }}
          >
            <option value="homeassistant">Home Assistant</option>
            <option value="truenas-snapshot">TrueNAS snapshot</option>
            <option value="custom">Custom (webhook)</option>
          </select>
          {kind === "custom" ? (
            <input
              placeholder="https://trigger-url…"
              value={triggerUrl}
              onChange={(e) => setTriggerUrl(e.target.value)}
              style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "6px 10px", color: "var(--color-text-primary)", flex: 1, minWidth: 160 }}
            />
          ) : (
            <input
              placeholder="target reference"
              value={targetRef}
              onChange={(e) => setTargetRef(e.target.value)}
              style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "6px 10px", color: "var(--color-text-primary)", flex: 1, minWidth: 160 }}
            />
          )}
          <button className="btn btn--sm btn--primary" onClick={handleCreate}>Save</button>
        </div>
      )}

      {backups.length === 0 ? (
        <EmptyState title="No backups tracked yet" description="An admin can add Home Assistant, TrueNAS or a custom backup runner above." />
      ) : (
        <div className="row-list">
          {backups.map((b) => (
            <div className="row" key={b.id}>
              <span className="row__primary">
                {b.label}
                <div className="row__secondary">
                  {b.last_run_at ? `Last backup: ${formatRelativeTime(b.last_run_at)}` : "Never run"}
                </div>
              </span>
              <StatusBadge
                status={b.last_status === "success" ? "online" : b.last_status === "error" ? "offline" : "unknown"}
                label={b.last_status ? b.last_status.toUpperCase() : "PENDING"}
              />
              <div style={{ display: "flex", gap: 6 }}>
                {canRun && <ActionButton label="Run" level={1} onRun={() => runBackup.mutateAsync(b.id)} />}
                {isAdmin && (
                  <button className="btn btn--sm btn--ghost" onClick={() => removeBackup.mutate(b.id)}>Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Storage() {
  const { data: hostData, isLoading: hostLoading } = useHost("m710q");
  const { data: available } = useTruenasAvailable();
  const { data: poolsData } = usePools();
  const { data: datasetsData } = useDatasets();
  const { data: disksData } = useDisks();
  const runScrub = useRunScrub();
  const { push } = useToast();

  const host = hostData?.host;
  const pools = poolsData?.pools ?? [];
  const datasets = datasetsData?.datasets ?? [];
  const disks = disksData?.disks ?? [];

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Storage</div>
          <div className="page__subtitle">TrueNAS Scale · pools, disks, snapshots and backups</div>
        </div>
        <OpenLinkButton linkKey="truenas" label="Open TrueNAS" />
      </div>

      {hostLoading ? (
        <SkeletonGrid count={1} />
      ) : host ? (
        <div className="grid grid--hosts">
          <HostCard host={host} />
        </div>
      ) : null}

      {available?.available === false ? (
        <EmptyState
          title="TrueNAS API not configured"
          description="Set TRUENAS_ENABLED=true, TRUENAS_URL and TRUENAS_API_KEY to enable pools, disks, SMART and snapshots."
        />
      ) : (
        <>
          <div>
            <div className="section-title" style={{ marginBottom: 12 }}>Pools</div>
            {pools.length === 0 ? (
              <EmptyState title="No pools reported" />
            ) : (
              <div className="grid grid--hosts">
                {pools.map((p) => (
                  <StorageCard
                    key={p.id}
                    pool={p}
                    onScrub={() =>
                      runScrub
                        .mutateAsync(p.id)
                        .then(() => push("success", `Scrub started on ${p.name}`))
                        .catch((err) => push("error", err instanceof Error ? err.message : "Scrub failed"))
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {datasets.length > 0 && (
            <div className="card">
              <div className="section-title" style={{ marginBottom: 12 }}>Datasets</div>
              <div className="row-list">
                {datasets.map((d) => (
                  <div className="row" key={d.id}>
                    <span className="row__primary mono">{d.name}</span>
                    <span className="mono text-tertiary" style={{ width: 100 }}>{formatBytes(d.usedBytes)}</span>
                    <span className="mono text-tertiary" style={{ width: 100, textAlign: "right" }}>{formatBytes(d.availableBytes)} free</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="section-title" style={{ marginBottom: 12 }}>Disks</div>
            {disks.length === 0 ? (
              <EmptyState title="No disk data" />
            ) : (
              <div className="grid grid--hosts">
                {disks.map((d) => (
                  <DiskCard key={d.name} disk={d} />
                ))}
              </div>
            )}
          </div>

          <SnapshotsPanel />
        </>
      )}

      <BackupsPanel />
    </div>
  );
}
