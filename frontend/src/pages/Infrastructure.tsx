import { useState } from "react";
import { useHosts, useServices, useProxmoxGuests } from "../api/hooks";
import { HostCard } from "../components/HostCard";
import { StatusBadge } from "../components/StatusBadge";
import { ResourceDrawer, DrawerMetricRow } from "../components/ResourceDrawer";
import { GuestRow } from "../components/GuestRow";
import { EmptyState } from "../components/EmptyState";
import { SkeletonGrid } from "../components/Skeleton";
import { formatPercent, formatUptime } from "../lib/format";
import type { HostStatus } from "../api/types";

function TopologyNode({ label, status, sub }: { label: string; status?: HostStatus["status"]; sub?: string }) {
  return (
    <div className="card" style={{ padding: "10px 16px", display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13 }}>{label}</span>
      {sub && <span className="text-tertiary" style={{ fontSize: 10.5 }}>{sub}</span>}
      {status && <StatusBadge status={status} />}
    </div>
  );
}

export function Infrastructure() {
  const { data: hostsData, isLoading } = useHosts();
  const { data: servicesData } = useServices();
  const { data: guestsData } = useProxmoxGuests();
  const [openHostId, setOpenHostId] = useState<string | null>(null);
  const [view, setView] = useState<"topology" | "machines">("topology");

  const hosts = hostsData?.hosts ?? [];
  const services = servicesData?.services ?? [];
  const guests = guestsData?.guests ?? [];
  const openHost = hosts.find((h) => h.id === openHostId);
  const openHostServices = services.filter((s) => s.hostId === openHostId);
  // The registry only models one Proxmox node (M83) for now, so every
  // guest returned by the API belongs to it.
  const openHostGuests = openHostId === "m83" ? guests : [];

  const m83 = hosts.find((h) => h.id === "m83");
  const rpi = hosts.find((h) => h.id === "rpi");
  const m710q = hosts.find((h) => h.id === "m710q");

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Infrastructure</div>
          <div className="page__subtitle">Physical topology and machine detail</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn btn--sm ${view === "topology" ? "btn--primary" : "btn--ghost"}`} onClick={() => setView("topology")}>
            Topology
          </button>
          <button className={`btn btn--sm ${view === "machines" ? "btn--primary" : "btn--ghost"}`} onClick={() => setView("machines")}>
            Machines
          </button>
        </div>
      </div>

      {view === "topology" ? (
        <div className="card" style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, minWidth: 560, padding: "16px 0" }}>
            <TopologyNode label="INTERNET" />
            <div className="text-tertiary mono">│</div>
            <TopologyNode label="FREEBOX" />
            <div className="text-tertiary mono">│</div>
            <div style={{ display: "flex", gap: 48 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }} onClick={() => setOpenHostId("rpi")}>
                <TopologyNode label="RPI" status={rpi?.status} sub="Domotique" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div onClick={() => setOpenHostId("m83")}>
                  <TopologyNode label="M83" status={m83?.status} sub="Proxmox VE" />
                </div>
                <div className="text-tertiary mono">│</div>
                <TopologyNode label="LXC 100" sub="Docker · 192.168.1.24" />
                <div className="text-tertiary mono">│</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
                  {services.filter((s) => s.hostId === "m83" && s.critical).slice(0, 4).map((s) => (
                    <TopologyNode key={s.id} label={s.name} status={s.status} />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }} onClick={() => setOpenHostId("m710q")}>
                <TopologyNode label="M710Q" status={m710q?.status} sub="TrueNAS Scale" />
              </div>
            </div>
          </div>
          <div className="text-tertiary" style={{ fontSize: 12, textAlign: "center", marginTop: 8 }}>
            Click a node to inspect it. Colors reflect live status.
          </div>
        </div>
      ) : isLoading ? (
        <SkeletonGrid />
      ) : (
        <div className="grid grid--hosts">
          {hosts.map((h) => (
            <HostCard key={h.id} host={h} onClick={() => setOpenHostId(h.id)} />
          ))}
        </div>
      )}

      {openHost && (
        <ResourceDrawer
          title={openHost.name}
          subtitle={`${openHost.role} · ${openHost.ip}`}
          status={openHost.status}
          onClose={() => setOpenHostId(null)}
        >
          <div className="drawer__section">
            <DrawerMetricRow label="CPU" value={formatPercent(openHost.cpuPercent)} />
            <DrawerMetricRow label="RAM" value={formatPercent(openHost.ramPercent)} />
            <DrawerMetricRow label="Uptime" value={formatUptime(openHost.uptimeSeconds)} />
          </div>
          {openHostServices.length > 0 && (
            <div className="drawer__section">
              <div className="section-title" style={{ marginBottom: 8 }}>Services on this host</div>
              <div className="row-list">
                {openHostServices.map((s) => (
                  <div className="row" key={s.id}>
                    <span className="row__primary">{s.name}</span>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {openHostId === "m83" && (
            <div className="drawer__section">
              <div className="section-title" style={{ marginBottom: 8 }}>Virtual machines & LXC</div>
              {openHostGuests.length === 0 ? (
                <EmptyState title="No VM/LXC data" description="Configure PROXMOX_ENABLED and credentials to manage guests here." />
              ) : (
                <div className="row-list">
                  {openHostGuests.map((g) => (
                    <GuestRow key={`${g.type}:${g.vmid}`} guest={g} />
                  ))}
                </div>
              )}
            </div>
          )}
        </ResourceDrawer>
      )}
    </div>
  );
}
