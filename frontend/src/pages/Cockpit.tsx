import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
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
import {
  DEFAULT_CRITICAL_SERVICE_IDS,
  loadTone,
  useDisplaySettings,
  useOrderedSections,
  type CockpitSectionId,
} from "../lib/displaySettings";
import { StatusBadge } from "../components/StatusBadge";
import { QuickActionsPanel } from "../components/QuickActionsPanel";

type SummaryTone = "ok" | "warn" | "crit" | "muted";

// all up = green, none up = red, in between = amber
function ratioTone(online: number, total: number): SummaryTone {
  if (total === 0) return "muted";
  return online === total ? "ok" : online === 0 ? "crit" : "warn";
}

function SummaryStat({ label, value, total, tone }: { label: string; value: number; total?: number; tone: SummaryTone }) {
  return (
    <div className="summary__stat">
      <span className={`summary__value ${tone}`}>
        {value}
        {total !== undefined && <small> / {total}</small>}
      </span>
      <span className="summary__label">{label}</span>
    </div>
  );
}

export function Cockpit() {
  const { data: hostsData, isLoading: hostsLoading } = useHosts();
  const { data: servicesData, isLoading: servicesLoading } = useServices();
  const { data: containersData } = useContainers();
  const { data: alertsData } = useAlerts();
  const { data: eventsData } = useEvents(12);
  const [openHostId, setOpenHostId] = useState<string | null>(null);
  const sections = useOrderedSections();
  const display = useDisplaySettings();

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

  const criticalIds = display.criticalServiceIds ?? DEFAULT_CRITICAL_SERVICE_IDS;
  const criticalServices = services.filter((s) => criticalIds.includes(s.id));
  const visibleHosts = hosts.filter((h) => !display.hiddenHostIds.includes(h.id));

  const runningContainers = containers.filter((c) => c.state === "running").length;
  const avgCpu = hosts.length
    ? hosts.reduce((sum, h) => sum + (h.cpuPercent ?? 0), 0) / hosts.filter((h) => h.cpuPercent !== undefined).length || 0
    : 0;
  const avgRam = hosts.length
    ? hosts.reduce((sum, h) => sum + (h.ramPercent ?? 0), 0) / hosts.filter((h) => h.ramPercent !== undefined).length || 0
    : 0;

  const openHost = hosts.find((h) => h.id === openHostId);
  const isVisible = (id: CockpitSectionId) => sections.find((s) => s.id === id)?.visible !== false;

  const sectionElements: Record<CockpitSectionId, ReactNode> = {
    quickActions: <QuickActionsPanel />,
    machines: (
      <div>
        <div className="section-title" style={{ marginBottom: 12 }}>Machines</div>
        {hostsLoading ? (
          <SkeletonGrid />
        ) : visibleHosts.length === 0 ? (
          <EmptyState title="Aucune machine configurée" />
        ) : (
          <div className="grid grid--hosts">
            {visibleHosts.map((h) => (
              <HostCard key={h.id} host={h} onClick={() => setOpenHostId(h.id)} />
            ))}
          </div>
        )}
      </div>
    ),
    services: (
      <div>
        <div className="section-title" style={{ marginBottom: 12 }}>Services critiques</div>
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
    ),
    resources: (
      <div className="grid grid--two">
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>Ressources globales</div>
          <div className="grid grid--metrics">
            <MetricCard label="CPU moyen" value={formatPercent(avgCpu)} tone={loadTone(avgCpu, display) || undefined} />
            <MetricCard label="RAM moyenne" value={formatPercent(avgRam)} tone={loadTone(avgRam, display) || undefined} />
            <MetricCard label="Conteneurs" value={`${runningContainers}/${containers.length}`} />
            <MetricCard label="Services" value={`${servicesOnline}/${services.length}`} />
          </div>
        </div>

        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>Activité récente</div>
          {events.length === 0 ? (
            <EmptyState title="Aucune activité pour l’instant" />
          ) : (
            <div className="row-list">
              {events.slice(0, 8).map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>
    ),
  };

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <div className="page__title">Cockpit</div>
          <div className="page__subtitle">Surveiller → Comprendre → Agir</div>
        </div>
        <Link className="btn btn--sm btn--ghost" to="/parametres">
          Personnaliser
        </Link>
      </div>

      <div className="card">
        <div className="summary">
          <div className="summary__state">
            <StatusBadge status={overallStatus} label={overallHealthy ? "TOUT VA BIEN" : criticalAlerts > 0 ? "ATTENTION REQUISE" : "SURVEILLANCE"} />
          </div>
          <SummaryStat label="Services en ligne" value={servicesOnline} total={services.length} tone={ratioTone(servicesOnline, services.length)} />
          <SummaryStat label="Machines en ligne" value={hostsOnline} total={hosts.length} tone={ratioTone(hostsOnline, hosts.length)} />
          <SummaryStat label="Alertes critiques" value={criticalAlerts} tone={criticalAlerts > 0 ? "crit" : "muted"} />
          <SummaryStat label="Avertissements" value={warnings} tone={warnings > 0 ? "warn" : "muted"} />
        </div>
      </div>

      {alerts.length > 0 && (
        <div>
          <div className="section-title" style={{ marginBottom: 12 }}>Alertes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        </div>
      )}

      {sections.filter((s) => isVisible(s.id)).map((s) => (
        <div key={s.id}>{sectionElements[s.id]}</div>
      ))}

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
            {openHost.tempC !== undefined && <DrawerMetricRow label="Température" value={`${Math.round(openHost.tempC)}°C`} />}
            <DrawerMetricRow label="Actif depuis" value={formatUptime(openHost.uptimeSeconds)} />
          </div>
        </ResourceDrawer>
      )}
    </div>
  );
}
