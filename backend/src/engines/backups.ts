import { backupsRepo, type BackupRow } from "../db/repo.js";
import { callService } from "../integrations/homeassistant.js";
import { createSnapshot } from "../integrations/truenas.js";

// Executes a tracked backup (section 12) according to its kind and records
// the result on the row so Storage's Backups panel can show last
// status/duration/size. There is no single "backup API" shared by Home
// Assistant, TrueNAS and arbitrary custom scripts, so each kind maps to
// the most direct real mechanism available:
//   - homeassistant: calls the hassio.backup_full service (Supervisor).
//   - truenas-snapshot: creates a dated ZFS snapshot on the configured dataset.
//   - custom: POSTs to an admin-configured webhook and reads back an
//     optional { sizeBytes } from its JSON response.
export async function executeBackup(backup: BackupRow): Promise<void> {
  const start = Date.now();
  try {
    let sizeBytes: number | undefined;

    if (backup.kind === "homeassistant") {
      await callService("hassio", "backup_full", { name: backup.label });
    } else if (backup.kind === "truenas-snapshot") {
      if (!backup.target_ref) throw new Error("missing_target_ref");
      const name = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      await createSnapshot(backup.target_ref, name);
    } else if (backup.kind === "custom") {
      if (!backup.trigger_url) throw new Error("missing_trigger_url");
      const res = await fetch(backup.trigger_url, { method: "POST", signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`webhook http ${res.status}`);
      try {
        const body = (await res.json()) as any;
        if (typeof body?.sizeBytes === "number") sizeBytes = body.sizeBytes;
      } catch {
        // webhook may not return JSON - that's fine, success is still recorded
      }
    }

    backupsRepo.recordRun(backup.id, { status: "success", durationMs: Date.now() - start, sizeBytes });
  } catch (err) {
    backupsRepo.recordRun(backup.id, {
      status: "error",
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
