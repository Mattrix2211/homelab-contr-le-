import { useHost } from "../api/hooks";
import { HostCard } from "../components/HostCard";
import { OpenLinkButton } from "../components/OpenLinkButton";
import { SkeletonGrid } from "../components/Skeleton";

export function Storage() {
  const { data, isLoading } = useHost("m710q");
  const host = data?.host;

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Storage</div>
          <div className="page__subtitle">TrueNAS Scale · pools, disks and backups</div>
        </div>
        <OpenLinkButton linkKey="truenas" label="Open TrueNAS" />
      </div>

      {isLoading ? (
        <SkeletonGrid count={1} />
      ) : host ? (
        <div className="grid grid--hosts">
          <HostCard host={host} />
        </div>
      ) : null}

      <div className="placeholder-panel">
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 8 }}>
          Pool, dataset, SMART and backup detail — Phase 2
        </div>
        <p className="text-secondary" style={{ maxWidth: 520, margin: "0 auto" }}>
          The TrueNAS integration currently surfaces overall pool health on the host card above. Per-pool
          capacity, per-disk SMART/temperature, snapshot management and the 3-2-1 backup view (sections 11-12)
          connect to the TrueNAS API in Phase 2 — configure <code className="mono">TRUENAS_URL</code> and{" "}
          <code className="mono">TRUENAS_API_KEY</code> in Administration to enable it. Until then, use
          "Open TrueNAS" for full control.
        </p>
      </div>
    </div>
  );
}
