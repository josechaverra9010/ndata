import { todayInColombiaISO, toColombiaDateISO } from "@/lib/timezone";
import {
  emptyBioquimicos,
  normalizeBioquimicos,
  type BioquimicosData,
} from "@/components/shared/BioquimicosForm";
import { FREQUENCY_COLUMNS } from "@/components/shared/FoodFrequencyForm";
import { normalizeDatosClinicos } from "@/lib/datosClinicos";

/** Campos del formulario de historia clínica (sin bioquímicos). */
export type ClinicalHistoryFormBase = {
  fecha: string;
  numero_historia: string;
  nombre: string;
  fecha_nacimiento: string;
  edad: string;
  genero: string;
  tipo_documento: string;
  numero_documento: string;
  cuidador: string;
  telefono_fijo: string;
  celular: string;
  email: string;
  programa_pyp: string;
  nivel_actividad: string;
  pal_factor: string;
  motivo_consulta: string;
  enfermedad_actual: string;
  antecedentes_personales: string;
  signos_sintomas: string;
  constipacion: boolean;
  diarrea: boolean;
  vomito: boolean;
  reflujo: boolean;
  otros_sintomas: string;
  antecedentes_familiares: string;
  fam_diabetes: boolean;
  fam_cardiovascular: boolean;
  fam_hipertension: boolean;
  fam_obesidad: boolean;
  medicamentos: string;
  peso: string;
  talla: string;
  peso_objetivo: string;
  perimetro_cefalico: string;
  perimetro_braquial: string;
  perimetro_cintura: string;
  pliegue_tricipital: string;
  pliegue_subescapular: string;
  imc: string;
  clasificacion_antropometrica: string;
  observaciones_antro: string;
  preferencias: string;
  rechazos: string;
  intolerancias: string;
  recordatorio_24h: string;
  evaluacion_consumo: string;
  factores_riesgo: string;
  diagnostico_pes: string;
  objetivos: string;
  tipo_dieta: string;
  determinacion_requerimientos: string;
  minuta_patron: string;
  recomendaciones: string;
  plan_educacion: string;
  proxima_cita_dias: string;
  proxima_cita_fecha: string;
  criterios_seguimiento: string;
  nota_resumida: string;
};

export type ClinicalHistoryForm = ClinicalHistoryFormBase & BioquimicosData;

export function emptyClinicalHistoryForm(): ClinicalHistoryForm {
  return {
    fecha: todayInColombiaISO(),
    numero_historia: "",
    nombre: "",
    fecha_nacimiento: "",
    edad: "",
    genero: "",
    tipo_documento: "",
    numero_documento: "",
    cuidador: "",
    telefono_fijo: "",
    celular: "",
    email: "",
    programa_pyp: "",
    nivel_actividad: "",
    pal_factor: "",
    motivo_consulta: "",
    enfermedad_actual: "",
    antecedentes_personales: "",
    signos_sintomas: "",
    constipacion: false,
    diarrea: false,
    vomito: false,
    reflujo: false,
    otros_sintomas: "",
    antecedentes_familiares: "",
    fam_diabetes: false,
    fam_cardiovascular: false,
    fam_hipertension: false,
    fam_obesidad: false,
    medicamentos: "",
    ...emptyBioquimicos(),
    peso: "",
    talla: "",
    peso_objetivo: "",
    perimetro_cefalico: "",
    perimetro_braquial: "",
    perimetro_cintura: "",
    pliegue_tricipital: "",
    pliegue_subescapular: "",
    imc: "",
    clasificacion_antropometrica: "",
    observaciones_antro: "",
    preferencias: "",
    rechazos: "",
    intolerancias: "",
    recordatorio_24h: "",
    evaluacion_consumo: "",
    factores_riesgo: "",
    diagnostico_pes: "",
    objetivos: "",
    tipo_dieta: "",
    determinacion_requerimientos: "",
    minuta_patron: "",
    recomendaciones: "",
    plan_educacion: "",
    proxima_cita_dias: "",
    proxima_cita_fecha: "",
    criterios_seguimiento: "",
    nota_resumida: "",
  };
}

