import { getFoodNutrientsForGroup, isSuplementoGrupoKey } from "@/lib/foodNutrients";

export interface Fase3NutrientTargets {
  kcal: number;
  prot: number;
  grasa: number;
  gs: number;
  gm: number;
  gp: number;
  col: number;
  chos: number;
  fd: number;
}

const NUTRIENT_KEYS: (keyof Fase3NutrientTargets)[] = [
  "kcal",
  "prot",
  "grasa",
  "gs",
  "gm",
  "gp",
  "col",
  "chos",
  "fd",
];

const WEIGHTS: Record<keyof Fase3NutrientTargets, number> = {
  kcal: 1,
  prot: 4,
  grasa: 2.5,
  chos: 2.5,
  fd: 2,
  gs: 1,
  gm: 0.8,
  gp: 0.8,
  col: 0.5,
};

type NutrientProfile = Fase3NutrientTargets;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function findGroup(grupos: string[], pattern: RegExp): string | undefined {
  return grupos.find((g) => pattern.test(g) && !isSuplementoGrupoKey(g));
}

function zeroTotals(): NutrientProfile {
  return { kcal: 0, prot: 0, grasa: 0, gs: 0, gm: 0, gp: 0, col: 0, chos: 0, fd: 0 };
}

function totalsFromPortions(
  portions: Record<string, number>,
  getNutrients: (g: string) => NutrientProfile | undefined
): NutrientProfile {
  const totals = zeroTotals();
  for (const [grupo, porciones] of Object.entries(portions)) {
    if (porciones <= 0) continue;
    const nutrients = getNutrients(grupo);
    if (!nutrients) continue;
    for (const key of NUTRIENT_KEYS) {
      totals[key] += nutrients[key] * porciones;
    }
  }
  return totals;
}

function initialAllocation(
  grupos: string[],
  targets: Fase3NutrientTargets,
  getNutrients: (g: string) => NutrientProfile | undefined
): Record<string, number> {
  const portions: Record<string, number> = {};
  for (const g of grupos) portions[g] = 0;

  const verduras = findGroup(grupos, /Verduras y hortalizas/i);
  const frutas = findGroup(grupos, /Frutas adultos/i);
  const carne = findGroup(grupos, /Carnes magras/i);
  const legumbre =
    findGroup(grupos, /Leguminosas adultos/i) || findGroup(grupos, /Leguminosas/i);
  const leche =
    findGroup(grupos, /Leches semidescremadas/i) ||
    findGroup(grupos, /Leches descremadas/i) ||
    findGroup(grupos, /Leches enteras/i);
  const cereales =
    findGroup(grupos, /Cereales adultos/i) || findGroup(grupos, /Cereales/i);
  const raices = findGroup(grupos, /Raíces, tubérculos y plátanos adultos/i);
  const harinas = findGroup(grupos, /Promedio harinas adultos/i);
  const grasas = findGroup(grupos, /Promedio grasas adultos/i);
  const nueces = findGroup(grupos, /Nueces adultos/i);

  if (verduras) {
    const nv = getNutrients(verduras);
    portions[verduras] =
      nv && nv.fd > 0 ? clamp(targets.fd / nv.fd, 2, 6) : 3;
  }
  if (frutas) portions[frutas] = clamp(targets.chos > 250 ? 3 : 2, 1, 4);

  const protBudget = Math.max(0, targets.prot);
  if (carne) {
    const nc = getNutrients(carne);
    if (nc && nc.prot > 0) portions[carne] = (protBudget * 0.45) / nc.prot;
  }
  if (legumbre) {
    const nl = getNutrients(legumbre);
    if (nl && nl.prot > 0) portions[legumbre] = (protBudget * 0.35) / nl.prot;
  }
  if (leche) {
    const nm = getNutrients(leche);
    if (nm && nm.prot > 0) portions[leche] = (protBudget * 0.2) / nm.prot;
  }

  let current = totalsFromPortions(portions, getNutrients);
  const chosNeeded = Math.max(0, targets.chos - current.chos);
  const carbGroups = [cereales, raices, harinas].filter(Boolean) as string[];
  if (carbGroups.length && chosNeeded > 0) {
    const share = chosNeeded / carbGroups.length;
    for (const g of carbGroups) {
      const nc = getNutrients(g);
      if (nc && nc.chos > 0) portions[g] += share / nc.chos;
    }
  }

  current = totalsFromPortions(portions, getNutrients);
  const fatNeeded = Math.max(0, targets.grasa - current.grasa);
  if (grasas) {
    const ng = getNutrients(grasas);
    if (ng && ng.grasa > 0) portions[grasas] = (fatNeeded * 0.75) / ng.grasa;
  }
  if (nueces && fatNeeded > 0) {
    const nn = getNutrients(nueces);
    if (nn && nn.grasa > 0) portions[nueces] = (fatNeeded * 0.25) / nn.grasa;
  }

  return portions;
}

