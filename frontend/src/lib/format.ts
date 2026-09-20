export function formatUptime(seconds?: number): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} j ${String(h).padStart(2, "0")} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m} min`;
}

export function formatPercent(v?: number): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return `${Math.round(v)} %`;
}

// Docker reports container CPU as a share of ONE core, so a busy multi-threaded
// container legitimately exceeds 100%. Say how many cores that is.
export function cpuCoresHint(v?: number): string | null {
  if (v === undefined || v === null || Number.isNaN(v) || v <= 100) return null;
  return `≈${(v / 100).toFixed(1)} cœurs`;
}

// Service categories come from the backend registry in English/mixed form.
const CATEGORY_LABELS: Record<string, string> = {
  domotique: "domotique",
  platform: "plateforme",
  network: "réseau",
  media: "média",
  monitoring: "supervision",
  storage: "stockage",
};

export function formatCategory(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function formatMb(mb?: number): string {
  if (mb === undefined || mb === null || Number.isNaN(mb)) return "—";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "à l’instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `il y a ${diffHour} h`;
  const diffDay = Math.floor(diffHour / 24);
  return `il y a ${diffDay} j`;
}

export function formatClock(iso: string): string {
  const date = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
