/** Parsea fases del plan guardadas como JSON string u objeto. */
export function parsePlanPhase<T = Record<string, unknown>>(value: unknown): T | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") return value as T;
  return null;
}

export function hydrateMealPlanPhases<T extends Record<string, unknown>>(plan: T): T {
  return {
    ...plan,
    fase_1: parsePlanPhase(plan.fase_1),
    fase_2: parsePlanPhase(plan.fase_2),
    fase_3: parsePlanPhase(plan.fase_3),
    fase_4: parsePlanPhase(plan.fase_4),
  };
}

const PLAN_TYPE_LABELS: Record<string, string> = {
  adulto: "Adulto",
  deportista: "Deportista",
  pediatria: "Pediatría",
  gestante: "Gestante",
  gestante_adolescente: "Gestante adolescente",
  hospitalizado: "Hospitalizado",
  geriatrico: "Geriátrico",
};

/** Texto de diagnóstico / evaluación para resumen clínico. */
export function planDiagnosticoResumen(
  f1: Record<string, unknown> | null,
  plan?: { description?: string; category?: string; tipo?: string }
): string {
  const parts: string[] = [];
  const tipo =
    (f1?.tipo_fase as string) ||
    (f1?.tipo_plan as string) ||
    plan?.tipo ||
    "";
  if (tipo) {
    parts.push(`Tipo de plan: ${PLAN_TYPE_LABELS[tipo] || tipo}`);
  }
  if (plan?.category) parts.push(`Categoría: ${plan.category}`);
  if (plan?.description?.trim()) parts.push(plan.description.trim());

  const evalKeys = [
    "evaluacion_nutricional",
    "diagnostico_nutricional",
    "diagnostico_pes",
    "clasificacion_antropometrica",
    "clasificacion_aks",
    "pediatria_diagnostico",
    "gestante_diagnostico",
  ];
  for (const key of evalKeys) {
    const v = f1?.[key];
    if (typeof v === "string" && v.trim()) {
      parts.push(v.trim());
      break;
    }
  }
  return parts.join("\n\n") || "Sin diagnóstico registrado en el plan.";
}

export function planRequerimientoEnergeticoKcal(
  f1: Record<string, unknown> | null,
  fallbackCalories?: number
): number | null {
  const raw = f1?.requerimiento_energetico ?? f1?.requerimiento_energetico_total;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  if (fallbackCalories && fallbackCalories > 0) return fallbackCalories;
  return null;
}

function phaseHasValue(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "" && v.trim() !== "---";
  if (typeof v === "number") return !Number.isNaN(v);
  return true;
}

const FORMULA_LABELS: Record<string, string> = {
  schofield: "FAO / Schofield",
  harris_benedict: "Harris-Benedict",
  mifflin: "Mifflin-St Jeor",
  rango_calorico: "Método del pulgar (kcal/kg)",
  ireton_jones: "Ireton-Jones",
};

const GENERO_LABELS: Record<string, string> = {
  masculino: "Masculino",
  femenino: "Femenino",
};

/** Campos Fase 1 (misma lógica que PDF / detalle del plan). */
export const FASE1_SUMMARY_FIELDS: Array<{ key: string; label: string; suffix?: string }> = [
  { key: "peso_actual", label: "Peso actual", suffix: " kg" },
  { key: "altura", label: "Altura", suffix: " cm" },
  { key: "edad", label: "Edad", suffix: " años" },
  { key: "genero", label: "Sexo" },
  { key: "imc", label: "IMC" },
  { key: "clasificacion_imc", label: "Clasificación IMC" },
  { key: "riesgo_sarcopenia", label: "Riesgo de sarcopenia" },
  { key: "puntaje_z", label: "Puntaje Z" },
  { key: "peso_saludable", label: "Peso saludable", suffix: " kg" },
  { key: "peso_ajustado", label: "Peso ajustado", suffix: " kg" },
  { key: "peso_objetivo", label: "Peso objetivo", suffix: " kg" },
  { key: "peso_referencia", label: "Peso de referencia", suffix: " kg" },
  { key: "talla_estimada_chumlea", label: "Talla estimada (Chumlea)", suffix: " cm" },
  { key: "peso_estimado_chumlea", label: "Peso estimado (Chumlea)", suffix: " kg" },
  { key: "regla_peso", label: "Regla de peso" },
  { key: "tmb", label: "TMB", suffix: " kcal" },
  { key: "formula_requerimiento", label: "Fórmula" },
  { key: "metodo_energia", label: "Método de cálculo" },
  { key: "factor_actividad", label: "Factor de actividad" },
  { key: "ger_factor_actividad", label: "Factor de actividad (GER)" },
  { key: "ger_factor_estres", label: "Factor de estrés" },
  { key: "factor_estres", label: "Factor de estrés" },
  { key: "rango_kcal_kg", label: "kcal / kg" },
  { key: "ger_liquidos_cc_kg", label: "Líquidos", suffix: " cc/kg" },
  { key: "liquidos_ml", label: "Líquidos totales", suffix: " ml/día" },
  { key: "requerimiento_base", label: "Requerimiento base", suffix: " kcal" },
  { key: "requerimiento_antes_ajuste", label: "Requerimiento sin ajuste", suffix: " kcal" },
  { key: "requerimiento_energetico", label: "Requerimiento total", suffix: " kcal" },
  { key: "pediatria_peso", label: "Peso (pediatría)", suffix: " kg" },
  { key: "pediatria_talla_cm", label: "Talla (pediatría)", suffix: " cm" },
  { key: "deportista_peso", label: "Peso (deportista)", suffix: " kg" },
  { key: "deportista_estatura", label: "Estatura (deportista)", suffix: " cm" },
];