function refinePortions(
  portions: Record<string, number>,
  targets: Fase3NutrientTargets,
  getNutrients: (g: string) => NutrientProfile | undefined,
  grupos: string[]
): Record<string, number> {
  const adjustable = grupos.filter((g) => getNutrients(g) && !isSuplementoGrupoKey(g));
  const out = { ...portions };

  for (let iter = 0; iter < 60; iter++) {
    const totals = totalsFromPortions(out, getNutrients);
    const errors = zeroTotals();
    for (const key of NUTRIENT_KEYS) {
      errors[key] = targets[key] - totals[key];
    }

    if (totals.kcal > 10 && Math.abs(errors.kcal) > targets.kcal * 0.02) {
      const factor = Math.pow(targets.kcal / totals.kcal, 0.3);
      for (const g of adjustable) {
        if (out[g] > 0) out[g] *= factor;
      }
    }

    let maxStep = 0;
    for (const g of adjustable) {
      const n = getNutrients(g);
      if (!n) continue;

      let score = 0;
      let norm = 0;
      for (const key of NUTRIENT_KEYS) {
        score += errors[key] * WEIGHTS[key] * n[key];
        norm += n[key] * n[key];
      }
      if (norm <= 0) continue;

      const step = (score / norm) * 0.1;
      if (Math.abs(step) > 0.005) {
        out[g] = Math.max(0, out[g] + step);
        maxStep = Math.max(maxStep, Math.abs(step));
      }
    }

    if (maxStep < 0.02) break;
  }

  for (const g of Object.keys(out)) {
    if (out[g] < 0.05) out[g] = 0;
    else out[g] = Math.round(out[g] * 10) / 10;
  }

  return out;
}

/** Sugiere porciones por grupo para acercarse a los requerimientos de Fase 2. */
export function suggestBalancedFase3Portions(
  grupos: string[],
  targets: Fase3NutrientTargets
): Record<string, number> | null {
  if (!(targets.kcal > 0)) return null;

  const getNutrients = (nombre: string): NutrientProfile | undefined => {
    const row = getFoodNutrientsForGroup(nombre);
    if (!row) return undefined;
    return {
      kcal: row.kcal ?? 0,
      prot: row.prot ?? 0,
      grasa: row.grasa ?? 0,
      gs: row.gs ?? 0,
      gm: row.gm ?? 0,
      gp: row.gp ?? 0,
      col: row.col ?? 0,
      chos: row.chos ?? 0,
      fd: row.fd ?? 0,
    };
  };

  let portions = initialAllocation(grupos, targets, getNutrients);
  portions = refinePortions(portions, targets, getNutrients, grupos);
  return portions;
}

export function fase3TargetsFromForm(formData: Record<string, unknown>): Fase3NutrientTargets {
  const num = (key: string) => parseFloat(String(formData[key] ?? "")) || 0;
  return {
    kcal: num("total_calorias_f2"),
    prot: num("proteinas_gramos_f2"),
    grasa: num("grasas_gramos_f2"),
    gs: num("grasas_gs_gramos"),
    gm: num("grasas_gm_gramos"),
    gp: num("grasas_gp_gramos"),
    col: num("grasas_colesterol"),
    chos: num("cho_gramos_f2"),
    fd: num("total_fibra") || 25,
  };
}
