import { API_URL } from "@/config/api";

export type PatientPhaseFlag =
  | "patient_phase_1"
  | "patient_phase_2"
  | "patient_phase_3"
  | "patient_phase_4";

export type ModuleFeatureFlag =
  | "clinical_colombia"
  | "pwa_offline"
  | "wearables"
  | "gamification"
  | "nutritionist_advanced_hub";

export type FeatureFlagKey = PatientPhaseFlag | ModuleFeatureFlag;

export const PATIENT_PHASE_LABELS: Record<PatientPhaseFlag, string> = {
  patient_phase_1: "Fase 1 — Adherencia y notificaciones",
  patient_phase_2: "Fase 2 — Recomendaciones y documentos",
  patient_phase_3: "Fase 3 — Aprendizaje y hábitos",
  patient_phase_4: "Fase 4 — Diario y sustituciones",
};

export const MODULE_FEATURE_LABELS: Record<ModuleFeatureFlag, string> = {
  clinical_colombia: "Clínica Colombia (MIPRESS, RIPS)",
  pwa_offline: "PWA / offline",
  wearables: "Wearables",
  gamification: "Retos y gamificación",
  nutritionist_advanced_hub: "Centro avanzado nutricionista",
};

/** Ruta del panel paciente → flag de fase */
export const ROUTE_PHASE_FLAG: Record<string, PatientPhaseFlag> = {
  "/patient/adherence": "patient_phase_1",
  "/patient/notifications": "patient_phase_1",
  "/patient/recommendations": "patient_phase_2",
  "/patient/shopping-list": "patient_phase_2",
  "/patient/documents": "patient_phase_2",
  "/patient/learn": "patient_phase_3",
  "/patient/program": "patient_phase_3",
  "/patient/habits": "patient_phase_3",
  "/patient/challenges": "patient_phase_3",
  "/patient/food-diary": "patient_phase_4",
  "/patient/substitutions": "patient_phase_4",
};

/** Ruta → flag de módulo adicional (paciente) */
export const ROUTE_MODULE_FLAG: Record<string, ModuleFeatureFlag> = {
  "/patient/challenges": "gamification",
  "/patient/habits": "gamification",
  "/patient/food-diary": "pwa_offline",
};

export const ADMIN_ROUTE_MODULE_FLAG: Record<string, ModuleFeatureFlag> = {
  "/clinical": "clinical_colombia",
  "/interventions": "clinical_colombia",
  "/clinical-hub": "nutritionist_advanced_hub",
  "/analytics": "nutritionist_advanced_hub",
};

/** Busca flag de fase/módulo por prefijo de ruta (rutas anidadas) */
function resolveRouteFlag<T extends string>(
  path: string,
  map: Record<string, T>,
): T | undefined {
  if (map[path]) return map[path];
  const match = Object.keys(map)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => path.startsWith(prefix));
  return match ? map[match] : undefined;
}

export function isRouteEnabled(path: string, flags: Record<string, boolean>): boolean {
  const phaseFlag = resolveRouteFlag(path, ROUTE_PHASE_FLAG);
  if (phaseFlag && flags[phaseFlag] === false) return false;
  const moduleFlag = resolveRouteFlag(path, ROUTE_MODULE_FLAG);
  if (moduleFlag && flags[moduleFlag] === false) return false;
  return true;
}

export function isAdminRouteEnabled(path: string, flags: Record<string, boolean>): boolean {
  const moduleFlag = resolveRouteFlag(path, ADMIN_ROUTE_MODULE_FLAG);
  if (moduleFlag && flags[moduleFlag] === false) return false;
  return true;
}

export function defaultFlags(): Record<FeatureFlagKey, boolean> {
  return {
    patient_phase_1: true,
    patient_phase_2: true,
    patient_phase_3: true,
    patient_phase_4: true,
    clinical_colombia: true,
    pwa_offline: true,
    wearables: true,
    gamification: true,
    nutritionist_advanced_hub: true,
  };
}

export async function fetchPatientFeatureFlags(token?: string | null): Promise<Record<string, boolean>> {
  try {
    const res = await fetch(`${API_URL}/patient/feature-flags`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return defaultFlags();
    const data = await res.json();
    return { ...defaultFlags(), ...(data.flags || {}) };
  } catch {
    return defaultFlags();
  }
}

export async function fetchNutritionistFeatureFlags(token?: string | null): Promise<Record<string, boolean>> {
  try {
    const res = await fetch(`${API_URL}/nutritionist/feature-flags`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return defaultFlags();
    const data = await res.json();
    return { ...defaultFlags(), ...(data.flags || {}) };
  } catch {
    return defaultFlags();
  }
}

/** Refresca flags al volver a la pestaña (cambios superadmin sin redeploy) */
export function subscribeFeatureFlagRefresh(
  fetcher: (token?: string | null) => Promise<Record<string, boolean>>,
  onUpdate: (flags: Record<string, boolean>) => void,
): () => void {
  const refresh = () => {
    const token = localStorage.getItem("userToken");
    fetcher(token).then(onUpdate).catch(() => {});
  };
  window.addEventListener("focus", refresh);
  return () => window.removeEventListener("focus", refresh);
}
