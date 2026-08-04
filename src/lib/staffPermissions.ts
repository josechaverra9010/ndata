/** Permisos granulares del staff nutricionista (sincronizado con backend STAFF_ROLES). */

export type StaffRole =
  | "nutritionist"
  | "clinical_assistant"
  | "senior_nutritionist"
  | "org_admin";

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  nutritionist: "Nutricionista",
  clinical_assistant: "Asistente clínico",
  senior_nutritionist: "Nutricionista senior",
  org_admin: "Admin organización (EPS)",
};

export interface StaffPermissions {
  staff_role: StaffRole;
  staff_role_label: string;
  permissions: string[];
  organization_id?: number | null;
  site_id?: number | null;
}

export function canAccess(permissions: string[] | undefined, key: string): boolean {
  if (!permissions?.length) return true;
  if (permissions.includes("*")) return true;
  return permissions.includes(key);
}

/** Rutas admin restringidas por permiso */
export const ADMIN_ROUTE_PERMISSION: Record<string, string> = {
  "/admin": "patients",
  "/patients": "patients",
  "/consultation": "consultation",
  "/recipes": "recipes",
  "/weekly-menus": "menus",
  "/appointments": "appointments",
  "/progress": "progress",
  "/analytics": "analytics",
  "/clinical": "clinical",
  "/messages": "messages",
  "/meal-plans": "plans",
};

export function routeAllowed(path: string, permissions: string[]): boolean {
  if (permissions.includes("*")) return true;
  const base = "/" + path.split("/").filter(Boolean)[0];
  const perm = ADMIN_ROUTE_PERMISSION[base] || ADMIN_ROUTE_PERMISSION["/" + path.split("/")[1]];
  if (!perm) return true;
  if (permissions.includes(perm)) return true;
  if (perm === "patients" && permissions.includes("patients_org")) return true;
  return false;
}