function joinList(v?: string[] | string | null): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  return String(v);
}

function formatDob(raw?: string | null): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s.slice(0, 10);
    return toColombiaDateISO(d);
  } catch {
    return s.slice(0, 10);
  }
}

export function calcImc(peso?: number | string | null, alturaCm?: number | string | null): string {
  const p = typeof peso === "string" ? parseFloat(peso) : peso;
  const h = typeof alturaCm === "string" ? parseFloat(alturaCm) : alturaCm;
  if (!(p && h && h > 0)) return "";
  const m = h / 100;
  return (p / (m * m)).toFixed(2);
}

function freqLabel(id: string): string {
  const col = FREQUENCY_COLUMNS.find((c) => c.id === id);
  if (!col) return id;
  if (col.category === "Nunca") return col.label;
  return `${col.label} ${col.category.toLowerCase()}`;
}

/** Frecuencia de consumo registrada al crear/editar el paciente → texto para historia clínica. */
export function formatFoodFrequencyText(frecuencia_consumo?: any[] | null): string {
  if (!Array.isArray(frecuencia_consumo) || !frecuencia_consumo.length) return "";
  const lines = frecuencia_consumo
    .filter((item) => item?.grupo && item.frecuencia && item.frecuencia !== "never")
    .map((item) => `${item.grupo}: ${freqLabel(item.frecuencia)}`);
  return lines.join("\n");
}

/** Datos del acompañante/cuidador desde la ficha del paciente. */
export function formatCuidadorFromPatient(p: Record<string, any>): string {
  const parts: string[] = [];
  if (p.acompanante_nombre) {
    let name = p.acompanante_nombre;
    if (p.acompanante_parentesco) name += ` (${p.acompanante_parentesco})`;
    parts.push(name);
  }
  if (p.acompanante_telefono) parts.push(`Tel: ${p.acompanante_telefono}`);
  if (p.acompanante_email) parts.push(`Email: ${p.acompanante_email}`);
  if (p.acompanante_documento) parts.push(`Doc: ${p.acompanante_documento}`);
  if (p.acompanante_observaciones) parts.push(`Obs: ${p.acompanante_observaciones}`);
  return parts.join(" · ");
}

function parseFamilyFlags(antecedentes?: string | null, dc?: Record<string, any>) {
  if (dc && (dc.fam_diabetes || dc.fam_cardiovascular || dc.fam_hipertension || dc.fam_obesidad)) {
    return {
      fam_diabetes: Boolean(dc.fam_diabetes),
      fam_cardiovascular: Boolean(dc.fam_cardiovascular),
      fam_hipertension: Boolean(dc.fam_hipertension),
      fam_obesidad: Boolean(dc.fam_obesidad),
    };
  }
  const fam = String(antecedentes || "").toLowerCase();
  return {
    fam_diabetes: fam.includes("diabetes"),
    fam_cardiovascular: fam.includes("cardio") || fam.includes("corazón") || fam.includes("corazon"),
    fam_hipertension: fam.includes("hipertens"),
    fam_obesidad: fam.includes("obesidad") || fam.includes("sobrepeso"),
  };
}

function buildAntecedentesPersonales(p: Record<string, any>, dc: Record<string, any>): string {
  if (dc.antecedentes_personales) return String(dc.antecedentes_personales);
  const lines: string[] = [];
  const alergias = joinList(p.alergias);
  if (alergias) lines.push(`Alergias: ${alergias}`);
  return lines.join("\n");
}

export type PlanExtras = {
  recallText?: string;
  reqText?: string;
  minuta?: string;
};

const FORMULA_LABELS: Record<string, string> = {
  schofield: "Schofield",
  harris_benedict: "Harris-Benedict",
  mifflin: "Mifflin-St Jeor",
  rango_calorico: "Rango calórico (kcal/kg)",
  ireton_jones: "Ireton-Jones",
};

function fmtNum(v: any, digits = 1): string {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n) || n === 0) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

