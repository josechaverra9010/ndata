/** Campos clínicos adicionales de la ficha del paciente (historia clínica). */
export type DatosClinicos = {
  telefono_fijo: string;
  motivo_consulta: string;
  enfermedad_actual: string;
  antecedentes_personales: string;
  signos_sintomas: string;
  constipacion: boolean;
  diarrea: boolean;
  vomito: boolean;
  reflujo: boolean;
  otros_sintomas: string;
  fam_diabetes: boolean;
  fam_cardiovascular: boolean;
  fam_hipertension: boolean;
  fam_obesidad: boolean;
  medicamentos: string;
  perimetro_cefalico: string;
  perimetro_braquial: string;
  perimetro_cintura: string;
  pliegue_tricipital: string;
  pliegue_subescapular: string;
  clasificacion_antropometrica: string;
  observaciones_antro: string;
  factores_riesgo: string;
  diagnostico_pes: string;
  tipo_dieta: string;
  recomendaciones: string;
  plan_educacion: string;
  proxima_cita_dias: string;
  proxima_cita_fecha: string;
  criterios_seguimiento: string;
  nota_resumida: string;
};

export function emptyDatosClinicos(): DatosClinicos {
  return {
    telefono_fijo: "",
    motivo_consulta: "",
    enfermedad_actual: "",
    antecedentes_personales: "",
    signos_sintomas: "",
    constipacion: false,
    diarrea: false,
    vomito: false,
    reflujo: false,
    otros_sintomas: "",
    fam_diabetes: false,
    fam_cardiovascular: false,
    fam_hipertension: false,
    fam_obesidad: false,
    medicamentos: "",
    perimetro_cefalico: "",
    perimetro_braquial: "",
    perimetro_cintura: "",
    pliegue_tricipital: "",
    pliegue_subescapular: "",
    clasificacion_antropometrica: "",
    observaciones_antro: "",
    factores_riesgo: "",
    diagnostico_pes: "",
    tipo_dieta: "",
    recomendaciones: "",
    plan_educacion: "",
    proxima_cita_dias: "",
    proxima_cita_fecha: "",
    criterios_seguimiento: "",
    nota_resumida: "",
  };
}

export function normalizeDatosClinicos(raw?: Record<string, any> | null): DatosClinicos {
  const base = emptyDatosClinicos();
  if (!raw || typeof raw !== "object") return base;
  const out: DatosClinicos = { ...base };
  (Object.keys(base) as (keyof DatosClinicos)[]).forEach((key) => {
    const v = raw[key];
    if (typeof base[key] === "boolean") {
      out[key] = Boolean(v) as never;
    } else if (v != null) {
      out[key] = String(v) as never;
    }
  });
  return out;
}

/** Omite claves vacías / false para no guardar ruido en DB. */
export function compactDatosClinicos(data: DatosClinicos): Record<string, any> | null {
  const out: Record<string, any> = {};
  (Object.keys(data) as (keyof DatosClinicos)[]).forEach((key) => {
    const v = data[key];
    if (typeof v === "boolean") {
      if (v) out[key] = true;
    } else if (String(v || "").trim()) {
      out[key] = String(v).trim();
    }
  });
  return Object.keys(out).length ? out : null;
}