function formatFase1Value(key: string, value: unknown): string {
  if (key === "formula_requerimiento") {
    return FORMULA_LABELS[String(value)] || String(value);
  }
  if (key === "genero") {
    return GENERO_LABELS[String(value).toLowerCase()] || String(value);
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  }
  return String(value);
}

export function buildFase1SummaryRows(
  f1: Record<string, unknown> | null
): Array<{ label: string; value: string }> {
  if (!f1) return [];
  const rows: Array<{ label: string; value: string }> = [];
  for (const f of FASE1_SUMMARY_FIELDS) {
    const raw = f1[f.key];
    if (!phaseHasValue(raw)) continue;
    rows.push({ label: f.label, value: formatFase1Value(f.key, raw) + (f.suffix || "") });
  }
  const ajusteModo = f1.ajuste_calorias_modo;
  const ajusteVal = f1.ajuste_calorias_valor;
  if (
    phaseHasValue(ajusteModo) &&
    phaseHasValue(ajusteVal) &&
    String(ajusteModo) !== "ninguno"
  ) {
    const modoLabel =
      ajusteModo === "restriccion"
        ? "Restricción"
        : ajusteModo === "aumento"
          ? "Aumento"
          : String(ajusteModo);
    rows.push({ label: "Ajuste calórico", value: `${modoLabel} ${formatFase1Value("ajuste", ajusteVal)} kcal` });
  }
  return rows;
}

export function fase1PesoKg(
  f1: Record<string, unknown> | null,
  plan?: { patient_weight?: unknown }
): string {
  const raw =
    f1?.peso_actual ??
    f1?.pediatria_peso ??
    f1?.deportista_peso ??
    f1?.gestante_peso_pre ??
    f1?.gestante_peso ??
    plan?.patient_weight;
  return phaseHasValue(raw) ? String(raw) : "—";
}

export function fase1AlturaCm(
  f1: Record<string, unknown> | null,
  plan?: { patient_height?: unknown }
): string {
  const raw =
    f1?.altura ??
    f1?.pediatria_talla_cm ??
    f1?.deportista_estatura ??
    plan?.patient_height;
  return phaseHasValue(raw) ? String(raw) : "—";
}

export function fase1ImcDisplay(f1: Record<string, unknown> | null): string {
  if (phaseHasValue(f1?.imc)) return String(f1!.imc);
  return "—";
}

/** Fase 2 en DB usa claves sin sufijo _f2; el formulario del wizard usa _f2. */
export function fase2Field(
  f2: Record<string, unknown> | null,
  key: string,
  legacySuffix = "_f2"
): unknown {
  if (!f2) return undefined;
  if (phaseHasValue(f2[key])) return f2[key];
  const legacyKey = key.endsWith("_f2") ? key : `${key}${legacySuffix}`;
  if (legacyKey !== key && phaseHasValue(f2[legacyKey])) return f2[legacyKey];
  return undefined;
}

export type GrupoPorcionRow = {
  grupo: string;
  porciones: number;
  kcal?: number;
  prot?: number;
  chos?: number;
  grasa?: number;
};

/** Extrae tabla de porciones desde fase_3 (wizard actual o legacy). */
export function extractGruposPorciones(f3: Record<string, unknown> | null): GrupoPorcionRow[] {
  if (!f3) return [];

  let grupos: Record<string, unknown> | null = null;
  const raw = f3.grupos_alimentos ?? f3.grupos_alimentos_f3 ?? f3.porciones_f3;
  if (typeof raw === "string") {
    grupos = parsePlanPhase(raw);
  } else if (raw && typeof raw === "object") {
    grupos = raw as Record<string, unknown>;
  }

  if (!grupos) return [];

  const rows: GrupoPorcionRow[] = [];
  for (const [grupo, data] of Object.entries(grupos)) {
    let porciones = 0;
    if (typeof data === "number") porciones = data;
    else if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      porciones = parseFloat(String(d.porciones ?? d.porcion ?? 0)) || 0;
      if (porciones > 0) {
        rows.push({
          grupo,
          porciones,
          kcal: typeof d.kcal === "number" ? d.kcal : parseFloat(String(d.kcal ?? d.energia ?? "")) || undefined,
          prot: typeof d.prot === "number" ? d.prot : parseFloat(String(d.prot ?? d.proteina ?? "")) || undefined,
          chos: typeof d.chos === "number" ? d.chos : parseFloat(String(d.chos ?? d.carbohidratos ?? "")) || undefined,
          grasa: typeof d.grasa === "number" ? d.grasa : parseFloat(String(d.grasa ?? d.grasas ?? "")) || undefined,
        });
        continue;
      }
    }
    if (porciones > 0) {
      rows.push({ grupo, porciones });
    }
  }
  return rows.sort((a, b) => a.grupo.localeCompare(b.grupo, "es"));
}

export function fase3Totales(f3: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!f3?.totales) return null;
  return parsePlanPhase(f3.totales) ?? (f3.totales as Record<string, unknown>);
}