/** Construye el texto de determinación de requerimientos (cálculo calórico) desde el plan activo. */
export function formatCalculoCaloricoFromPlan(plan?: Record<string, any> | null): string {
  if (!plan || typeof plan !== "object") return "";
  const f1 = plan.fase_1 || {};
  const f2 = plan.fase_2 || {};
  const lines: string[] = [];

  const formulaKey = String(f1.formula_requerimiento || plan.formula_requerimiento || "");
  if (formulaKey) {
    lines.push(`Fórmula / método: ${FORMULA_LABELS[formulaKey] || formulaKey}`);
  }
  if (f1.metodo_energia) lines.push(`Método: ${f1.metodo_energia}`);
  if (f1.tipo_fase) lines.push(`Tipo de cálculo: ${f1.tipo_fase}`);

  const tmb = fmtNum(f1.tmb ?? f1.ger_base ?? f1.requerimiento_base);
  if (tmb) lines.push(`TMB / GER: ${tmb} kcal`);

  const fa = fmtNum(f1.factor_actividad ?? f1.hosp_factor_actividad ?? f1.ger_factor_actividad ?? f1.pediatria_actividad, 2);
  if (fa) lines.push(`Factor de actividad: ${fa}`);

  const fe = fmtNum(f1.factor_estres ?? f1.hosp_factor_estres ?? f1.ger_factor_estres, 2);
  if (fe) lines.push(`Factor de estrés: ${fe}`);

  const pal = fmtNum(f1.pal_factor ?? plan.pal_factor, 2);
  if (pal) lines.push(`Factor PAL: ${pal}`);

  const base = fmtNum(f1.requerimiento_antes_ajuste ?? f1.requerimiento_base ?? f1.requerimiento_base_f1);
  if (base) lines.push(`Requerimiento base: ${base} kcal`);

  const modo = String(f1.ajuste_calorias_modo || "").toLowerCase();
  const ajusteVal = fmtNum(f1.ajuste_calorias_valor);
  if (modo && modo !== "ninguno" && ajusteVal) {
    const modoLabel = modo === "restriccion" ? "Restricción" : modo === "aumento" ? "Aumento" : modo;
    lines.push(`Ajuste calórico: ${modoLabel} ${ajusteVal} kcal`);
  }

  const kcal =
    fmtNum(f1.requerimiento_energetico) ||
    fmtNum(plan.calories) ||
    fmtNum(f2.total_calorias) ||
    fmtNum(f2.total_calorias_f2);
  if (kcal) lines.push(`Requerimiento energético total: ${kcal} kcal`);

  const kcalKg = fmtNum(f1.rango_kcal_kg ?? f1.kcal_kg, 1);
  if (kcalKg) lines.push(`kcal/kg: ${kcalKg}`);

  const pesoRef = fmtNum(f1.peso_referencia ?? f2.peso_referencia ?? f2.peso_referencia_f2, 1);
  if (pesoRef) lines.push(`Peso de referencia: ${pesoRef} kg`);

  const protG = fmtNum(f2.proteinas_gramos ?? f2.proteinas_gramos_f2, 1);
  const protAmdr = fmtNum(f2.proteinas_amdr ?? f2.proteinas_amdr_f2, 1);
  if (protG) {
    lines.push(protAmdr ? `Proteínas: ${protG} g (${protAmdr}%)` : `Proteínas: ${protG} g`);
  }
  const fatG = fmtNum(f2.grasas_gramos ?? f2.grasas_gramos_f2, 1);
  const fatAmdr = fmtNum(f2.grasas_amdr ?? f2.grasas_amdr_f2, 1);
  if (fatG) {
    lines.push(fatAmdr ? `Grasas: ${fatG} g (${fatAmdr}%)` : `Grasas: ${fatG} g`);
  }
  const choG = fmtNum(f2.cho_gramos ?? f2.carbohidratos_gramos ?? f2.chos_gramos, 1);
  const choAmdr = fmtNum(f2.cho_amdr ?? f2.carbohidratos_amdr, 1);
  if (choG) {
    lines.push(choAmdr ? `Carbohidratos: ${choG} g (${choAmdr}%)` : `Carbohidratos: ${choG} g`);
  }

  return lines.join("\n");
}

