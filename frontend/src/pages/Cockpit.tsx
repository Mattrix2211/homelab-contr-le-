import { useState } from "react";
import { useHosts, useServices, useContainers, useAlerts, useEvents } from "../api/hooks";
import { HostCard } from "../components/HostCard";
import { ServiceCard } from "../components/ServiceCard";
import { MetricCard } from "../components/MetricCard";
import { AlertCard } from "../components/AlertCard";
import { EventRow } from "../components/EventRow";
import { EmptyState } from "../components/EmptyState";
import { SkeletonGrid } from "../components/Skeleton";
import { ResourceDrawer, DrawerMetricRow } from "../components/ResourceDrawer";
import { formatPercent, formatUptime } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";

const CRITICAL_SERVICE_IDS = ["home-assistant", "adguard", "frigate", "npm", "prometheus", "truenas"];

export function Cockpit() {
  const { data: hostsData, isLoading: hostsLoading } = useHosts();
  const { data: servicesData, isLoading: servicesLoading } = useServices();
  const { data: containersData } = useContainers();
  const { data: alertsData } = useAlerts();
  const { data: eventsData } = useEvents(12);
  const [openHostId, setOpenHostId] = useState<string | null>(null);

  const hosts = hostsData?.hosts ?? [];
  const services = servicesData?.services ?? [];
  const containers = containersData?.containers ?? [];
  const alerts = alertsData?.alerts ?? [];
  const events = eventsData?.events ?? [];

  const hostsOnline = hosts.filter((h) => h.status === "online").length;
  const servicesOnline = services.filter((s) => s.status === "online").length;
  const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;
  const warnings = alerts.filter((a) => a.severity === "warning").length;

  const overallHealthy = criticalAlerts === 0 && hostsOnline === hosts.length && servicesOnline === services.length;
  const overallStatus = criticalAlerts > 0 ? "offline" : warnings > 0 ? "warning" : overallHealthy ? "online" : "unknown";

  const criticalServices = services.filter((s) => CRITICAL_SERVICE_IDS.includes(s.id));

  const runningContainers = containers.filter((c) => c.state === "running").length;
  const avgCpu = hosts.length
    ? hosts.reduce((sum, h) => sum + (h.cpuPercent ?? 0), 0) / hosts.filter((h) => h.cpuPercent !== undefined).length || 0
    : 0;
  const avgRam = hosts.length
    ? hosts.reduce((sum, h) => sum + (h.ramPercent ?? 0), 0) / hosts.filter((h) => h.ramPercent !== undefined).length || 0
    : 0;

  const openHost = hosts.find((h) => h.id === openHostId);

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Cockpit</div>
          <div className="page__subtitle">Monitor → Understand → Act</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <StatusBadge status={overallStatus} label={overallHealthy ? "HEALTHY" : criticalAlerts > 0 ? "ATTENTION NEEDED" : "MONITOR"} />
          <span className="mono text-secondary">
            {servicesOnline} / {services.length} services online
          </span>
          <span className="mono text-secondary">
            {hostsOnline} / {hosts.length} hosts online
          </span>
          <span className="mono text-secondary">{criticalAlerts} critical alerts</span>
          <span className="mono text-secondary">{warnings} warnings</span>
        </div>
      </div>

      {alerts.length > 0 && (
        <div>
          <div className="section-title" style={{ marginBottom: 12 }}>Alerts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="section-title" style={{ marginBottom: 12 }}>Machines</div>
        {hostsLoading ? (
          <SkeletonGrid />
        ) : hosts.length === 0 ? (
          <EmptyState title="No hosts configured" />
        ) : (
          <div className="grid grid--hosts">
            {hosts.map((h) => (
              <HostCard key={h.id} host={h} onClick={() => setOpenHostId(h.id)} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="section-title" style={{ marginBottom: 12 }}>Critical services</div>
        {servicesLoading ? (
          <SkeletonGrid count={4} height={130} />
        ) : (
          <div className="grid grid--services">
            {criticalServices.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid--two">
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>Global resources</div>
          <div className="grid grid--metrics">
            <MetricCard label="Avg CPU" value={formatPercent(avgCpu)} tone={avgCpu > 85 ? "crit" : avgCpu > 70 ? "warn" : undefined} />
            <MetricCard label="Avg RAM" value={formatPercent(avgRam)} tone={avgRam > 85 ? "crit" : avgRam > 70 ? "warn" : undefined} />
            <MetricCard label="Containers" value={`${runningContainers}/${containers.length}`} />
            <MetricCard label="Services" value={`${servicesOnline}/${services.length}`} />
          </div>
        </div>

        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>Recent activity</div>
          {events.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <div className="row-list">
              {events.slice(0, 8).map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>

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
            {openHost.tempC !== undefined && <DrawerMetricRow label="Temperature" value={`${Math.round(openHost.tempC)}°C`} />}
            <DrawerMetricRow label="Uptime" value={formatUptime(openHost.uptimeSeconds)} />
          </div>
        </ResourceDrawer>
      )}
    </div>
  );
}
