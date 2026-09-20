import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import { useCockpitLayout } from "../api/hooks";

// Per-user display settings edited on the Paramètres page and persisted in
// user_preferences.display_settings (see backend routes/preferences.ts).
export interface DisplaySettings {
  /** null = use DEFAULT_CRITICAL_SERVICE_IDS */
  criticalServiceIds: string[] | null;
  hiddenHostIds: string[];
  /** Load (CPU/RAM %) at which a value turns amber / red */
  loadWarn: number;
  loadCrit: number;
}

export const DEFAULT_CRITICAL_SERVICE_IDS = ["home-assistant", "adguard", "frigate", "npm", "prometheus", "truenas"];

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  criticalServiceIds: null,
  hiddenHostIds: [],
  loadWarn: 70,
  loadCrit: 85,
};

export function useDisplaySettings(): DisplaySettings {
  const { data } = useQuery({
    queryKey: ["preferences", "display"],
    queryFn: () => api.get<{ settings: Partial<DisplaySettings> | null }>("/preferences/display"),
  });
  // Merge over the defaults so a row saved before a field existed still works.
  return { ...DEFAULT_DISPLAY_SETTINGS, ...(data?.settings ?? {}) };
}

export function useSetDisplaySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: DisplaySettings) => api.post("/preferences/display", settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preferences", "display"] }),
  });
}

// "warn" / "crit" / "" for a utilisation percentage, using the user's thresholds.
export function loadTone(v: number | undefined, s: Pick<DisplaySettings, "loadWarn" | "loadCrit">): "warn" | "crit" | "" {
  if (v === undefined || v === null || Number.isNaN(v)) return "";
  return v > s.loadCrit ? "crit" : v > s.loadWarn ? "warn" : "";
}

// ---------- Cockpit sections (order + visibility) ----------
export type CockpitSectionId = "quickActions" | "machines" | "services" | "resources";

export interface CockpitSection {
  id: CockpitSectionId;
  label: string;
}

export const DEFAULT_SECTIONS: CockpitSection[] = [
  { id: "quickActions", label: "Actions rapides" },
  { id: "machines", label: "Machines" },
  { id: "services", label: "Services critiques" },
  { id: "resources", label: "Ressources globales et activité" },
];

// The saved layout, reconciled with the current section list: unknown ids are
// dropped and sections added since the layout was saved are appended visible.
export function useOrderedSections() {
  const { data } = useCockpitLayout();
  const layout = data?.layout;
  if (!layout || layout.length === 0) return DEFAULT_SECTIONS.map((s) => ({ ...s, visible: true }));
  const byId = new Map(DEFAULT_SECTIONS.map((s) => [s.id as string, s]));
  const ordered: (CockpitSection & { visible: boolean })[] = [];
  for (const l of layout) {
    const def = byId.get(l.id);
    if (def) ordered.push({ ...def, visible: l.visible });
  }
  for (const s of DEFAULT_SECTIONS) {
    if (!ordered.some((o) => o.id === s.id)) ordered.push({ ...s, visible: true });
  }
  return ordered;
}