/** Consolida la ficha del paciente (creación/edición) en el formulario de historia clínica. */
export function buildClinicalHistoryFromPatient(
  p: Record<string, any>,
  extras: PlanExtras = {}
): ClinicalHistoryForm {
  const bio = normalizeBioquimicos(p.examenes_bioquimicos);
  const dc = normalizeDatosClinicos(p.datos_clinicos);
  const famFlags = parseFamilyFlags(p.antecedentes_familiares, dc);
  const frecuenciaText = formatFoodFrequencyText(p.frecuencia_consumo);

  return {
    ...emptyClinicalHistoryForm(),
    ...bio,
    fecha: todayInColombiaISO(),
    numero_historia: `HN-${p.id}-${new Date().getFullYear()}`,
    nombre: `${p.nombres || ""} ${p.apellidos || ""}`.trim(),
    fecha_nacimiento: formatDob(p.fecha_nacimiento),
    edad: p.edad_formateada || "",
    genero: p.genero || "",
    tipo_documento: p.tipo_documento || "",
    numero_documento: p.numero_documento || "",
    cuidador: formatCuidadorFromPatient(p),
    telefono_fijo: dc.telefono_fijo || "",
    celular: p.telefono || "",
    email: p.email || "",
    programa_pyp: p.programa_eps || p.programa_pyp || "",
    nivel_actividad: p.nivel_actividad || "",
    pal_factor: p.pal_factor != null ? String(p.pal_factor) : "",
    motivo_consulta: dc.motivo_consulta || p.objetivos_salud || "",
    enfermedad_actual: dc.enfermedad_actual || "",
    antecedentes_personales: buildAntecedentesPersonales(p, dc),
    signos_sintomas: dc.signos_sintomas || "",
    constipacion: dc.constipacion,
    diarrea: dc.diarrea,
    vomito: dc.vomito,
    reflujo: dc.reflujo,
    otros_sintomas: dc.otros_sintomas || "",
    antecedentes_familiares: p.antecedentes_familiares || "",
    ...famFlags,
    medicamentos: dc.medicamentos || "",
    peso: p.peso_actual != null ? String(p.peso_actual) : "",
    talla: p.altura != null ? String(p.altura) : "",
    peso_objetivo: p.peso_objetivo != null ? String(p.peso_objetivo) : "",
    perimetro_cefalico: dc.perimetro_cefalico || "",
    perimetro_braquial: dc.perimetro_braquial || "",
    perimetro_cintura: dc.perimetro_cintura || "",
    pliegue_tricipital: dc.pliegue_tricipital || "",
    pliegue_subescapular: dc.pliegue_subescapular || "",
    imc: calcImc(p.peso_actual, p.altura),
    clasificacion_antropometrica: dc.clasificacion_antropometrica || "",
    observaciones_antro: dc.observaciones_antro || "",
    preferencias: joinList(p.preferencias),
    rechazos: p.alimentos_disgusto || "",
    intolerancias: joinList(p.alergias),
    recordatorio_24h: extras.recallText || "",
    evaluacion_consumo: frecuenciaText,
    factores_riesgo: dc.factores_riesgo || "",
    diagnostico_pes: dc.diagnostico_pes || p.evaluacion_nutricional || "",
    objetivos: p.objetivos_salud || "",
    tipo_dieta: dc.tipo_dieta || "",
    determinacion_requerimientos: extras.reqText || "",
    minuta_patron: extras.minuta || "",
    recomendaciones: dc.recomendaciones || "",
    plan_educacion: dc.plan_educacion || "",
    proxima_cita_dias: dc.proxima_cita_dias || "",
    proxima_cita_fecha: dc.proxima_cita_fecha || "",
    criterios_seguimiento: dc.criterios_seguimiento || "",
    nota_resumida: dc.nota_resumida || p.evaluacion_nutricional || "",
  };
}
