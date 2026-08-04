import { useState, useEffect } from "react";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Calculator,
  ClipboardList,
  FileText,
  Utensils,
  Flame,
  AlertCircle,
  PieChart,
  Activity,
  Plus,
  Trash2,
  User,
  Baby,
  Heart,
  Users,
  Hospital,
  Accessibility,
  Dumbbell,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { FOOD_NUTRIENTS, EVANUT_GRUPOS_ALIMENTOS, getEvanutGruposForTipo, SUPLEMENTOS_GRUPO, SUPLEMENTO_EXTRA_PREFIX, makeSuplementoExtraKey, isSuplementoGrupoKey, listSuplementoKeys, getCompositionRowForIngredient, getFoodNutrientsForGroup, getPediatriaRienTargets, getAtalahClass, getTrimestreFromSemana, getGestanteExtraKcal, getGestanteExpectedGainKg, getGestanteDebioGanar, getGestanteRienTargets, getGestAdolesZClass, getGestAdolesExpectedGainKg, getGestAdolesExtraKcal, getGestAdolesDailyGainG, getGestAdolesBaseReq } from "@/lib/foodNutrients";
import {
  MIPRESS_CATEGORIAS,
  MIPRESS_SUPLEMENTOS,
  getMipressSuplementoById,
} from "@/lib/mipressSuplementos";
import { todayInColombiaISO, addDaysColombiaISO } from "@/lib/timezone";
import { PediatricGrowthPanel } from "@/components/pediatria/PediatricGrowthPanel";

const isGestanteTipo = (tipo?: string) => tipo === "gestante" || tipo === "gestante_adolescente";
const isGestAdoles = (tipo?: string) => tipo === "gestante_adolescente";
const isHospitalizado = (tipo?: string) => tipo === "hospitalizado";
const isGeriatrico = (tipo?: string) => tipo === "geriatrico";

/** Factores de actividad hospitalaria (EVANUT Hospitalizado) */
const HOSP_ACTIVIDAD_PRESETS: { value: string; label: string; factor: string }[] = [
  { value: "coma", label: "Inconsciente / Coma (1.0)", factor: "1.0" },
  { value: "cama", label: "En cama (1.15 mid 1.1–1.2)", factor: "1.15" },
  { value: "ambulatorio", label: "Ambulatorio (1.3)", factor: "1.3" },
];

/** Factores de actividad física para adulto mayor (PAL FAO/OMS geriátrico) */
const GER_ACTIVIDAD_PRESETS: { value: string; label: string; factor: string }[] = [
  { value: "reposo", label: "Reposo / encamado (1.2)", factor: "1.2" },
  { value: "sedentario", label: "Sedentario (1.4)", factor: "1.4" },
  { value: "ligera", label: "Actividad ligera (1.5)", factor: "1.5" },
  { value: "moderada", label: "Moderadamente activo (1.7)", factor: "1.7" },
];

/** Factores de estrés frecuentes en el adulto mayor */
const GER_ESTRES_PRESETS: { value: string; label: string; factor: string }[] = [
  { value: "ninguno", label: "Ninguno / basal (1.0)", factor: "1.0" },
  { value: "infeccion_leve", label: "Infección / enfermedad leve (1.2)", factor: "1.2" },
  { value: "ulcera_presion", label: "Úlceras por presión (1.2)", factor: "1.2" },
  { value: "fractura", label: "Fractura (1.2)", factor: "1.2" },
  { value: "repleccion", label: "Repleción / sarcopenia (1.3)", factor: "1.3" },
];

/** Factores de estrés (EVANUT Hospitalizado) */
const HOSP_ESTRES_PRESETS: { value: string; label: string; factor: string }[] = [
  { value: "ninguno", label: "Ninguno / basal (1.0)", factor: "1.0" },
  { value: "cirugia_menor", label: "Cirugía menor (1.1)", factor: "1.1" },
  { value: "cirugia_mayor", label: "Cirugía mayor (1.2)", factor: "1.2" },
  { value: "infeccion_leve", label: "Infección leve (1.2)", factor: "1.2" },
  { value: "infeccion_moderada", label: "Infección moderada (1.5)", factor: "1.5" },
  { value: "infeccion_severa", label: "Infección severa (1.8)", factor: "1.8" },
  { value: "trauma_esqueleto", label: "Trauma esqueleto (1.35)", factor: "1.35" },
  { value: "trauma_contusion", label: "Trauma contusión (1.35)", factor: "1.35" },
  { value: "lesion_cabeza", label: "Lesión de cabeza (1.6)", factor: "1.6" },
  { value: "quemadura_40", label: "Quemadura 40% (1.5)", factor: "1.5" },
  { value: "quemadura_100", label: "Quemadura 100% (1.96)", factor: "1.96" },
  { value: "peritonitis", label: "Peritonitis (~1.15 mid)", factor: "1.15" },
  { value: "cancer", label: "Cáncer (~1.25 mid)", factor: "1.25" },
];

interface NewPlanWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePlan: (planData: any) => void;
  patientId?: number;
  /** Tipo de plan preseleccionado al abrir (ej. desde el selector de tipos en MealPlans) */
  initialTipoPlan?: string;
}

const PHASES = [
  {
    id: 1,
    title: "REQUERIMIENTO ENERGÉTICO Y PESO SALUDABLE",
    titleDeportista: "SOMATOTIPO · COMPOSICIÓN CORPORAL",
    titlePediatria: "EVALUACIÓN Y REQUERIMIENTO PEDIÁTRICO",
    titleGestante: "EVALUACIÓN Y REQUERIMIENTO GESTANTE",
    titleGestAdoles: "EVALUACIÓN GESTANTE ADOLESCENTE",
    titleHospitalizado: "REQUERIMIENTO ENERGÉTICO HOSPITALIZADO",
    titleGeriatrico: "EVALUACIÓN Y REQUERIMIENTO GERIÁTRICO",
    icon: Calculator,
    description: "Calcula las necesidades energéticas, peso saludable y peso ajustado",
    descriptionDeportista: "Somatotipo Heath-Carter separado de composición corporal (% grasa, 5 componentes, AKS) y kcal",
    descriptionPediatria: "GER FAO/OMS 2005, crecimiento, actividad y catch-up (EVANUT Pediatría)",
    descriptionGestante: "IMC Atalah, ganancia gestacional, TMR × PAL + calorías por trimestre (EVANUT Gestante)",
    descriptionGestAdoles: "Puntaje Z, GET FAO + crecimiento adolescente + extras por trimestre (EVANUT Ges Adoles)",
    descriptionHospitalizado: "TMB × actividad hospitalaria × factor de estrés, Ireton-Jones o kcal/kg + líquidos (EVANUT Hospitalizado)",
    descriptionGeriatrico: "TMB × factor de actividad × factor de estrés + estimación Chumlea, IMC geriátrico y riesgo de sarcopenia",
  },
  {
    id: 2,
    title: "FÓRMULA SINTÉTICA PLANEADA",
    icon: ClipboardList,
    description: "Define la distribución de macronutrientes (AMDR) y micronutrientes",
    descriptionDeportista: "Distribución AMDR para deportista (proteína 1.11–2.00 g/kg)",
    descriptionPediatria: "Distribución AMDR RIEN por edad (0–18 años)",
    descriptionGestante: "Distribución AMDR RIEN gestante (proteína 1.53–1.7 g/kg)",
    descriptionGestAdoles: "Distribución AMDR RIEN gestante adolescente (1.53–1.7 g/kg)",
    descriptionHospitalizado: "Distribución AMDR hospitalario (proteína ~1.2–1.5 g/kg típico)",
  },
  {
    id: 3,
    title: "FÓRMULA SINTÉTICA DESARROLLADA",
    icon: FileText,
    description: "Distribución por grupos de alimentos y cálculo de nutrientes totales",
    descriptionDeportista: "Grupos EVANUT + suplementos (nutrientes manuales por porción)",
    descriptionPediatria: "Grupos EVANUT pediátricos (adultos, niños y menores de 2 años)",
    descriptionGestante: "Grupos EVANUT adultos para gestante",
    descriptionGestAdoles: "Grupos EVANUT adultos para gestante adolescente",
    descriptionHospitalizado: "Grupos EVANUT adultos para paciente hospitalizado",
    descriptionGeriatrico: "Grupos EVANUT adultos para adulto mayor",
  },
  {
    id: 4,
    title: "MINUTA PATRÓN Y DETALLE DE INGREDIENTES",
    icon: Utensils,
    description: "Especifica los gramos de cada ingrediente para el paciente",
    descriptionDeportista: "Minuta patrón con porciones de grupos y suplementos",
    descriptionPediatria: "Minuta patrón con grupos pediátricos",
    descriptionGestante: "Minuta patrón gestante",
    descriptionGestAdoles: "Minuta patrón gestante adolescente",
    descriptionHospitalizado: "Minuta patrón hospitalizado",
    descriptionGeriatrico: "Minuta patrón para adulto mayor",
  }
];

// Grupos de alimentos de Fase 3 según EVANUT 4.1 (solo los del Excel)
const GRUPOS_ALIMENTOS = EVANUT_GRUPOS_ALIMENTOS;

const emptyGrupoNutrients = () => ({
  porciones: "",
  kcal: 0,
  prot: 0,
  grasa: 0,
  gs: 0,
  gm: 0,
  gp: 0,
  col: 0,
  chos: 0,
  fd: 0,
  calcio: 0,
  p: 0,
  fe: 0,
  na: 0,
  k: 0,
  mg: 0,
  zn: 0,
  cu: 0,
  manual: false,
  per_kcal: "",
  per_prot: "",
  per_grasa: "",
  per_gs: "",
  per_gm: "",
  per_gp: "",
  per_col: "",
  per_chos: "",
  per_fd: "",
});

/** Delta kcal por restricción (-) o aumento (+) */
function getAjusteCaloriasDelta(fd: Record<string, any>): number {
  const valor = parseFloat(fd.ajuste_calorias_valor) || 0;
  if (!(valor > 0)) return 0;
  if (fd.ajuste_calorias_modo === "restriccion") return -valor;
  if (fd.ajuste_calorias_modo === "aumento") return valor;
  return 0;
}

/** Aplica ajuste a un requerimiento base (mínimo 0) */
function applyAjusteCalorias(baseKcal: number, fd: Record<string, any>): number {
  if (!(baseKcal > 0)) return 0;
  return Math.max(0, Math.round(baseKcal + getAjusteCaloriasDelta(fd)));
}

/** Campos de requerimiento con base + ajuste aplicados */
function withAjusteCaloriasFields(baseKcal: number, fd: Record<string, any>) {
  const base = baseKcal > 0 ? Math.round(baseKcal) : 0;
  const finalKcal = applyAjusteCalorias(base, fd);
  return {
    requerimiento_base_f1: base > 0 ? String(base) : "",
    requerimiento_energetico: finalKcal > 0 ? String(finalKcal) : "",
    total_calorias_f2: finalKcal > 0 ? String(finalKcal) : "",
  };
}

/** FAO/Schofield (actual EVANUT adulto) */
function calcTmbSchofield(peso: number, edad: number, genero: string): number {
  if (!(peso > 0) || !(edad > 0) || !genero) return 0;
  if (genero === "masculino") {
    if (edad <= 30) return 15.057 * peso + 692.2;
    if (edad <= 60) return 11.472 * peso + 873.1;
    return 11.711 * peso + 587.7;
  }
  if (genero === "femenino") {
    if (edad <= 30) return 14.818 * peso + 486.6;
    if (edad <= 60) return 8.126 * peso + 845.6;
    return 9.082 * peso + 658.5;
  }
  return 0;
}

/** Harris-Benedict original (1919) — P kg, T cm, E años */
function calcTmbHarrisBenedict(peso: number, alturaCm: number, edad: number, genero: string): number {
  if (!(peso > 0) || !(alturaCm > 0) || !(edad > 0) || !genero) return 0;
  if (genero === "masculino") {
    return 66.473 + 13.7516 * peso + 5.0033 * alturaCm - 6.755 * edad;
  }
  if (genero === "femenino") {
    return 655.0955 + 9.5634 * peso + 1.8496 * alturaCm - 4.6756 * edad;
  }
  return 0;
}

/** Mifflin-St Jeor (1990) — P kg, T cm, E años */
function calcTmbMifflin(peso: number, alturaCm: number, edad: number, genero: string): number {
  if (!(peso > 0) || !(alturaCm > 0) || !(edad > 0) || !genero) return 0;
  const base = 10 * peso + 6.25 * alturaCm - 5 * edad;
  if (genero === "masculino") return base + 5;
  if (genero === "femenino") return base - 161;
  return 0;
}

/**
 * Calcula TMB + requerimiento adulto según fórmula elegida.
 * schofield | harris_benedict | mifflin → TMB × PAL
 * rango_calorico → peso × kcal/kg (sin PAL)
 */
function calculateAdultEnergia(fd: Record<string, any>) {
  const formula = fd.formula_requerimiento || "schofield";
  const genero = String(fd.genero || "").toLowerCase();
  const edad = parseFloat(fd.edad) || 0;
  const alturaCm = parseFloat(fd.altura) || 0;
  const pesoRef =
    parseFloat(fd.peso_referencia_f2) ||
    parseFloat(fd.peso_objetivo) ||
    parseFloat(fd.peso_ajustado) ||
    parseFloat(fd.peso_actual) ||
    0;
  const pal = parseFloat(fd.factor_actividad) || 0;
  const kcalKg = parseFloat(fd.rango_kcal_kg) || 0;

  let tmb = 0;
  let reqBase = 0;
  let metodoLabel = "FAO/Schofield";

  if (formula === "rango_calorico") {
    metodoLabel = "Rango calórico (kcal/kg)";
    reqBase = pesoRef > 0 && kcalKg > 0 ? pesoRef * kcalKg : 0;
    tmb = 0;
  } else if (formula === "harris_benedict") {
    metodoLabel = "Harris-Benedict";
    tmb = calcTmbHarrisBenedict(pesoRef, alturaCm, edad, genero);
    reqBase = tmb > 0 && pal > 0 ? tmb * pal : 0;
  } else if (formula === "mifflin") {
    metodoLabel = "Mifflin-St Jeor";
    tmb = calcTmbMifflin(pesoRef, alturaCm, edad, genero);
    reqBase = tmb > 0 && pal > 0 ? tmb * pal : 0;
  } else {
    metodoLabel = "FAO/Schofield";
    tmb = calcTmbSchofield(pesoRef, edad, genero);
    reqBase = tmb > 0 && pal > 0 ? tmb * pal : 0;
  }

  const requerimientoFinal = applyAjusteCalorias(reqBase, fd);
  return {
    formula,
    metodoLabel,
    pesoRef,
    tmb,
    reqBase,
    requerimientoFinal,
    usesPal: formula !== "rango_calorico",
  };
}

/** Chumlea 1985 — talla estimada (cm) desde talón-rodilla */
function calcChumleaTallaCm(talonRodillaCm: number, edad: number, genero: string): number {
  if (!(talonRodillaCm > 0) || !(edad > 0) || !genero) return 0;
  if (genero === "masculino") return 64.19 - 0.04 * edad + 2.02 * talonRodillaCm;
  if (genero === "femenino") return 84.88 - 0.24 * edad + 1.83 * talonRodillaCm;
  return 0;
}

/**
 * Chumlea 1988 — peso estimado (kg) no ambulante:
 * AC, CC, KH en cm; SST (pliegue subescapular) en mm.
 */
function calcChumleaPesoKg(
  perimBrazoCm: number,
  perimPantorrillaCm: number,
  talonRodillaCm: number,
  pliegueSubescapularMm: number,
  genero: string
): number {
  if (
    !(perimBrazoCm > 0) ||
    !(perimPantorrillaCm > 0) ||
    !(talonRodillaCm > 0) ||
    !(pliegueSubescapularMm > 0) ||
    !genero
  ) {
    return 0;
  }
  const AC = perimBrazoCm;
  const CC = perimPantorrillaCm;
  const KH = talonRodillaCm;
  const SST = pliegueSubescapularMm;
  if (genero === "masculino") {
    // Excel muestra constante -81.69 con inputs vacíos
    return 0.98 * CC + 1.16 * KH + 1.73 * AC + 0.37 * SST - 81.69;
  }
  if (genero === "femenino") {
    return 1.27 * CC + 0.87 * KH + 0.98 * AC + 0.4 * SST - 62.35;
  }
  return 0;
}

/** Nutrición parenteral adulto (EVANUT Hospitalizado) */
function calculateParenteralHospitalizado(fd: Record<string, any>, fallback: {
  peso?: number;
  calorias?: number;
  liquidosMl?: number;
}) {
  const peso =
    parseFloat(fd.pn_peso_kg) ||
    fallback.peso ||
    parseFloat(fd.peso_referencia_f2) ||
    parseFloat(fd.peso_actual) ||
    0;
  const calorias =
    parseFloat(fd.pn_calorias) ||
    fallback.calorias ||
    parseFloat(fd.requerimiento_energetico) ||
    0;
  const liquidos =
    parseFloat(fd.pn_liquidos_ml) ||
    fallback.liquidosMl ||
    0;
  const protGkg = parseFloat(fd.pn_prot_gkg) || 0;
  const choGkg = parseFloat(fd.pn_cho_gkg) || 0;
  const naMeqKg = parseFloat(fd.pn_na_meq_kg) || 0;
  const kMeqKg = parseFloat(fd.pn_k_meq_kg) || 0;
  const caMeqDia = parseFloat(fd.pn_ca_meq_dia) || 0;
  const pMmolDia = parseFloat(fd.pn_p_mmol_dia) || 0;

  const protG = peso > 0 && protGkg > 0 ? protGkg * peso : 0;
  const protKcal = protG * 4;
  const choG = peso > 0 && choGkg > 0 ? choGkg * peso : 0;
  const choKcal = choG * 4;
  // Excel: lípidos = resto de calorías tras CHO + proteína
  const lipKcal = calorias > 0 ? Math.max(0, calorias - protKcal - choKcal) : 0;
  const lipG = lipKcal / 9;
  const lipGkg = peso > 0 ? lipG / peso : 0;
  // Flujo metabólico CHO: mg/kg/min = (g CHO × 1000) / (peso × 1440)
  const flujoMgKgMin =
    peso > 0 && choG > 0 ? (choG * 1000) / (peso * 1440) : 0;
  const naTotal = peso > 0 && naMeqKg > 0 ? naMeqKg * peso : 0;
  const kTotal = peso > 0 && kMeqKg > 0 ? kMeqKg * peso : 0;

  return {
    peso,
    calorias,
    liquidos,
    protGkg,
    choGkg,
    protG,
    protKcal,
    choG,
    choKcal,
    lipKcal,
    lipG,
    lipGkg,
    flujoMgKgMin,
    naMeqKg,
    kMeqKg,
    naTotal,
    kTotal,
    caMeqDia,
    pMmolDia,
  };
}

/** Ireton-Jones 1992 (EEE) — used by EVANUT Hospitalizado */
function calcIretonJones(pesoKg: number, edad: number, genero: string, flags: {
  ventilatorio?: boolean;
  obesidad?: boolean;
  trauma?: boolean;
  quemadura?: boolean;
}): number {
  if (!(pesoKg > 0) || !(edad > 0)) return 0;
  const A = edad;
  const W = pesoKg;
  if (flags.ventilatorio) {
    const G = genero === "masculino" ? 1 : 0;
    const T = flags.trauma ? 1 : 0;
    const B = flags.quemadura ? 1 : 0;
    // IJEE(v) 1992
    return 1925 - 10 * A + 5 * W + 281 * G + 292 * T + 851 * B;
  }
  const O = flags.obesidad ? 1 : 0;
  // IJEE(s) espontánea
  return 629 - 11 * A + 25 * W - 609 * O;
}

/**
 * Peso de referencia hospitalario (nota EVANUT):
 * desnutrición → actual; sobrepeso → ideal; obesidad → ajustado.
 */
function suggestHospitalPesoRef(
  imc: number,
  pesoActual: number,
  pesoSaludable: number,
  pesoAjustado: number
): { peso: number; regla: string } {
  if (imc > 0 && imc < 18.5 && pesoActual > 0) {
    return { peso: pesoActual, regla: "Desnutrición → peso actual" };
  }
  if (imc >= 30 && pesoAjustado > 0) {
    return { peso: pesoAjustado, regla: "Obesidad → peso ajustado" };
  }
  if (imc >= 25 && pesoSaludable > 0) {
    return { peso: pesoSaludable, regla: "Sobrepeso → peso ideal (IMC 25)" };
  }
  if (pesoActual > 0) return { peso: pesoActual, regla: "Peso actual" };
  if (pesoSaludable > 0) return { peso: pesoSaludable, regla: "Peso saludable" };
  return { peso: 0, regla: "" };
}

/**
 * Energía hospitalizado EVANUT 4.1:
 * Harris / Mifflin → TMB × FA × FE
 * Ireton-Jones → EEE (incluye trauma/quemadura/obesidad; FA/FE opcionales)
 * kcal/kg → peso × kcal/kg
 */
function calculateHospitalizadoEnergia(fd: Record<string, any>) {
  const formula = fd.formula_requerimiento || "harris_benedict";
  const genero = String(fd.genero || "").toLowerCase();
  const edad = parseFloat(fd.edad) || 0;
  let alturaCm = parseFloat(fd.altura) || 0;
  const talonRodilla = parseFloat(fd.hosp_talon_rodilla_cm) || 0;
  const perimBrazo = parseFloat(fd.hosp_perim_brazo_cm) || 0;
  const perimPantorrilla = parseFloat(fd.hosp_perim_pantorrilla_cm) || 0;
  const pliegueSub = parseFloat(fd.hosp_pliegue_subescapular_mm) || 0;
  const tallaEstimada = calcChumleaTallaCm(talonRodilla, edad, genero);
  const pesoEstimado = calcChumleaPesoKg(
    perimBrazo,
    perimPantorrilla,
    talonRodilla,
    pliegueSub,
    genero
  );
  if (!(alturaCm > 0) && tallaEstimada > 0) alturaCm = tallaEstimada;

  const pesoActual =
    parseFloat(fd.peso_actual) ||
    (pesoEstimado > 0 ? pesoEstimado : 0);
  const alturaM = alturaCm > 0 ? alturaCm / 100 : 0;
  const imc = pesoActual > 0 && alturaM > 0 ? pesoActual / (alturaM * alturaM) : 0;
  const pesoSaludable =
    parseFloat(fd.peso_saludable) || (alturaM > 0 ? 25 * alturaM * alturaM : 0);
  const pesoAjustado =
    parseFloat(fd.peso_ajustado) ||
    (pesoActual > 0 && pesoSaludable > 0
      ? (pesoActual - pesoSaludable) * 0.25 + pesoSaludable
      : 0);

  const sugerido = suggestHospitalPesoRef(imc, pesoActual, pesoSaludable, pesoAjustado);
  const pesoRef =
    parseFloat(fd.peso_referencia_f2) ||
    parseFloat(fd.peso_objetivo) ||
    sugerido.peso ||
    pesoActual;

  const fa = parseFloat(fd.hosp_factor_actividad) || parseFloat(fd.factor_actividad) || 1.2;
  const fe = parseFloat(fd.hosp_factor_estres) || 1.0;
  const kcalKg = parseFloat(fd.rango_kcal_kg) || 0;
  const liquidosCcKg = parseFloat(fd.hosp_liquidos_cc_kg) || 35;
  const liquidosMl = pesoRef > 0 && liquidosCcKg > 0 ? pesoRef * liquidosCcKg : 0;

  const ventilatorio =
    fd.hosp_ventilatorio === true || fd.hosp_ventilatorio === "si" || fd.hosp_ventilatorio === "Sí";
  const obesidad =
    fd.hosp_obesidad === true ||
    fd.hosp_obesidad === "si" ||
    fd.hosp_obesidad === "Sí" ||
    imc >= 30;
  const trauma = fd.hosp_trauma === true || fd.hosp_trauma === "si" || fd.hosp_trauma === "Sí";
  const quemadura =
    fd.hosp_quemadura === true || fd.hosp_quemadura === "si" || fd.hosp_quemadura === "Sí";

  let tmb = 0;
  let eee = 0;
  let reqBase = 0;
  let metodoLabel = "Harris-Benedict × FA × FE";
  let usesFactors = true;

  if (formula === "rango_calorico") {
    metodoLabel = "Método del pulgar (kcal/kg)";
    reqBase = pesoRef > 0 && kcalKg > 0 ? pesoRef * kcalKg : 0;
    usesFactors = false;
  } else if (formula === "ireton_jones") {
    metodoLabel = ventilatorio
      ? "Ireton-Jones ventilatorio (1992)"
      : "Ireton-Jones espontánea";
    eee = calcIretonJones(pesoRef, edad, genero, {
      ventilatorio,
      obesidad,
      trauma,
      quemadura,
    });
    reqBase = eee > 0 ? eee * fa * fe : 0;
    tmb = eee;
  } else if (formula === "mifflin") {
    metodoLabel = "Mifflin-St Jeor × FA × FE";
    tmb = calcTmbMifflin(pesoRef, alturaCm, edad, genero);
    reqBase = tmb > 0 ? tmb * fa * fe : 0;
  } else {
    metodoLabel = "Harris-Benedict × FA × FE";
    tmb = calcTmbHarrisBenedict(pesoRef, alturaCm, edad, genero);
    reqBase = tmb > 0 ? tmb * fa * fe : 0;
  }

  const requerimientoFinal = applyAjusteCalorias(reqBase, fd);
  const parenteral = calculateParenteralHospitalizado(fd, {
    peso: pesoRef,
    calorias: requerimientoFinal || reqBase,
    liquidosMl,
  });

  return {
    formula,
    metodoLabel,
    pesoRef,
    pesoSaludable,
    pesoAjustado,
    imc,
    alturaCm,
    tallaEstimada,
    pesoEstimado,
    reglaPeso: sugerido.regla,
    tmb,
    eee,
    fa,
    fe,
    reqBase,
    requerimientoFinal,
    liquidosCcKg,
    liquidosMl,
    usesFactors,
    ventilatorio,
    obesidad,
    trauma,
    quemadura,
    parenteral,
  };
}

/**
 * Energía y valoración del adulto mayor (geriátrico):
 * Harris-Benedict / Mifflin / FAO-Schofield → TMB × FA × FE
 * rango_calorico → peso × kcal/kg (sin factores)
 * Incluye estimación Chumlea (talla/peso), IMC con puntos de corte
 * geriátricos (OPS/SENPE) y riesgo de sarcopenia por perímetro de pantorrilla.
 */
function calculateGeriatricoEnergia(fd: Record<string, any>) {
  const formula = fd.formula_requerimiento || "harris_benedict";
  const genero = String(fd.genero || "").toLowerCase();
  const edad = parseFloat(fd.edad) || 0;
  let alturaCm = parseFloat(fd.altura) || 0;
  const talonRodilla = parseFloat(fd.ger_talon_rodilla_cm) || 0;
  const perimBrazo = parseFloat(fd.ger_perim_brazo_cm) || 0;
  const perimPantorrilla = parseFloat(fd.ger_perim_pantorrilla_cm) || 0;
  const pliegueSub = parseFloat(fd.ger_pliegue_subescapular_mm) || 0;
  const tallaEstimada = calcChumleaTallaCm(talonRodilla, edad, genero);
  const pesoEstimado = calcChumleaPesoKg(
    perimBrazo,
    perimPantorrilla,
    talonRodilla,
    pliegueSub,
    genero
  );
  if (!(alturaCm > 0) && tallaEstimada > 0) alturaCm = tallaEstimada;

  const pesoActual =
    parseFloat(fd.peso_actual) || (pesoEstimado > 0 ? pesoEstimado : 0);
  const alturaM = alturaCm > 0 ? alturaCm / 100 : 0;
  const imc = pesoActual > 0 && alturaM > 0 ? pesoActual / (alturaM * alturaM) : 0;

  // Punto medio del rango normal geriátrico (22–27) → IMC objetivo 24.5
  const imcObjetivo = 24.5;
  const pesoSaludable =
    parseFloat(fd.peso_saludable) || (alturaM > 0 ? imcObjetivo * alturaM * alturaM : 0);
  const pesoAjustado =
    parseFloat(fd.peso_ajustado) ||
    (pesoActual > 0 && pesoSaludable > 0
      ? (pesoActual - pesoSaludable) * 0.25 + pesoSaludable
      : 0);

  // Clasificación IMC adulto mayor (OPS/SENPE)
  let clasificacionImc = "";
  if (imc > 0) {
    if (imc < 22) clasificacionImc = "Bajo peso · riesgo de desnutrición";
    else if (imc <= 27) clasificacionImc = "Adecuado para adulto mayor";
    else clasificacionImc = "Sobrepeso / obesidad";
  }

  // Riesgo de sarcopenia por perímetro de pantorrilla (< 31 cm)
  let riesgoSarcopenia = "";
  if (perimPantorrilla > 0) {
    riesgoSarcopenia =
      perimPantorrilla < 31
        ? "Riesgo de sarcopenia (pantorrilla < 31 cm)"
        : "Sin riesgo por perímetro de pantorrilla";
  }

  // Peso de referencia: bajo peso → actual (repleción); sobrepeso → ajustado
  let reglaPeso = "";
  let pesoRefSugerido = 0;
  if (imc > 0 && imc < 22 && pesoActual > 0) {
    pesoRefSugerido = pesoActual;
    reglaPeso = "Bajo peso → peso actual (repleción)";
  } else if (imc > 27 && pesoAjustado > 0) {
    pesoRefSugerido = pesoAjustado;
    reglaPeso = "Sobrepeso → peso ajustado";
  } else if (pesoActual > 0) {
    pesoRefSugerido = pesoActual;
    reglaPeso = "Peso actual";
  } else if (pesoSaludable > 0) {
    pesoRefSugerido = pesoSaludable;
    reglaPeso = "Peso saludable";
  }

  const pesoRef =
    parseFloat(fd.peso_referencia_f2) ||
    parseFloat(fd.peso_objetivo) ||
    pesoRefSugerido ||
    pesoActual;

  const fa = parseFloat(fd.ger_factor_actividad) || parseFloat(fd.factor_actividad) || 1.3;
  const fe = parseFloat(fd.ger_factor_estres) || 1.0;
  const kcalKg = parseFloat(fd.rango_kcal_kg) || 0;
  const liquidosCcKg = parseFloat(fd.ger_liquidos_cc_kg) || 30;
  const liquidosMl = pesoRef > 0 && liquidosCcKg > 0 ? pesoRef * liquidosCcKg : 0;

  let tmb = 0;
  let reqBase = 0;
  let metodoLabel = "Harris-Benedict × FA × FE";
  let usesFactors = true;

  if (formula === "rango_calorico") {
    metodoLabel = "Método del pulgar (kcal/kg)";
    reqBase = pesoRef > 0 && kcalKg > 0 ? pesoRef * kcalKg : 0;
    usesFactors = false;
  } else if (formula === "mifflin") {
    metodoLabel = "Mifflin-St Jeor × FA × FE";
    tmb = calcTmbMifflin(pesoRef, alturaCm, edad, genero);
    reqBase = tmb > 0 ? tmb * fa * fe : 0;
  } else if (formula === "schofield") {
    metodoLabel = "FAO/Schofield × FA × FE";
    tmb = calcTmbSchofield(pesoRef, edad, genero);
    reqBase = tmb > 0 ? tmb * fa * fe : 0;
  } else {
    metodoLabel = "Harris-Benedict × FA × FE";
    tmb = calcTmbHarrisBenedict(pesoRef, alturaCm, edad, genero);
    reqBase = tmb > 0 ? tmb * fa * fe : 0;
  }

  const requerimientoFinal = applyAjusteCalorias(reqBase, fd);

  return {
    formula,
    metodoLabel,
    pesoRef,
    pesoSaludable,
    pesoAjustado,
    imc,
    clasificacionImc,
    riesgoSarcopenia,
    alturaCm,
    tallaEstimada,
    pesoEstimado,
    reglaPeso,
    tmb,
    fa,
    fe,
    reqBase,
    requerimientoFinal,
    liquidosCcKg,
    liquidosMl,
    usesFactors,
  };
}

function buildGruposAlimentos(tipoPlan: string) {
  return getEvanutGruposForTipo(tipoPlan).reduce((acc, grupo) => {
    acc[grupo] = {
      ...emptyGrupoNutrients(),
      manual: isSuplementoGrupoKey(grupo),
    };
    return acc;
  }, {} as Record<string, any>);
}

const PLAN_WIZARD_DRAFT_KEY = "ndata_plan_wizard_draft";

type PlanTypeOption = {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
  cardHoverClass: string;
};

export const PLAN_TYPES: PlanTypeOption[] = [
  {
    value: "adulto",
    label: "Adulto",
    description: "Evaluación nutricional estándar y plan personalizado",
    icon: User,
    iconClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    cardHoverClass: "hover:border-emerald-400/60 hover:bg-emerald-500/[0.04]",
  },
  {
    value: "pediatria",
    label: "Pediatría",
    description: "Crecimiento, curvas OMS y requerimientos por edad",
    icon: Baby,
    iconClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    cardHoverClass: "hover:border-sky-400/60 hover:bg-sky-500/[0.04]",
  },
  {
    value: "gestante",
    label: "Gestante",
    description: "Ganancia ponderal, trimestres y RIEN gestacional",
    icon: Heart,
    iconClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    cardHoverClass: "hover:border-rose-400/60 hover:bg-rose-500/[0.04]",
  },
  {
    value: "gestante_adolescente",
    label: "Gestante adolescente",
    description: "Embarazo en adolescentes con curvas y metas específicas",
    icon: Users,
    iconClass: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
    cardHoverClass: "hover:border-fuchsia-400/60 hover:bg-fuchsia-500/[0.04]",
  },
  {
    value: "hospitalizado",
    label: "Hospitalizado",
    description: "Requerimientos clínicos, estrés y soporte enteral",
    icon: Hospital,
    iconClass: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    cardHoverClass: "hover:border-indigo-400/60 hover:bg-indigo-500/[0.04]",
  },
  {
    value: "geriatrico",
    label: "Geriátrico",
    description: "Adulto mayor, fragilidad y ajuste de requerimientos",
    icon: Accessibility,
    iconClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    cardHoverClass: "hover:border-amber-400/60 hover:bg-amber-500/[0.04]",
  },
  {
    value: "deportista",
    label: "Deportista",
    description: "Composición corporal, AMDR y minuta de alto rendimiento",
    icon: Dumbbell,
    iconClass: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    cardHoverClass: "hover:border-orange-400/60 hover:bg-orange-500/[0.04]",
  },
];

function getDefaultFormData() {
  return {
    tipo_plan: "adulto" as string,
    peso_actual: "",
    altura: "",
    edad: "",
    genero: "",
    peso_saludable: "",
    peso_ajustado: "",
    peso_objetivo: "",
    requerimiento_energetico: "",
    imc: "",
    tmb: "",
    factor_actividad: "",
    // Ajuste calórico Fase 1 (restricción / aumento)
    requerimiento_base_f1: "",
    ajuste_calorias_modo: "ninguno", // ninguno | restriccion | aumento
    ajuste_calorias_valor: "",
    // Fórmula de requerimiento adulto
    formula_requerimiento: "schofield", // schofield | harris_benedict | mifflin | rango_calorico | ireton_jones
    rango_kcal_kg: "25", // usado si formula = rango_calorico
    rango_objetivo: "mantenimiento", // perdida | mantenimiento | ganancia (preset UI)
    // Fase 1 Hospitalizado (EVANUT)
    hosp_factor_actividad: "1.15",
    hosp_actividad_preset: "cama",
    hosp_factor_estres: "1.0",
    hosp_estres_preset: "ninguno",
    hosp_liquidos_cc_kg: "35",
    hosp_talon_rodilla_cm: "",
    hosp_perim_brazo_cm: "",
    hosp_perim_pantorrilla_cm: "",
    hosp_pliegue_subescapular_mm: "",
    hosp_ventilatorio: "no",
    hosp_obesidad: "no",
    hosp_trauma: "no",
    hosp_quemadura: "no",
    // Fase 1 Geriátrico (adulto mayor)
    ger_factor_actividad: "1.3",
    ger_actividad_preset: "sedentario",
    ger_factor_estres: "1.0",
    ger_estres_preset: "ninguno",
    ger_liquidos_cc_kg: "30",
    ger_talon_rodilla_cm: "",
    ger_perim_brazo_cm: "",
    ger_perim_pantorrilla_cm: "",
    ger_pliegue_subescapular_mm: "",
    // Nutrición parenteral hospitalizado (EVANUT)
    pn_peso_kg: "",
    pn_calorias: "",
    pn_liquidos_ml: "",
    pn_prot_gkg: "1.2",
    pn_cho_gkg: "4",
    pn_na_meq_kg: "1.5",
    pn_k_meq_kg: "1.5",
    pn_ca_meq_dia: "12",
    pn_p_mmol_dia: "20",
    proteinas_gramos_f2: "",
    proteinas_calorias_f2: "",
    proteinas_amdr_f2: "",
    proteinas_avb_gramos: "",
    proteinas_avb_porcentaje: "",
    proteinas_kg_peso: "",
    grasas_gramos_f2: "",
    grasas_calorias_f2: "",
    grasas_amdr_f2: "",
    grasas_gs_gramos: "",
    grasas_gs_amdr: "",
    grasas_gm_gramos: "",
    grasas_gm_amdr: "",
    grasas_gp_gramos: "",
    grasas_gp_amdr: "",
    grasas_colesterol: "",
    cho_gramos_f2: "",
    cho_calorias_f2: "",
    cho_amdr_f2: "",
    cho_concent_gramos: "",
    cho_concent_amdr: "",
    total_calorias_f2: "",
    total_amdr_f2: "",
    total_fibra: "",
    peso_referencia_f2: "",
    cho_kg_peso: "",
    grupos_alimentos_f3: buildGruposAlimentos("adulto"),
    totals_f3: {
      kcal: 0,
      prot: 0,
      grasa: 0,
      gs: 0,
      gm: 0,
      gp: 0,
      col: 0,
      chos: 0,
      fd: 0,
      calcio: 0,
      p: 0,
      fe: 0,
      na: 0,
      k: 0,
      mg: 0,
      zn: 0,
      cu: 0
    },
    nombre_plan: "",
    descripcion: "",
    categoria: "",
    color: "primary",
    duracion: "",
    comidas_dia: "3",
    ingredientes_f4: {} as Record<string, any>,
    observaciones: "",
    weekly_menu_id: "",
    patient_id: "" as string | number,
    // Fase 1 Deportista: Somatotipo y composición corporal
    deportista_peso: "",
    deportista_triceps: "",
    deportista_subescapular: "",
    deportista_supraespinal: "",
    deportista_estatura: "",
    deportista_diametro_humero: "",
    deportista_diametro_femur: "",
    deportista_perim_brazo_tenso: "",
    deportista_perim_pantorrilla: "",
    deportista_pliegue_pantorrilla: "",
    deportista_yuhasz_sexo: "masculino",
    deportista_yuhasz_abdominal: "",
    deportista_yuhasz_muslo_medio: "",
    deportista_pct_grasa_esperado: "",
    // Ampliación: medidas / métodos de composición
    deportista_metodo_grasa: "yuhasz",
    deportista_talla_sentado: "",
    deportista_altura_rodilla: "",
    deportista_perim_brazo_relajado: "",
    deportista_biceps: "",
    deportista_pecho: "",
    deportista_edad_composicion: "",
    // Fase 1 Pediatría (EVANUT)
    pediatria_sexo: "femenino",
    pediatria_edad_anos: "",
    pediatria_edad_meses: "",
    pediatria_peso: "",
    pediatria_talla_cm: "",
    pediatria_peso_referencia: "",
    pediatria_imc_deseado: "",
    pediatria_alimentacion_0_1: "leche_materna", // leche_materna | formula | mixto
    pediatria_ganancia_g_dia: "",
    pediatria_kcal_por_gramo: "5",
    pediatria_actividad: "Moderado", // Sedentario | Moderado | Activo
    pediatria_deficit: "Ninguno", // Ninguno | Duplicar | Triplicar
    pediatria_perim_brazo_mm: "",
    pediatria_pliegue_tricipital_mm: "",
    pediatria_pliegue_subescapular_mm: "",
    pediatria_perimetro_cefalico: "",
    pediatria_fecha_nacimiento: "",
    // Fase 1 Gestante (EVANUT)
    gestante_edad: "",
    gestante_peso_preg: "",
    gestante_estatura_m: "",
    gestante_semana: "",
    gestante_peso_actual: "",
    gestante_peso_ref: "",
    gestante_imc_deseado: "",
    gestante_pal: "1.53",
    gestante_extra_normal_variant: "a", // a=85/285/475 ; b=-/360/475
    gestante_perim_brazo_mm: "",
    gestante_pliegue_tricipital_mm: "",
    gestante_pliegue_subescapular_mm: "",
    // Campos extra Ges Adoles
    gestante_puntaje_z: "",
    gestante_ganancia_diaria_g: "",
    gestante_actividad_adoles: "Moderado", // Sedentario | Moderado | Activo
  };
}

/** Energía y ganancia gestante según EVANUT 4.1 (+ fórmulas alternativas) */
function calculateGestanteEnergia(fd: Record<string, any>) {
  const pesoPreg = parseFloat(fd.gestante_peso_preg) || 0;
  let estM = parseFloat(fd.gestante_estatura_m) || 0;
  // permitir cm si el valor es > 3
  if (estM > 3) estM = estM / 100;
  const alturaCm = estM > 0 ? estM * 100 : 0;
  const semana = parseFloat(fd.gestante_semana) || 0;
  const pesoActual = parseFloat(fd.gestante_peso_actual) || 0;
  const edad = parseFloat(fd.gestante_edad) || 25;
  const pal = parseFloat(fd.gestante_pal) || 1.53;
  const imcDeseado = parseFloat(fd.gestante_imc_deseado) || 0;
  const formula = fd.formula_requerimiento || "schofield";
  const kcalKg = parseFloat(fd.rango_kcal_kg) || 0;

  const imcPreg = pesoPreg > 0 && estM > 0 ? pesoPreg / (estM * estM) : 0;
  const atalah = getAtalahClass(imcPreg);
  const imcGest = pesoActual > 0 && estM > 0 ? pesoActual / (estM * estM) : 0;
  const gananciaPresentada = pesoActual > 0 && pesoPreg > 0 ? pesoActual - pesoPreg : 0;

  const gains = getGestanteExpectedGainKg(atalah);
  const debioGanar = getGestanteDebioGanar(semana, gains.t1, gains.t23);
  const totalEsperado = gains.t1 + gains.t23;
  const trimestre = getTrimestreFromSemana(semana || 1);

  const pesoSaludable = imcDeseado > 0 && estM > 0 ? imcDeseado * estM * estM : 0;
  const pesoRef =
    parseFloat(fd.gestante_peso_ref) ||
    (pesoSaludable > 0 ? pesoSaludable : pesoPreg);

  let tmr = 0;
  let reqBase = 0;
  let metodoLabel = "FAO/Schofield";

  if (formula === "rango_calorico") {
    metodoLabel = "Rango calórico (kcal/kg)";
    reqBase = pesoRef > 0 && kcalKg > 0 ? pesoRef * kcalKg : 0;
  } else if (formula === "harris_benedict") {
    metodoLabel = "Harris-Benedict";
    tmr = calcTmbHarrisBenedict(pesoRef, alturaCm, edad, "femenino");
    reqBase = tmr > 0 ? tmr * pal : 0;
  } else if (formula === "mifflin") {
    metodoLabel = "Mifflin-St Jeor";
    tmr = calcTmbMifflin(pesoRef, alturaCm, edad, "femenino");
    reqBase = tmr > 0 ? tmr * pal : 0;
  } else {
    metodoLabel = "FAO/Schofield";
    // TMR Schofield mujeres (hoja Gestante)
    if (pesoRef > 0) {
      if (edad <= 30) tmr = 14.818 * pesoRef + 486.6;
      else tmr = 8.126 * pesoRef + 845.6;
    }
    reqBase = tmr * pal;
  }

  const extra = getGestanteExtraKcal(
    atalah,
    trimestre,
    fd.gestante_extra_normal_variant === "b" ? "b" : "a"
  );
  const requerimientoFinal = reqBase + extra;
  const rien = getGestanteRienTargets(atalah);

  // Braquial
  const perimBrazo = parseFloat(fd.gestante_perim_brazo_mm) || 0;
  const pliegueTri = parseFloat(fd.gestante_pliegue_tricipital_mm) || 0;
  const pliegueSub = parseFloat(fd.gestante_pliegue_subescapular_mm) || 0;
  const perimMuscularBrazo = perimBrazo > 0 ? perimBrazo - Math.PI * pliegueTri : 0;
  const areaMuscularBrazo = perimMuscularBrazo > 0 ? Math.pow(perimMuscularBrazo, 2) / (4 * Math.PI) : 0;
  const areaTotalBrazo = perimBrazo > 0 ? (Math.PI / 4) * Math.pow(perimBrazo / Math.PI, 2) : 0;
  const areaGrasaBrazo = areaTotalBrazo - areaMuscularBrazo;

  return {
    estM,
    imcPreg,
    atalah,
    imcGest,
    gananciaPresentada,
    gains,
    debioGanar,
    totalEsperado,
    trimestre,
    pesoSaludable,
    pesoRef,
    tmr,
    reqBase,
    extra,
    requerimientoFinal,
    rien,
    perimMuscularBrazo,
    areaMuscularBrazo,
    areaGrasaBrazo,
    adiposidad: pliegueTri + pliegueSub,
    formula,
    metodoLabel,
  };
}

/** Energía gestante adolescente (EVANUT Ges Adoles + fórmulas alternativas) */
function calculateGestanteAdolescenteEnergia(fd: Record<string, any>) {
  const pesoPreg = parseFloat(fd.gestante_peso_preg) || 0;
  let estM = parseFloat(fd.gestante_estatura_m) || 0;
  if (estM > 3) estM = estM / 100;
  const alturaCm = estM > 0 ? estM * 100 : 0;
  const semana = parseFloat(fd.gestante_semana) || 0;
  const pesoActual = parseFloat(fd.gestante_peso_actual) || 0;
  const edad = parseFloat(fd.gestante_edad) || 15;
  const z = parseFloat(fd.gestante_puntaje_z);
  const zClass = getGestAdolesZClass(z);
  const imcPreg = pesoPreg > 0 && estM > 0 ? pesoPreg / (estM * estM) : 0;
  const imcGest = pesoActual > 0 && estM > 0 ? pesoActual / (estM * estM) : 0;
  const gananciaPresentada = pesoActual > 0 && pesoPreg > 0 ? pesoActual - pesoPreg : 0;

  const gains = getGestAdolesExpectedGainKg(z);
  const debioGanar = getGestanteDebioGanar(semana, gains.t1, gains.t23);
  const totalEsperado = gains.t1 + gains.t23;
  const trimestre = getTrimestreFromSemana(semana || 1);

  const gananciaSugerida = getGestAdolesDailyGainG(edad);
  const gananciaDiaria =
    parseFloat(fd.gestante_ganancia_diaria_g) || gananciaSugerida;
  const actividad = fd.gestante_actividad_adoles || "Moderado";
  const formula = fd.formula_requerimiento || "schofield";
  const kcalKg = parseFloat(fd.rango_kcal_kg) || 0;

  let factorAct = 1;
  if (actividad === "Sedentario") factorAct = 0.85;
  else if (actividad === "Activo") factorAct = 1.15;

  let get = 0;
  let tmr = 0;
  let reqBase = 0;
  let metodoLabel = "GET FAO + crecimiento";

  const imcDeseado = parseFloat(fd.gestante_imc_deseado) || 24;
  const pesoSaludable = imcDeseado > 0 && estM > 0 ? imcDeseado * estM * estM : 0;
  const pesoRef = parseFloat(fd.gestante_peso_ref) || pesoPreg;

  if (formula === "rango_calorico") {
    metodoLabel = "Rango calórico (kcal/kg)";
    reqBase = pesoRef > 0 && kcalKg > 0 ? pesoRef * kcalKg : 0;
  } else if (formula === "harris_benedict") {
    metodoLabel = "Harris-Benedict + crecimiento";
    tmr = calcTmbHarrisBenedict(pesoRef, alturaCm, edad, "femenino");
    // Misma lógica Ges Adoles: (TMB + g×2) × actividad
    reqBase = tmr > 0 ? (tmr + gananciaDiaria * 2) * factorAct : 0;
  } else if (formula === "mifflin") {
    metodoLabel = "Mifflin-St Jeor + crecimiento";
    tmr = calcTmbMifflin(pesoRef, alturaCm, edad, "femenino");
    reqBase = tmr > 0 ? (tmr + gananciaDiaria * 2) * factorAct : 0;
  } else {
    metodoLabel = "GET FAO + crecimiento";
    const base = getGestAdolesBaseReq(pesoPreg, gananciaDiaria, actividad);
    get = base.get;
    reqBase = base.requerimiento;
    factorAct = base.factor;
  }

  const extra = getGestAdolesExtraKcal(zClass, trimestre);
  const requerimientoFinal = reqBase + extra;
  const bajo = zClass === "Delgadez" || zClass === "Riesgo delgadez";
  const rien = getGestanteRienTargets(bajo ? "Bajo" : "Normal");

  return {
    estM,
    imcPreg,
    imcGest,
    z,
    zClass,
    gananciaPresentada,
    gains,
    debioGanar,
    totalEsperado,
    trimestre,
    gananciaSugerida,
    gananciaDiaria,
    get,
    tmr,
    reqBase,
    factorAct,
    extra,
    requerimientoFinal,
    rien,
    pesoSaludable,
    pesoRef,
    actividad,
    formula,
    metodoLabel,
  };
}

/** Energía pediátrica según EVANUT 4.1 / FAO OMS 2005 */
function calculatePediatriaEnergia(fd: Record<string, any>) {
  const pesoActual = parseFloat(fd.pediatria_peso) || 0;
  const tallaCm = parseFloat(fd.pediatria_talla_cm) || 0;
  const tallaM = tallaCm > 0 ? tallaCm / 100 : 0;
  const imc = pesoActual > 0 && tallaM > 0 ? pesoActual / (tallaM * tallaM) : 0;
  const imcDeseado = parseFloat(fd.pediatria_imc_deseado) || 0;
  const pesoRefImc = imcDeseado > 0 && tallaM > 0 ? imcDeseado * tallaM * tallaM : 0;
  const pesoRef =
    parseFloat(fd.pediatria_peso_referencia) ||
    (pesoRefImc > 0 ? pesoRefImc : pesoActual);

  const anos = parseFloat(fd.pediatria_edad_anos) || 0;
  const meses = parseFloat(fd.pediatria_edad_meses) || 0;
  const ageYears = anos + meses / 12;
  const isMujer = (fd.pediatria_sexo || "").toLowerCase().startsWith("f") || fd.pediatria_sexo === "femenino" || fd.pediatria_sexo === "Mujer";

  // GER 0-1 año
  const gerLm = -152 + 92.8 * pesoRef;
  const gerFormula = -29 + 82.6 * pesoRef;
  const gerMixto = -95.4 + 88.3 * pesoRef;
  // GER 1-18 años
  const ger1a18 = isMujer
    ? 263.4 + 65.3 * pesoRef - 0.454 * Math.pow(pesoRef, 2)
    : 310.2 + 63.3 * pesoRef - 0.263 * Math.pow(pesoRef, 2);

  let gerBase = 0;
  let gerModo = "";
  if (ageYears < 1 && ageYears >= 0) {
    const feed = fd.pediatria_alimentacion_0_1 || "leche_materna";
    if (feed === "formula") {
      gerBase = gerFormula;
      gerModo = "0-1 año solo fórmula";
    } else if (feed === "mixto") {
      gerBase = gerMixto;
      gerModo = "0-1 año mixto";
    } else {
      gerBase = gerLm;
      gerModo = "0-1 año leche materna";
    }
  } else {
    gerBase = ger1a18;
    gerModo = isMujer ? "1-18 años (mujer)" : "1-18 años (hombre)";
  }

  const ganancia = parseFloat(fd.pediatria_ganancia_g_dia) || 0;
  const kcalGramo = parseFloat(fd.pediatria_kcal_por_gramo) || 5;
  const adicionalesCrecimiento = ganancia * kcalGramo;
  const gastoConCrecimiento = gerBase + adicionalesCrecimiento;

  const act = fd.pediatria_actividad || "Moderado";
  let factorAct = 1;
  if (act === "Sedentario") factorAct = 0.85;
  else if (act === "Activo") factorAct = 1.15;
  const requerimientoBase = gastoConCrecimiento * factorAct;

  const deficit = fd.pediatria_deficit || "Ninguno";
  let factorDeficit = 0;
  if (deficit === "Duplicar") factorDeficit = 2;
  else if (deficit === "Triplicar") factorDeficit = 3;
  const catchUpKcal = factorDeficit > 0 ? ganancia * factorDeficit * 5 : 0;
  const requerimientoFinal = requerimientoBase + catchUpKcal;

  // Antropometría braquial (mm)
  const perimBrazo = parseFloat(fd.pediatria_perim_brazo_mm) || 0;
  const pliegueTri = parseFloat(fd.pediatria_pliegue_tricipital_mm) || 0;
  const pliegueSub = parseFloat(fd.pediatria_pliegue_subescapular_mm) || 0;
  const perimMuscularBrazo = perimBrazo > 0 ? perimBrazo - Math.PI * pliegueTri : 0;
  const areaMuscularBrazo = perimMuscularBrazo > 0 ? Math.pow(perimMuscularBrazo, 2) / (4 * Math.PI) : 0;
  const areaTotalBrazo = perimBrazo > 0 ? (Math.PI / 4) * Math.pow(perimBrazo / Math.PI, 2) : 0;
  const areaGrasaBrazo = areaTotalBrazo - areaMuscularBrazo;
  const adiposidad = pliegueTri + pliegueSub;

  const rien = getPediatriaRienTargets(ageYears || 1);

  return {
    pesoRef,
    pesoRefImc,
    tallaM,
    imc,
    ageYears,
    gerLm,
    gerFormula,
    gerMixto,
    ger1a18,
    gerBase,
    gerModo,
    adicionalesCrecimiento,
    gastoConCrecimiento,
    factorAct,
    requerimientoBase,
    catchUpKcal,
    requerimientoFinal,
    perimMuscularBrazo,
    areaMuscularBrazo,
    areaTotalBrazo,
    areaGrasaBrazo,
    adiposidad,
    rien,
  };
}

/** Cálculos Fase 1 Deportista según EVANUT 4.1 (hoja Deportista) + ampliaciones */
function calculateDeportistaMetrics(fd: Record<string, any>) {
  const triceps = parseFloat(fd.deportista_triceps) || 0;
  const subescapular = parseFloat(fd.deportista_subescapular) || 0;
  const supraespinal = parseFloat(fd.deportista_supraespinal) || 0;
  const peso = parseFloat(fd.deportista_peso) || 0;
  const est = parseFloat(fd.deportista_estatura) || 0;
  const perimBrazo = parseFloat(fd.deportista_perim_brazo_tenso) || 0;
  const plieguePant = parseFloat(fd.deportista_pliegue_pantorrilla) || 0;
  const perimPant = parseFloat(fd.deportista_perim_pantorrilla) || 0;
  const diamHum = parseFloat(fd.deportista_diametro_humero) || 0;
  const diamFem = parseFloat(fd.deportista_diametro_femur) || 0;
  const abdominal = parseFloat(fd.deportista_yuhasz_abdominal) || 0;
  const musloMedio = parseFloat(fd.deportista_yuhasz_muslo_medio) || 0;
  const pctEsperado = parseFloat(fd.deportista_pct_grasa_esperado) || 0;
  const isHombre = fd.deportista_yuhasz_sexo !== "femenino";
  const metodoGrasa = String(fd.deportista_metodo_grasa || "yuhasz");
  const tallaSentado = parseFloat(fd.deportista_talla_sentado) || 0;
  const alturaRodilla = parseFloat(fd.deportista_altura_rodilla) || 0;
  const perimBrazoRelajado = parseFloat(fd.deportista_perim_brazo_relajado) || perimBrazo;
  const biceps = parseFloat(fd.deportista_biceps) || 0;
  const pecho = parseFloat(fd.deportista_pecho) || 0;
  const edadComp =
    parseFloat(fd.deportista_edad_composicion) ||
    parseFloat(fd.edad) ||
    parseFloat(fd.pediatria_edad_anos) ||
    25;

  // Excel: C9 = SUM(C6:C8)
  const sumatoria = triceps + subescapular + supraespinal;
  // Excel: C10 = C9*(170.18/C11)
  const correccionProp = est > 0 ? sumatoria * (170.18 / est) : 0;
  // Excel: C15 = C14-(C6/10)  → brazo tenso − (tríceps mm / 10)
  const perimBrazoCorr = perimBrazo - triceps / 10;
  // Excel: C18 = C16-(C17/10) → pantorrilla − (pliegue pantorrilla mm / 10)
  const perimPantCorr = perimPant - plieguePant / 10;
  // Excel: C19 = C11/(C5^0.333)
  const hwr = peso > 0 && est > 0 ? est / Math.pow(peso, 1 / 3) : 0;

  // Excel: C21 = (0.1451*C10)-(0.00068*(C10^2))+(0.0000014*(C10^3))-0.7182
  const endomorfia =
    correccionProp > 0
      ? 0.1451 * correccionProp -
        0.00068 * Math.pow(correccionProp, 2) +
        0.0000014 * Math.pow(correccionProp, 3) -
        0.7182
      : 0;

  // Excel: C22 = (0.858*C12)+(0.601*C13)+(0.188*C15)+(0.161*C18)-(0.131*C11)+4.5
  const mesomorfia =
    est > 0
      ? 0.858 * diamHum +
        0.601 * diamFem +
        0.188 * perimBrazoCorr +
        0.161 * perimPantCorr -
        0.131 * est +
        4.5
      : 0;

  // Excel: C23 ectomorfia
  let ectomorfia = 0;
  if (hwr >= 40.75) ectomorfia = hwr * 0.732 - 28.58;
  else if (hwr > 38.25 && hwr < 40.75) ectomorfia = hwr * 0.463 - 17.63;
  else if (hwr > 0) ectomorfia = 0.1;

  // Excel: C25=X=C23-C21 ; C26=Y=(2*C22)-(C23+C21)
  const coordX = ectomorfia - endomorfia;
  const coordY = 2 * mesomorfia - (ectomorfia + endomorfia);

  // --- Índice córmico ---
  const indiceCormico = est > 0 && tallaSentado > 0 ? (tallaSentado / est) * 100 : 0;
  let clasificacionCormico = "";
  if (indiceCormico > 0) {
    if (indiceCormico < 51) clasificacionCormico = "Braquicórmico";
    else if (indiceCormico <= 53) clasificacionCormico = "Metricórmico";
    else clasificacionCormico = "Longicórmico";
  }

  // --- Estimación de talla (Chumlea, altura de rodilla cm) ---
  let tallaEstimada = 0;
  if (alturaRodilla > 0) {
    tallaEstimada = isHombre
      ? 64.19 - 0.04 * edadComp + 2.02 * alturaRodilla
      : 84.88 - 0.24 * edadComp + 1.83 * alturaRodilla;
  }

  // --- AB / AMB / AGM (área braquial, muscular y grasa) ---
  // CB en cm, PCT en mm → Frisancho
  const cb = perimBrazoRelajado; // cm
  const pctMm = triceps;
  let areaBraquial = 0; // AB cm²
  let areaMuscularBrazo = 0; // AMB cm²
  let areaGrasaBrazo = 0; // AGM/AGB cm²
  let perimetroMuscularBrazo = 0;
  if (cb > 0) {
    areaBraquial = (cb * cb) / (4 * Math.PI);
    if (pctMm > 0) {
      perimetroMuscularBrazo = cb - Math.PI * (pctMm / 10);
      // Corrección ósea aproximada: −10 ♂ / −6.5 ♀
      const boneCorr = isHombre ? 10 : 6.5;
      areaMuscularBrazo = Math.max(0, (perimetroMuscularBrazo * perimetroMuscularBrazo) / (4 * Math.PI) - boneCorr);
      areaGrasaBrazo = Math.max(0, areaBraquial - areaMuscularBrazo);
    }
  }

  // Excel: R5 = SUM(C30:C35) pliegues Yuhasz
  const sumYuhasz = triceps + subescapular + supraespinal + plieguePant + abdominal + musloMedio;
  // Excel: C36 hombre (0.1051*R5)+2.585 ; mujer (0.1548*R5)+3.588
  const pctGrasaYuhasz =
    sumYuhasz > 0
      ? isHombre
        ? 0.1051 * sumYuhasz + 2.585
        : 0.1548 * sumYuhasz + 3.588
      : 0;

  // --- Durnin & Womersley (4 pliegues) → densidad → Brozek / Siri ---
  const sumDurnin = triceps + biceps + subescapular + supraespinal;
  const logDurnin = sumDurnin > 0 ? Math.log10(sumDurnin) : 0;
  let densidadDurnin = 0;
  if (logDurnin > 0) {
    if (isHombre) {
      if (edadComp < 20) densidadDurnin = 1.1620 - 0.0630 * logDurnin;
      else if (edadComp < 30) densidadDurnin = 1.1631 - 0.0632 * logDurnin;
      else if (edadComp < 40) densidadDurnin = 1.1422 - 0.0544 * logDurnin;
      else if (edadComp < 50) densidadDurnin = 1.1620 - 0.0700 * logDurnin;
      else densidadDurnin = 1.1715 - 0.0779 * logDurnin;
    } else {
      if (edadComp < 20) densidadDurnin = 1.1549 - 0.0678 * logDurnin;
      else if (edadComp < 30) densidadDurnin = 1.1599 - 0.0717 * logDurnin;
      else if (edadComp < 40) densidadDurnin = 1.1423 - 0.0632 * logDurnin;
      else if (edadComp < 50) densidadDurnin = 1.1333 - 0.0612 * logDurnin;
      else densidadDurnin = 1.1339 - 0.0645 * logDurnin;
    }
  }
  const pctGrasaSiriFromDurnin =
    densidadDurnin > 0 ? (4.95 / densidadDurnin - 4.5) * 100 : 0;
  const pctGrasaBrozekFromDurnin =
    densidadDurnin > 0 ? (4.57 / densidadDurnin - 4.142) * 100 : 0;

  // --- Jackson & Pollock 3 sitios ---
  // Hombre: pecho + abdominal + muslo | Mujer: tríceps + supraespinal + muslo
  const sumJackson = isHombre
    ? pecho + abdominal + musloMedio
    : triceps + supraespinal + musloMedio;
  let densidadJackson = 0;
  if (sumJackson > 0) {
    if (isHombre) {
      densidadJackson =
        1.10938 -
        0.0008267 * sumJackson +
        0.0000016 * Math.pow(sumJackson, 2) -
        0.0002574 * edadComp;
    } else {
      densidadJackson =
        1.0994921 -
        0.0009929 * sumJackson +
        0.0000023 * Math.pow(sumJackson, 2) -
        0.0001392 * edadComp;
    }
  }
  const pctGrasaJackson =
    densidadJackson > 0 ? (4.95 / densidadJackson - 4.5) * 100 : 0;
  const pctGrasaJacksonBrozek =
    densidadJackson > 0 ? (4.57 / densidadJackson - 4.142) * 100 : 0;

  // Método seleccionado
  let pctGrasaSeleccionado = 0;
  let densidadSeleccionada = 0;
  let metodoGrasaLabel = "Yuhasz";
  if (metodoGrasa === "durnin") {
    pctGrasaSeleccionado = pctGrasaSiriFromDurnin;
    densidadSeleccionada = densidadDurnin;
    metodoGrasaLabel = "Durnin & Womersley";
  } else if (metodoGrasa === "jackson_pollock") {
    pctGrasaSeleccionado = pctGrasaJackson;
    densidadSeleccionada = densidadJackson;
    metodoGrasaLabel = "Jackson & Pollock";
  } else if (metodoGrasa === "brozek") {
    // Brozek: usa densidad Durnin (si hay) o Jackson
    if (densidadDurnin > 0) {
      pctGrasaSeleccionado = pctGrasaBrozekFromDurnin;
      densidadSeleccionada = densidadDurnin;
    } else {
      pctGrasaSeleccionado = pctGrasaJacksonBrozek;
      densidadSeleccionada = densidadJackson;
    }
    metodoGrasaLabel = "Brozek";
  } else {
    pctGrasaSeleccionado = pctGrasaYuhasz;
    metodoGrasaLabel = "Yuhasz";
  }

  const pesoGraso = peso > 0 && pctGrasaSeleccionado > 0 ? (peso * pctGrasaSeleccionado) / 100 : 0;
  const masaLibreGrasa = peso > 0 ? peso - pesoGraso : 0;
  // Excel: C39 = (C38*100000)/(C11^3)
  const aks = est > 0 && masaLibreGrasa > 0 ? (masaLibreGrasa * 100000) / Math.pow(est, 3) : 0;
  let clasificacionAks = "";
  if (aks > 0) {
    if (aks < 0.99) clasificacionAks = "Deficiente masa muscular";
    else if (aks >= 1 && aks <= 1.12) clasificacionAks = "Adecuada masa muscular";
    else clasificacionAks = "Excelente masa muscular";
  }
  // Excel: C43 = C38/(1-(C42/100))
  const pesoOptimo =
    masaLibreGrasa > 0 && pctEsperado < 100 ? masaLibreGrasa / (1 - pctEsperado / 100) : 0;

  // --- Modelo de 5 componentes (aproximación von Döbeln / Würch) ---
  const estM = est / 100;
  const humM = diamHum / 100;
  const femM = diamFem / 100;
  let masaOsea = 0;
  if (estM > 0 && humM > 0 && femM > 0) {
    // von Döbeln: 3.02 × (H² × T × F × 400)^0.712
    masaOsea = 3.02 * Math.pow(estM * estM * humM * femM * 400, 0.712);
  }
  const masaResidual = peso > 0 ? peso * (isHombre ? 0.241 : 0.209) : 0;
  const masaMuscular =
    peso > 0 ? Math.max(0, peso - pesoGraso - masaOsea - masaResidual) : 0;
  const suma5Componentes = pesoGraso + masaOsea + masaResidual + masaMuscular;

  return {
    sumatoria,
    correccionProp,
    perimBrazoCorr,
    perimPantCorr,
    hwr,
    endomorfia,
    mesomorfia,
    ectomorfia,
    coordX,
    coordY,
    sumYuhasz,
    pctGrasaYuhasz,
    // retrocompat: pct usado como "principal"
    pctGrasaSeleccionado,
    metodoGrasaLabel,
    densidadSeleccionada,
    pctGrasaDurnin: pctGrasaSiriFromDurnin,
    pctGrasaBrozek: pctGrasaBrozekFromDurnin,
    pctGrasaJackson,
    sumDurnin,
    sumJackson,
    indiceCormico,
    clasificacionCormico,
    tallaEstimada,
    areaBraquial,
    areaMuscularBrazo,
    areaGrasaBrazo,
    perimetroMuscularBrazo,
    pesoGraso,
    masaLibreGrasa,
    aks,
    clasificacionAks,
    pesoOptimo,
    masaOsea,
    masaResidual,
    masaMuscular,
    suma5Componentes,
  };
}

function getDraftKey(patientIdOrFormPatient: number | string | undefined | null): string {
  const id = patientIdOrFormPatient === "" || patientIdOrFormPatient == null ? 0 : patientIdOrFormPatient;
  return `${PLAN_WIZARD_DRAFT_KEY}_${id}`;
}

function mergeFormDataWithDefaults(saved: any): any {
  const defaultData = getDefaultFormData();
  if (!saved || typeof saved !== "object") return defaultData;
  if (saved.tipo_plan === "deportista") {
    defaultData.grupos_alimentos_f3 = buildGruposAlimentos("deportista");
  }
  if (saved.tipo_plan === "pediatria") {
    defaultData.grupos_alimentos_f3 = buildGruposAlimentos("pediatria");
  }
  if (saved.tipo_plan === "gestante" || saved.tipo_plan === "gestante_adolescente") {
    defaultData.grupos_alimentos_f3 = buildGruposAlimentos("gestante");
  }
  if (saved.tipo_plan === "hospitalizado") {
    defaultData.grupos_alimentos_f3 = buildGruposAlimentos("hospitalizado");
    defaultData.formula_requerimiento = "harris_benedict";
  }
  if (saved.tipo_plan === "geriatrico") {
    defaultData.grupos_alimentos_f3 = buildGruposAlimentos("geriatrico");
    defaultData.formula_requerimiento = "harris_benedict";
  }
  const merged = { ...defaultData };
  for (const key of Object.keys(defaultData)) {
    if (saved[key] === undefined) continue;
    if (key === "grupos_alimentos_f3" && saved[key] && typeof saved[key] === "object") {
      const defaultGroups = defaultData.grupos_alimentos_f3;
      merged.grupos_alimentos_f3 = { ...defaultGroups };
      for (const g of Object.keys(saved.grupos_alimentos_f3 || {})) {
        if (defaultGroups[g]) {
          merged.grupos_alimentos_f3[g] = { ...defaultGroups[g], ...(saved.grupos_alimentos_f3[g] || {}) };
        } else {
          merged.grupos_alimentos_f3[g] = saved.grupos_alimentos_f3[g];
        }
      }
    } else if (key === "totals_f3" && saved[key] && typeof saved[key] === "object") {
      merged.totals_f3 = { ...defaultData.totals_f3, ...saved.totals_f3 };
    } else if (key === "ingredientes_f4" && saved[key] && typeof saved[key] === "object") {
      merged.ingredientes_f4 = { ...(saved.ingredientes_f4 || {}) };
    } else {
      merged[key] = saved[key];
    }
  }
  return merged;
}

export function NewPlanWizard({ open, onOpenChange, onCreatePlan, patientId, initialTipoPlan }: NewPlanWizardProps) {
  const [currentPhase, setCurrentPhase] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [formData, setFormData] = useState(getDefaultFormData);

  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [weeklyMenus, setWeeklyMenus] = useState<any[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [detailedMenu, setDetailedMenu] = useState<any>(null);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  // Guardar gramos base de Fase 4 (sin multiplicador) y multiplicadores por ingrediente
  const [baseIngredientsF4, setBaseIngredientsF4] = useState<Record<string, any>>({});
  const [ingredientMultipliers, setIngredientMultipliers] = useState<Record<string, any>>({});
  const [patientsList, setPatientsList] = useState<{ id: number; name: string }[]>([]);
  const [loadingPatientsList, setLoadingPatientsList] = useState(false);
  const { toast } = useToast();

  const currentPhaseData = PHASES.find(p => p.id === currentPhase) || PHASES[0];
  const phaseTitle = formData.tipo_plan === "deportista" && (currentPhaseData as any).titleDeportista
    ? (currentPhaseData as any).titleDeportista
    : formData.tipo_plan === "pediatria" && (currentPhaseData as any).titlePediatria
      ? (currentPhaseData as any).titlePediatria
      : isGestAdoles(formData.tipo_plan) && (currentPhaseData as any).titleGestAdoles
        ? (currentPhaseData as any).titleGestAdoles
      : formData.tipo_plan === "gestante" && (currentPhaseData as any).titleGestante
        ? (currentPhaseData as any).titleGestante
      : isHospitalizado(formData.tipo_plan) && (currentPhaseData as any).titleHospitalizado
        ? (currentPhaseData as any).titleHospitalizado
      : isGeriatrico(formData.tipo_plan) && (currentPhaseData as any).titleGeriatrico
        ? (currentPhaseData as any).titleGeriatrico
      : currentPhaseData.title;
  const phaseDescription = formData.tipo_plan === "deportista" && (currentPhaseData as any).descriptionDeportista
    ? (currentPhaseData as any).descriptionDeportista
    : formData.tipo_plan === "pediatria" && (currentPhaseData as any).descriptionPediatria
      ? (currentPhaseData as any).descriptionPediatria
      : isGestAdoles(formData.tipo_plan) && (currentPhaseData as any).descriptionGestAdoles
        ? (currentPhaseData as any).descriptionGestAdoles
      : formData.tipo_plan === "gestante" && (currentPhaseData as any).descriptionGestante
        ? (currentPhaseData as any).descriptionGestante
      : isHospitalizado(formData.tipo_plan) && (currentPhaseData as any).descriptionHospitalizado
        ? (currentPhaseData as any).descriptionHospitalizado
      : isGeriatrico(formData.tipo_plan) && (currentPhaseData as any).descriptionGeriatrico
        ? (currentPhaseData as any).descriptionGeriatrico
      : currentPhaseData.description;
  const gruposFase3 = (() => {
    const base = getEvanutGruposForTipo(formData.tipo_plan);
    const extras = Object.keys(formData.grupos_alimentos_f3 || {})
      .filter((k) => k.startsWith(SUPLEMENTO_EXTRA_PREFIX))
      .sort();
    if (!extras.length) return base;
    const out: string[] = [];
    for (const g of base) {
      out.push(g);
      if (g === SUPLEMENTOS_GRUPO) out.push(...extras);
    }
    return out;
  })();

  const computeTmbValue = (pesoValue: string, edadValue: string, generoValue: string, alturaValue?: string, formula?: string) => {
    const formulaSel = formula || formData.formula_requerimiento || "schofield";
    const peso = parseFloat(pesoValue);
    const edad = parseFloat(edadValue);
    const genero = generoValue;
    const altura = parseFloat(alturaValue || formData.altura) || 0;

    if (isNaN(peso) || isNaN(edad) || peso <= 0 || edad <= 0 || !genero) {
      return null;
    }
    if (formulaSel === "harris_benedict") {
      const t = calcTmbHarrisBenedict(peso, altura, edad, genero);
      return t > 0 ? t : null;
    }
    if (formulaSel === "mifflin") {
      const t = calcTmbMifflin(peso, altura, edad, genero);
      return t > 0 ? t : null;
    }
    if (formulaSel === "rango_calorico") {
      return null; // no TMB
    }
    const t = calcTmbSchofield(peso, edad, genero);
    return t > 0 ? t : null;
  };

  /** Recalcula TMB + requerimiento adulto según fórmula seleccionada */
  const recalculateAdultRequirement = (overrides: Record<string, any> = {}) => {
    setFormData((prev: any) => {
      const merged = { ...prev, ...overrides };
      const calc = calculateAdultEnergia(merged);
      const adj = withAjusteCaloriasFields(calc.reqBase, merged);
      const isRango = (merged.formula_requerimiento || "schofield") === "rango_calorico";
      return {
        ...merged,
        ...adj,
        tmb: calc.tmb > 0 ? calc.tmb.toFixed(2) : isRango ? "" : (adj.requerimiento_base_f1 ? prev.tmb : ""),
      };
    });
  };

  const formulaIsRango = (fd: Record<string, any> = formData) =>
    (fd.formula_requerimiento || "schofield") === "rango_calorico";

  const recalculateHospitalizadoRequirement = (overrides: Record<string, any> = {}) => {
    setFormData((prev: any) => {
      const merged = { ...prev, ...overrides };
      // Asegurar defaults hospitalarios
      if (!merged.formula_requerimiento || merged.formula_requerimiento === "schofield") {
        if (overrides.formula_requerimiento == null) merged.formula_requerimiento = "harris_benedict";
      }
      const calc = calculateHospitalizadoEnergia(merged);
      const adj = withAjusteCaloriasFields(calc.reqBase, merged);
      const isRango = (merged.formula_requerimiento || "harris_benedict") === "rango_calorico";
      return {
        ...merged,
        ...adj,
        imc: calc.imc > 0 ? calc.imc.toFixed(2) : merged.imc,
        peso_saludable: calc.pesoSaludable > 0 ? calc.pesoSaludable.toFixed(2) : merged.peso_saludable,
        peso_ajustado: calc.pesoAjustado > 0 ? calc.pesoAjustado.toFixed(2) : merged.peso_ajustado,
        peso_referencia_f2: String(
          overrides.peso_referencia_f2 ??
            merged.peso_referencia_f2 ??
            (calc.pesoRef > 0 ? calc.pesoRef.toFixed(2) : "")
        ),
        factor_actividad: String(calc.fa),
        tmb: calc.tmb > 0 ? calc.tmb.toFixed(2) : isRango ? "" : (adj.requerimiento_base_f1 ? prev.tmb : ""),
      };
    });
  };

  const recalculateGeriatricoRequirement = (overrides: Record<string, any> = {}) => {
    setFormData((prev: any) => {
      const merged = { ...prev, ...overrides };
      if (!merged.formula_requerimiento || merged.formula_requerimiento === "schofield") {
        if (overrides.formula_requerimiento == null && !merged.formula_requerimiento) {
          merged.formula_requerimiento = "harris_benedict";
        }
      }
      const calc = calculateGeriatricoEnergia(merged);
      const adj = withAjusteCaloriasFields(calc.reqBase, merged);
      const isRango = (merged.formula_requerimiento || "harris_benedict") === "rango_calorico";
      return {
        ...merged,
        ...adj,
        imc: calc.imc > 0 ? calc.imc.toFixed(2) : merged.imc,
        peso_saludable: calc.pesoSaludable > 0 ? calc.pesoSaludable.toFixed(2) : merged.peso_saludable,
        peso_ajustado: calc.pesoAjustado > 0 ? calc.pesoAjustado.toFixed(2) : merged.peso_ajustado,
        peso_referencia_f2: String(
          overrides.peso_referencia_f2 ??
            merged.peso_referencia_f2 ??
            (calc.pesoRef > 0 ? calc.pesoRef.toFixed(2) : "")
        ),
        factor_actividad: String(calc.fa),
        tmb: calc.tmb > 0 ? calc.tmb.toFixed(2) : isRango ? "" : (adj.requerimiento_base_f1 ? prev.tmb : ""),
      };
    });
  };

  const computeAgeYears = (fechaNacimiento?: string | null) => {
    if (!fechaNacimiento) return "";
    const birth = new Date(fechaNacimiento);
    if (Number.isNaN(birth.getTime())) return "";
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      years -= 1;
    }
    return years >= 0 ? String(years) : "";
  };

  const computeAgeDetail = (fechaNacimiento?: string | null) => {
    if (!fechaNacimiento) return { years: "", months: "", decimal: 0 };
    const birth = new Date(fechaNacimiento);
    if (Number.isNaN(birth.getTime())) return { years: "", months: "", decimal: 0 };
    const today = new Date();
    let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
    if (today.getDate() < birth.getDate()) months -= 1;
    if (months < 0) months = 0;
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return {
      years: String(years),
      months: String(remMonths),
      decimal: months / 12,
    };
  };

  const mapNivelActividadToPAL = (nivelActividad?: string | null) => {
    if (!nivelActividad) return "";
    const v = String(nivelActividad).toLowerCase();
    if (v.includes("sed")) return "1.53";
    if (v.includes("mod")) return "1.76";
    if (v.includes("vig") || v.includes("alto") || v.includes("intens")) return "2.25";
    return "";
  };

  const fetchPatientAndPrefill = async (pid: number) => {
    setLoadingPatient(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${pid}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.detail || "No se pudo cargar el paciente");
      }
      const patient = await response.json();

      const pesoActual = patient?.peso_actual != null ? String(patient.peso_actual) : "";
      const altura = patient?.altura != null ? String(patient.altura) : "";
      const genero = patient?.genero ? String(patient.genero).toLowerCase() : "";
      const edad = computeAgeYears(patient?.fecha_nacimiento);
      const pal = mapNivelActividadToPAL(patient?.nivel_actividad);
      const pesoObjetivo = patient?.peso_objetivo != null ? String(patient.peso_objetivo) : "";
      const factorActividad = patient?.pal_factor ? String(patient.pal_factor) : (pal || "1.55");

      // Calcular todos los valores derivados con los datos del paciente (un solo setFormData para evitar estado desfasado)
      let imc = "";
      let pesoSaludable = "";
      let pesoAjustado = "";

      const pesoNum = parseFloat(pesoActual);
      const alturaNum = parseFloat(altura);
      if (!isNaN(pesoNum) && !isNaN(alturaNum) && alturaNum > 0) {
        const alturaMetros = alturaNum / 100;
        const imcVal = pesoNum / (alturaMetros * alturaMetros);
        imc = imcVal.toFixed(2);
        pesoSaludable = (25 * alturaMetros * alturaMetros).toFixed(2);
        pesoAjustado = ((pesoNum - 25 * alturaMetros * alturaMetros) * 0.25 + 25 * alturaMetros * alturaMetros).toFixed(2);
      }

      setFormData((prev: any) => {
        const draft = {
          ...prev,
          patient_id: pid,
          peso_actual: pesoActual,
          altura,
          genero,
          edad,
          peso_objetivo: pesoObjetivo,
          peso_referencia_f2: pesoObjetivo || pesoActual,
          factor_actividad: factorActividad,
          imc: imc || prev.imc,
          peso_saludable: pesoSaludable || prev.peso_saludable,
          peso_ajustado: pesoAjustado || prev.peso_ajustado,
          formula_requerimiento: prev.formula_requerimiento || "schofield",
          rango_kcal_kg: prev.rango_kcal_kg || "25",
          rango_objetivo: prev.rango_objetivo || "mantenimiento",
        };
        const adultCalc = calculateAdultEnergia(draft);
        const adj = withAjusteCaloriasFields(adultCalc.reqBase, draft);
        return {
          ...draft,
          ...adj,
          tmb: adultCalc.tmb > 0 ? adultCalc.tmb.toFixed(2) : "",
        };
      });

      toast({
        title: "Datos cargados",
        description: `Se cargaron los datos de ${patient?.nombres || "el paciente"}`,
      });
    } catch (error: any) {
      console.error("Error prefill patient:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo cargar los datos del paciente",
        variant: "destructive",
      });
    } finally {
      setLoadingPatient(false);
    }
  };

  /** Prefill Fase 1 hospitalizado (misma antropometría + FA/FE EVANUT) */
  const fetchPatientAndPrefillHospitalizado = async (pid: number) => {
    setLoadingPatient(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${pid}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.detail || "No se pudo cargar el paciente");
      }
      const patient = await response.json();

      const pesoActual = patient?.peso_actual != null ? String(patient.peso_actual) : "";
      const altura = patient?.altura != null ? String(patient.altura) : "";
      const genero = patient?.genero ? String(patient.genero).toLowerCase() : "";
      const edad = computeAgeYears(patient?.fecha_nacimiento);
      const pesoObjetivo = patient?.peso_objetivo != null ? String(patient.peso_objetivo) : "";

      let imc = "";
      let pesoSaludable = "";
      let pesoAjustado = "";
      const pesoNum = parseFloat(pesoActual);
      const alturaNum = parseFloat(altura);
      if (!isNaN(pesoNum) && !isNaN(alturaNum) && alturaNum > 0) {
        const alturaMetros = alturaNum / 100;
        const imcVal = pesoNum / (alturaMetros * alturaMetros);
        imc = imcVal.toFixed(2);
        pesoSaludable = (25 * alturaMetros * alturaMetros).toFixed(2);
        pesoAjustado = (
          (pesoNum - 25 * alturaMetros * alturaMetros) * 0.25 +
          25 * alturaMetros * alturaMetros
        ).toFixed(2);
      }

      const sugerido = suggestHospitalPesoRef(
        parseFloat(imc) || 0,
        pesoNum || 0,
        parseFloat(pesoSaludable) || 0,
        parseFloat(pesoAjustado) || 0
      );

      setFormData((prev: any) => {
        const draft = {
          ...prev,
          patient_id: pid,
          tipo_plan: "hospitalizado",
          peso_actual: pesoActual,
          altura,
          genero,
          edad,
          peso_objetivo: pesoObjetivo,
          peso_referencia_f2: pesoObjetivo || (sugerido.peso > 0 ? sugerido.peso.toFixed(2) : pesoActual),
          imc: imc || prev.imc,
          peso_saludable: pesoSaludable || prev.peso_saludable,
          peso_ajustado: pesoAjustado || prev.peso_ajustado,
          formula_requerimiento:
            prev.formula_requerimiento && prev.formula_requerimiento !== "schofield"
              ? prev.formula_requerimiento
              : "harris_benedict",
          rango_kcal_kg: prev.rango_kcal_kg || "25",
          rango_objetivo: prev.rango_objetivo || "mantenimiento",
          hosp_factor_actividad: prev.hosp_factor_actividad || "1.15",
          hosp_actividad_preset: prev.hosp_actividad_preset || "cama",
          hosp_factor_estres: prev.hosp_factor_estres || "1.0",
          hosp_estres_preset: prev.hosp_estres_preset || "ninguno",
          hosp_liquidos_cc_kg: prev.hosp_liquidos_cc_kg || "35",
          hosp_ventilatorio: prev.hosp_ventilatorio || "no",
          hosp_obesidad: prev.hosp_obesidad || (parseFloat(imc) >= 30 ? "si" : "no"),
          hosp_trauma: prev.hosp_trauma || "no",
          hosp_quemadura: prev.hosp_quemadura || "no",
          grupos_alimentos_f3: buildGruposAlimentos("hospitalizado"),
        };
        const calc = calculateHospitalizadoEnergia(draft);
        const adj = withAjusteCaloriasFields(calc.reqBase, draft);
        return {
          ...draft,
          ...adj,
          factor_actividad: String(calc.fa),
          tmb: calc.tmb > 0 ? calc.tmb.toFixed(2) : "",
        };
      });

      toast({
        title: "Datos cargados",
        description: `Se cargaron los datos de ${patient?.nombres || "el paciente"} (hospitalizado)`,
      });
    } catch (error: any) {
      console.error("Error prefill hospitalizado:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo cargar los datos del paciente",
        variant: "destructive",
      });
    } finally {
      setLoadingPatient(false);
    }
  };

  const fetchPatientAndPrefillGeriatrico = async (pid: number) => {
    setLoadingPatient(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${pid}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.detail || "No se pudo cargar el paciente");
      }
      const patient = await response.json();

      const pesoActual = patient?.peso_actual != null ? String(patient.peso_actual) : "";
      const altura = patient?.altura != null ? String(patient.altura) : "";
      const genero = patient?.genero ? String(patient.genero).toLowerCase() : "";
      const edad = computeAgeYears(patient?.fecha_nacimiento);
      const pesoObjetivo = patient?.peso_objetivo != null ? String(patient.peso_objetivo) : "";

      let imc = "";
      let pesoSaludable = "";
      let pesoAjustado = "";
      const pesoNum = parseFloat(pesoActual);
      const alturaNum = parseFloat(altura);
      if (!isNaN(pesoNum) && !isNaN(alturaNum) && alturaNum > 0) {
        const alturaMetros = alturaNum / 100;
        const imcVal = pesoNum / (alturaMetros * alturaMetros);
        imc = imcVal.toFixed(2);
        // IMC objetivo geriátrico 24.5 (punto medio 22–27)
        pesoSaludable = (24.5 * alturaMetros * alturaMetros).toFixed(2);
        pesoAjustado = (
          (pesoNum - 24.5 * alturaMetros * alturaMetros) * 0.25 +
          24.5 * alturaMetros * alturaMetros
        ).toFixed(2);
      }

      setFormData((prev: any) => {
        const draft = {
          ...prev,
          patient_id: pid,
          tipo_plan: "geriatrico",
          peso_actual: pesoActual,
          altura,
          genero,
          edad,
          peso_objetivo: pesoObjetivo,
          peso_referencia_f2: pesoObjetivo || pesoActual,
          imc: imc || prev.imc,
          peso_saludable: pesoSaludable || prev.peso_saludable,
          peso_ajustado: pesoAjustado || prev.peso_ajustado,
          formula_requerimiento:
            prev.formula_requerimiento && prev.formula_requerimiento !== "schofield"
              ? prev.formula_requerimiento
              : "harris_benedict",
          rango_kcal_kg: prev.rango_kcal_kg || "25",
          rango_objetivo: prev.rango_objetivo || "mantenimiento",
          ger_factor_actividad: prev.ger_factor_actividad || "1.3",
          ger_actividad_preset: prev.ger_actividad_preset || "sedentario",
          ger_factor_estres: prev.ger_factor_estres || "1.0",
          ger_estres_preset: prev.ger_estres_preset || "ninguno",
          ger_liquidos_cc_kg: prev.ger_liquidos_cc_kg || "30",
          grupos_alimentos_f3: buildGruposAlimentos("geriatrico"),
        };
        const calc = calculateGeriatricoEnergia(draft);
        const adj = withAjusteCaloriasFields(calc.reqBase, draft);
        return {
          ...draft,
          ...adj,
          factor_actividad: String(calc.fa),
          tmb: calc.tmb > 0 ? calc.tmb.toFixed(2) : "",
        };
      });

      toast({
        title: "Datos cargados",
        description: `Se cargaron los datos de ${patient?.nombres || "el paciente"} (geriátrico)`,
      });
    } catch (error: any) {
      console.error("Error prefill geriátrico:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo cargar los datos del paciente",
        variant: "destructive",
      });
    } finally {
      setLoadingPatient(false);
    }
  };

  /** Carga datos del paciente desde la API y rellena la fase 1 deportista (peso, estatura, sexo) */
  const fetchPatientAndPrefillDeportista = async (pid: number) => {
    setLoadingPatient(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${pid}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail || "No se pudo cargar el paciente");
      }
      const patient = await response.json();
      const peso = patient?.peso_actual != null ? String(patient.peso_actual) : "";
      const estatura = patient?.altura != null ? String(patient.altura) : "";
      const generoRaw = patient?.genero ? String(patient.genero).toLowerCase() : "";
      const genero = generoRaw === "mujer" || generoRaw === "femenino" ? "femenino" : "masculino";
      let edad = "";
      if (patient?.fecha_nacimiento) {
        const birth = new Date(patient.fecha_nacimiento);
        if (!isNaN(birth.getTime())) {
          const today = new Date();
          let years = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
          if (years > 0) edad = String(years);
        }
      } else if (patient?.edad != null) {
        edad = String(patient.edad);
      }
      setFormData((prev: any) => ({
        ...prev,
        patient_id: pid,
        tipo_plan: "deportista",
        deportista_peso: peso,
        deportista_estatura: estatura,
        deportista_yuhasz_sexo: genero || prev.deportista_yuhasz_sexo,
        peso_actual: peso || prev.peso_actual,
        altura: estatura || prev.altura,
        edad: edad || prev.edad,
        genero: genero || prev.genero,
        // No forzar peso_referencia: en deportista se usa peso óptimo o se ingresa manual
        grupos_alimentos_f3: {
          ...buildGruposAlimentos("deportista"),
          ...prev.grupos_alimentos_f3,
          [SUPLEMENTOS_GRUPO]: prev.grupos_alimentos_f3?.[SUPLEMENTOS_GRUPO] || {
            ...emptyGrupoNutrients(),
            manual: true,
          },
        },
      }));
      toast({
        title: "Datos cargados",
        description: `Se cargaron los datos de ${patient?.nombres || "el paciente"} desde la base de datos`,
      });
    } catch (error: any) {
      console.error("Error prefill deportista:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo cargar los datos del paciente",
        variant: "destructive",
      });
    } finally {
      setLoadingPatient(false);
    }
  };

  /** Prefill pediatría desde paciente */
  const fetchPatientAndPrefillPediatria = async (pid: number) => {
    setLoadingPatient(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${pid}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail || "No se pudo cargar el paciente");
      }
      const patient = await response.json();
      const peso = patient?.peso_actual != null ? String(patient.peso_actual) : "";
      const talla = patient?.altura != null ? String(patient.altura) : "";
      const generoRaw = patient?.genero ? String(patient.genero).toLowerCase() : "";
      const sexo =
        generoRaw === "hombre" || generoRaw === "masculino" || generoRaw === "m"
          ? "masculino"
          : "femenino";
      const age = computeAgeDetail(patient?.fecha_nacimiento);
      const nivel = String(patient?.nivel_actividad || "").toLowerCase();
      let actividad = "Moderado";
      if (nivel.includes("sed")) actividad = "Sedentario";
      else if (nivel.includes("vig") || nivel.includes("activo") || nivel.includes("alto")) actividad = "Activo";

      const dc = patient?.datos_clinicos || {};
      const perimetroCefalico =
        dc.perimetro_cefalico != null && dc.perimetro_cefalico !== ""
          ? String(dc.perimetro_cefalico)
          : "";

      const draft = {
        pediatria_sexo: sexo,
        pediatria_edad_anos: age.years,
        pediatria_edad_meses: age.months,
        pediatria_fecha_nacimiento: patient?.fecha_nacimiento || "",
        pediatria_peso: peso,
        pediatria_talla_cm: talla,
        pediatria_peso_referencia: peso,
        pediatria_perimetro_cefalico: perimetroCefalico,
        pediatria_actividad: actividad,
        pediatria_kcal_por_gramo: "5",
        pediatria_deficit: "Ninguno",
        pediatria_alimentacion_0_1: "leche_materna",
      };
      const calc = calculatePediatriaEnergia({ ...getDefaultFormData(), ...draft });
      setFormData((prev: any) => ({
        ...prev,
        ...draft,
        patient_id: pid,
        tipo_plan: "pediatria",
        peso_actual: peso || prev.peso_actual,
        altura: talla || prev.altura,
        edad: age.years || prev.edad,
        genero: sexo,
        imc: calc.imc > 0 ? calc.imc.toFixed(2) : prev.imc,
        ...withAjusteCaloriasFields(calc.requerimientoFinal, { ...getDefaultFormData(), ...draft }),
        peso_referencia_f2: peso || prev.peso_referencia_f2,
        peso_objetivo: peso || prev.peso_objetivo,
        grupos_alimentos_f3: {
          ...buildGruposAlimentos("pediatria"),
          ...prev.grupos_alimentos_f3,
        },
      }));
      toast({
        title: "Datos cargados",
        description: `Pediatría: datos de ${patient?.nombres || "el paciente"} (GER ${Math.round(calc.requerimientoFinal)} kcal)`,
      });
    } catch (error: any) {
      console.error("Error prefill pediatria:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo cargar los datos del paciente",
        variant: "destructive",
      });
    } finally {
      setLoadingPatient(false);
    }
  };

  /** Prefill gestante / gestante adolescente desde paciente */
  const fetchPatientAndPrefillGestante = async (pid: number, tipoPlan: string = "gestante") => {
    setLoadingPatient(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${pid}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail || "No se pudo cargar el paciente");
      }
      const patient = await response.json();
      const peso = patient?.peso_actual != null ? String(patient.peso_actual) : "";
      const pesoIni = patient?.peso_inicial != null ? String(patient.peso_inicial) : peso;
      const alturaCm = patient?.altura != null ? Number(patient.altura) : 0;
      const estM = alturaCm > 0 ? (alturaCm / 100).toFixed(2) : "";
      const age = computeAgeYears(patient?.fecha_nacimiento);
      const pal = patient?.pal_factor
        ? String(patient.pal_factor)
        : mapNivelActividadToPAL(patient?.nivel_actividad) || "1.53";
      const edadNum = parseFloat(age) || (isGestAdoles(tipoPlan) ? 15 : 25);
      const gananciaDiaria = isGestAdoles(tipoPlan) ? String(getGestAdolesDailyGainG(edadNum)) : "";

      const draft: any = {
        gestante_edad: age || (isGestAdoles(tipoPlan) ? "15" : "25"),
        gestante_peso_preg: pesoIni,
        gestante_estatura_m: estM,
        gestante_peso_actual: peso,
        gestante_peso_ref: pesoIni,
        gestante_pal: pal,
        gestante_semana: "",
        gestante_extra_normal_variant: "a",
        gestante_actividad_adoles: "Moderado",
        gestante_ganancia_diaria_g: gananciaDiaria,
        gestante_puntaje_z: "",
        gestante_imc_deseado: isGestAdoles(tipoPlan) ? "24" : "",
      };

      let req = "";
      let imcLabel = "";
      if (isGestAdoles(tipoPlan)) {
        const calc = calculateGestanteAdolescenteEnergia({ ...getDefaultFormData(), ...draft });
        req = calc.requerimientoFinal > 0 ? String(Math.round(calc.requerimientoFinal)) : "";
        imcLabel = calc.imcPreg ? calc.imcPreg.toFixed(1) : "—";
      } else {
        const calc = calculateGestanteEnergia({ ...getDefaultFormData(), ...draft });
        req = calc.requerimientoFinal > 0 ? String(Math.round(calc.requerimientoFinal)) : "";
        imcLabel = `${calc.imcPreg ? calc.imcPreg.toFixed(1) : "—"} (${calc.atalah || "—"})`;
      }

      setFormData((prev: any) => ({
        ...prev,
        ...draft,
        patient_id: pid,
        tipo_plan: tipoPlan,
        peso_actual: peso || prev.peso_actual,
        altura: alturaCm ? String(alturaCm) : prev.altura,
        edad: age || prev.edad,
        genero: "femenino",
        imc: imcLabel !== "—" ? imcLabel.split(" ")[0] : prev.imc,
        factor_actividad: pal,
        requerimiento_base_f1: req ? String(Math.round(parseFloat(req) || 0)) : "",
        ...withAjusteCaloriasFields(parseFloat(req) || 0, { ...getDefaultFormData(), ...draft, ajuste_calorias_modo: prev?.ajuste_calorias_modo || "ninguno", ajuste_calorias_valor: prev?.ajuste_calorias_valor || "" }),
        peso_referencia_f2: pesoIni || prev.peso_referencia_f2,
        peso_objetivo: pesoIni || prev.peso_objetivo,
        grupos_alimentos_f3: {
          ...buildGruposAlimentos("gestante"),
          ...prev.grupos_alimentos_f3,
        },
      }));
      toast({
        title: "Datos cargados",
        description: `${isGestAdoles(tipoPlan) ? "Gestante adolescente" : "Gestante"}: ${patient?.nombres || "paciente"} — IMC preg ${imcLabel}`,
      });
    } catch (error: any) {
      console.error("Error prefill gestante:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo cargar los datos del paciente",
        variant: "destructive",
      });
    } finally {
      setLoadingPatient(false);
    }
  };

  /** Obtiene el ID del paciente a cargar: el pasado por prop o el primero de la lista desde la API */
  const getPatientIdToLoad = (): Promise<number | null> => {
    if (typeof patientId === "number") return Promise.resolve(patientId);
    const token = localStorage.getItem("userToken");
    return fetch(`${API_URL}/patients`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: number }[]) => (list?.length > 0 ? list[0].id : null))
      .catch(() => null);
  };

  // Cargar lista de pacientes para el selector (fase 1)
  useEffect(() => {
    if (!open || currentPhase !== 1) return;
    setLoadingPatientsList(true);
    const token = localStorage.getItem("userToken");
    fetch(`${API_URL}/patients`, {
      headers: { ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((list: { id: number; nombres?: string; apellidos?: string; name?: string }[]) => {
        setPatientsList(
          (list || []).map((p) => ({
            id: p.id,
            name: [p.nombres, p.apellidos].filter(Boolean).join(" ") || (p as any).name || `Paciente ${p.id}`,
          }))
        );
      })
      .catch(() => setPatientsList([]))
      .finally(() => setLoadingPatientsList(false));
  }, [open, currentPhase]);

  // Al abrir: restaurar borrador del paciente actual si existe; si no, empezar desde cero y opcionalmente prefill
  useEffect(() => {
    if (!open) return;
    const draftKey = getDraftKey(patientId);
    try {
      const raw = localStorage.getItem(draftKey);
      const draft = raw ? JSON.parse(raw) : null;
      if (draft && typeof draft.currentPhase === "number" && draft.formData) {
        const merged = mergeFormDataWithDefaults(draft.formData);
        // Asegurar que el borrador cargado tenga el patient_id correcto (por si es antiguo o se abrió con paciente)
        const mergedWithPatient = patientId != null
          ? { ...merged, patient_id: merged.patient_id || patientId }
          : merged;
        setFormData(mergedWithPatient);
        setCurrentPhase(Math.min(4, Math.max(0, draft.currentPhase)));
        setCompletedPhases(Array.isArray(draft.completedPhases) ? draft.completedPhases : []);
        toast({
          title: "Borrador restaurado",
          description: "Puedes continuar desde donde habías quedado.",
        });
        return;
      }
    } catch (e) {
      console.warn("Error loading plan wizard draft:", e);
    }
    const defaultData = getDefaultFormData();
    const tipoInit = initialTipoPlan || defaultData.tipo_plan;
    setFormData({
      ...defaultData,
      ...(initialTipoPlan && { tipo_plan: initialTipoPlan }),
      ...(tipoInit === "hospitalizado"
        ? {
            formula_requerimiento: "harris_benedict",
            hosp_factor_actividad: "1.15",
            hosp_factor_estres: "1.0",
            hosp_liquidos_cc_kg: "35",
            grupos_alimentos_f3: buildGruposAlimentos("hospitalizado"),
          }
        : {}),
      ...(tipoInit === "geriatrico"
        ? {
            formula_requerimiento: "harris_benedict",
            ger_factor_actividad: "1.3",
            ger_factor_estres: "1.0",
            ger_liquidos_cc_kg: "30",
            grupos_alimentos_f3: buildGruposAlimentos("geriatrico"),
          }
        : {}),
    });
    setCurrentPhase(initialTipoPlan ? 1 : 0);
    setCompletedPhases([]);
    if (typeof patientId === "number") {
      const tipo = initialTipoPlan || defaultData.tipo_plan;
      if (tipo === "deportista") {
        fetchPatientAndPrefillDeportista(patientId);
      } else if (tipo === "pediatria") {
        fetchPatientAndPrefillPediatria(patientId);
      } else if (tipo === "gestante" || tipo === "gestante_adolescente") {
        fetchPatientAndPrefillGestante(patientId, tipo);
      } else if (tipo === "hospitalizado") {
        fetchPatientAndPrefillHospitalizado(patientId);
      } else if (tipo === "geriatrico") {
        fetchPatientAndPrefillGeriatrico(patientId);
      } else {
        fetchPatientAndPrefill(patientId);
      }
    }
  }, [open, patientId, initialTipoPlan]);

  // Persistir borrador del paciente actual mientras el modal está abierto
  useEffect(() => {
    if (!open) return;
    try {
      const payload = {
        formData,
        currentPhase,
        completedPhases,
      };
      const draftKey = getDraftKey(formData.patient_id);
      localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch (e) {
      console.warn("Error saving plan wizard draft:", e);
    }
  }, [open, formData, currentPhase, completedPhases]);

  // Cargar menús semanales cuando se abre la Fase 4
  useEffect(() => {
    if (currentPhase === 4 && open) {
      fetchWeeklyMenus();
    }
  }, [currentPhase, open]);

  const fetchWeeklyMenus = async () => {
    setLoadingMenus(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/weekly-menus-complete`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (response.ok) {
        const data = await response.json();
        setWeeklyMenus(data);
      }
    } catch (error) {
      console.error("Error fetching weekly menus:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los menús semanales",
        variant: "destructive"
      });
    } finally {
      setLoadingMenus(false);
    }
  };

  const fetchRecipeById = async (recipeId: number) => {
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/recipes/${recipeId}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error(`Error fetching recipe ${recipeId}:`, error);
    }
    return null;
  };

  const fetchDetailedMenu = async (menuId: string) => {
    if (!menuId || menuId === "__none__") {
      setDetailedMenu(null);
      return;
    }

    console.log("🔍 Cargando menú detallado:", menuId);
    setLoadingRecipes(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/weekly-menus/${menuId}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (!response.ok) throw new Error("Error en la respuesta del servidor");

      const menu = await response.json();
      console.log("📦 Menú base cargado:", menu);

      if (!menu.week || !Array.isArray(menu.week)) {
        console.error("❌ El menú no tiene una estructura de semanas válida:", menu);
        setLoadingRecipes(false);
        return;
      }

      // Enriquecer el menú con detalles de recetas
      const enrichedWeek = await Promise.all(menu.week.map(async (day: any) => {
        if (!day.meals || !Array.isArray(day.meals)) return day;

        const enrichedMeals = await Promise.all(day.meals.map(async (meal: any) => {
          // Soporte para ambos formatos de ID de receta
          const rId = meal.recipe_id || meal.recipeId || meal.id_receta;
          if (rId) {
            console.log(`🧪 Buscando receta ${rId} para ${meal.type}...`);
            const recipeDetails = await fetchRecipeById(rId);

            // Asegurar que ingredients sea array
            if (recipeDetails && typeof recipeDetails.ingredients === "string") {
              try {
                recipeDetails.ingredients = JSON.parse(recipeDetails.ingredients);
              } catch (e) {
                console.error(`Error parsing ingredients for recipe ${rId}:`, e);
                recipeDetails.ingredients = [];
              }
            }

            return { ...meal, recipe_id: rId, recipeDetails };
          }
          return meal;
        }));
        return { ...day, meals: enrichedMeals };
      }));

      // Si el menú solo tiene 7 días (1 semana), expandirlo a 28 días (4 semanas) para permitir
      // configurar los ingredientes de todo el mes.
      let finalWeek = enrichedWeek;
      if (enrichedWeek.length === 7) {
        finalWeek = [...enrichedWeek, ...enrichedWeek, ...enrichedWeek, ...enrichedWeek];
      }

      const fullEnrichedMenu = { ...menu, week: finalWeek };
      setDetailedMenu(fullEnrichedMenu);
      console.log("✅ Menú enriquecido satisfactoriamente:", fullEnrichedMenu);

      // Inicializar ingredientes_f4 con los gramos de la tabla de composición (por receta), no editables
      const currentIngredients = { ...formData.ingredientes_f4 };
      const initialIngredients: Record<string, any> = { ...currentIngredients };

      finalWeek.forEach((day: any, dayIdx: number) => {
        if (!initialIngredients[dayIdx]) initialIngredients[dayIdx] = {};

        day.meals.forEach((meal: any, mealIdx: number) => {
          const mealKey = meal.type || mealIdx.toString();
          if (!initialIngredients[dayIdx][mealKey]) initialIngredients[dayIdx][mealKey] = {};

          if (meal.recipeDetails?.ingredients && Array.isArray(meal.recipeDetails.ingredients)) {
            meal.recipeDetails.ingredients.forEach((ing: string) => {
              const baseName = (ing && typeof ing === "string") ? ing.replace(/\s*:.*$/, "").trim() : String(ing);
              const row = getCompositionRowForIngredient(ing) ?? getCompositionRowForIngredient(baseName);
              const grams = row?.portion_grams != null ? String(row.portion_grams) : "";
              initialIngredients[dayIdx][mealKey][ing] = grams;
            });
          }
        });
      });

      // Guardar gramos base y multiplicadores iniciales (1) por ingrediente
      const initialMultipliers: Record<string, any> = {};
      Object.entries(initialIngredients).forEach(([dayKey, meals]) => {
        if (!meals || typeof meals !== "object") return;
        initialMultipliers[dayKey] = {};
        Object.entries(meals as Record<string, any>).forEach(([mealKey, ingredients]) => {
          if (!ingredients || typeof ingredients !== "object") return;
          initialMultipliers[dayKey][mealKey] = {};
          Object.keys(ingredients as Record<string, any>).forEach((ingredientName) => {
            initialMultipliers[dayKey][mealKey][ingredientName] = 1;
          });
        });
      });

      setBaseIngredientsF4(initialIngredients);
      setIngredientMultipliers(initialMultipliers);
      handleChange("ingredientes_f4", initialIngredients);
    } catch (error) {
      console.error("Error fetching detailed menu:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles del menú. Verifique su conexión y las recetas.",
        variant: "destructive"
      });
    } finally {
      setLoadingRecipes(false);
    }
  };

  useEffect(() => {
    if (formData.weekly_menu_id) {
      fetchDetailedMenu(formData.weekly_menu_id);
    } else {
      setDetailedMenu(null);
    }
  }, [formData.weekly_menu_id]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Calcular IMC
  // Actualizar gramos de un ingrediente concreto (Fase 4)
  const updateIngredientGrams = (dayIdx: number, mealType: string, ingredient: string, grams: string) => {
    setFormData(prev => ({
      ...prev,
      ingredientes_f4: {
        ...prev.ingredientes_f4,
        [dayIdx]: {
          ...(prev.ingredientes_f4[dayIdx] || {}),
          [mealType]: {
            ...(prev.ingredientes_f4[dayIdx]?.[mealType] || {}),
            [ingredient]: grams
          }
        }
      }
    }));
  };

  const calculateIMC = (pesoValue: string, alturaValue: string) => {
    const peso = parseFloat(pesoValue);
    const altura = parseFloat(alturaValue);

    if (isNaN(peso) || isNaN(altura) || peso <= 0 || altura <= 0) {
      handleChange("imc", "");
      return;
    }

    // Convertir altura de cm a metros
    const alturaMetros = altura / 100;
    const imc = peso / (alturaMetros * alturaMetros);
    handleChange("imc", imc.toFixed(2));

    // Calcular peso saludable después de calcular IMC
    calculatePesoSaludable(alturaValue, imc.toString(), pesoValue);
  };

  // Calcular TMB según fórmula seleccionada
  const calculateTMB = (pesoValue: string, edadValue: string, generoValue: string) => {
    recalculateAdultRequirement({
      peso_referencia_f2: pesoValue || formData.peso_referencia_f2,
      peso_objetivo: formData.peso_objetivo || pesoValue,
      edad: edadValue,
      genero: generoValue,
    });
  };

  // Calcular Peso Saludable y Peso Ajustado
  const calculatePesoSaludable = (alturaValue: string, imcValue: string, pesoActualValue: string) => {
    const altura = parseFloat(alturaValue);
    const imc = parseFloat(imcValue);
    const pesoActual = parseFloat(pesoActualValue);

    if (isNaN(altura) || isNaN(imc) || altura <= 0) {
      handleChange("peso_saludable", "");
      handleChange("peso_ajustado", "");
      return;
    }

    const alturaMetros = altura / 100;
    // PS = 25 * (Talla m^2)
    const pesoSaludable = 25 * (alturaMetros * alturaMetros);
    handleChange("peso_saludable", pesoSaludable.toFixed(2));

    // PA = (PesoActual - PS) * 0.25 + PS
    const pesoAjustado = ((pesoActual - pesoSaludable) * 0.25) + pesoSaludable;
    handleChange("peso_ajustado", pesoAjustado.toFixed(2));

    // Peso de referencia automático: SIEMPRE usar Peso Objetivo
    handleChange("peso_referencia_f2", formData.peso_objetivo);
  };

  // Calcular Requerimiento Energético (adulto)
  const calculateRequerimientoEnergetico = (_tmbValue: string, factorValue: string) => {
    recalculateAdultRequirement({ factor_actividad: factorValue });
  };

  /** Actualiza modo/valor de ajuste y recalcula el total desde la base */
  const updateAjusteCalorias = (partial: { ajuste_calorias_modo?: string; ajuste_calorias_valor?: string }) => {
    setFormData((prev: any) => {
      const next = { ...prev, ...partial };
      let baseKcal = parseFloat(next.requerimiento_base_f1) || 0;
      if (!(baseKcal > 0) && parseFloat(prev.requerimiento_energetico) > 0) {
        // Recuperar base deshaciendo el delta previo
        baseKcal = Math.round(parseFloat(prev.requerimiento_energetico) - getAjusteCaloriasDelta(prev));
        if (!(baseKcal > 0)) baseKcal = Math.round(parseFloat(prev.requerimiento_energetico));
      }
      const fields = withAjusteCaloriasFields(baseKcal, next);
      return { ...next, ...fields };
    });
  };

  const renderAjusteCaloriasUI = () => {
    const base = parseFloat(formData.requerimiento_base_f1) || 0;
    const delta = getAjusteCaloriasDelta(formData);
    const finalKcal = parseFloat(formData.requerimiento_energetico) || 0;
    const hasAjuste = formData.ajuste_calorias_modo !== "ninguno";
    return (
      <div className="rounded-lg border border-dashed border-amber-300/70 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-3">
        <div>
          <Label className="font-medium">Ajuste calórico (opcional)</Label>
          <p className="text-xs text-muted-foreground">Restricción (déficit) o aumento (superávit) sobre el requerimiento calculado</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Tipo de ajuste</Label>
            <Select
              value={formData.ajuste_calorias_modo || "ninguno"}
              onValueChange={(v) => updateAjusteCalorias({
                ajuste_calorias_modo: v,
                ajuste_calorias_valor: v === "ninguno" ? "" : (formData.ajuste_calorias_valor || ""),
              })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin ajuste</SelectItem>
                <SelectItem value="restriccion">Restricción (− kcal)</SelectItem>
                <SelectItem value="aumento">Aumento (+ kcal)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cantidad (kcal)</Label>
            <Input
              type="number"
              min="0"
              step="10"
              disabled={!hasAjuste}
              placeholder="Ej. 300"
              value={formData.ajuste_calorias_valor}
              onChange={(e) => updateAjusteCalorias({ ajuste_calorias_valor: e.target.value })}
            />
          </div>
          <div className="rounded-md bg-background/80 border px-3 py-2 text-sm">
            {base > 0 ? (
              <p>
                <span className="text-muted-foreground">Base </span>
                <span className="font-medium">{Math.round(base)}</span>
                {hasAjuste && delta !== 0 && (
                  <span className={delta < 0 ? "text-destructive font-medium" : "text-emerald-600 font-medium"}>
                    {" "}{delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
                <span className="text-muted-foreground"> = </span>
                <span className="font-bold text-primary">{Math.round(finalKcal)} kcal</span>
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">Calcula primero el requerimiento base</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Calcular valores de Fase 2
  const calculateFase2Values = () => {
    const totalCalorias = parseFloat(formData.requerimiento_energetico) || 0;
    if (totalCalorias <= 0) return;

    // Obtener valores primarios (inputs)
    const grasasAMDR_Input = parseFloat(formData.grasas_amdr_f2) || 0;
    const proteinasKgPeso_Input = parseFloat(formData.proteinas_kg_peso) || 0;
    const pesoRef = parseFloat(formData.peso_referencia_f2 || formData.peso_objetivo) || 0;

    // 1. Calcular Proteína % AMDR basado en g/kg/peso
    let proteinasAMDR_Calc = 0;
    if (totalCalorias > 0 && pesoRef > 0) {
      proteinasAMDR_Calc = (proteinasKgPeso_Input * pesoRef * 4) / totalCalorias * 100;
    }

    // REDONDEO CRÍTICO para coherencia en UI (1 decimal)
    const pAMDRFinal = parseFloat(proteinasAMDR_Calc.toFixed(2));
    const gAMDRFinal = parseFloat(grasasAMDR_Input.toFixed(2));

    // 2. CHO % AMDR es el remanente de 100 (permitir negativos por balance clínico)
    const cAMDRFinal = 100 - pAMDRFinal - gAMDRFinal;

    // Calcular calorías basadas en los porcentajes finales
    const proteinasCalorias = (totalCalorias * pAMDRFinal) / 100;
    const grasasCalorias = (totalCalorias * gAMDRFinal) / 100;
    const choCalorias = (totalCalorias * cAMDRFinal) / 100;

    // Calcular gramos
    const proteinasGramos = proteinasCalorias / 4;
    const grasasGramos = grasasCalorias / 9;
    const choGramos = choCalorias / 4;
    const choKgPeso_Calc = pesoRef > 0 ? (choGramos / pesoRef) : 0;

    // Otros campos detallados
    const grasasGS_AMDR = parseFloat(formData.grasas_gs_amdr) || 0;
    const grasasGP_AMDR = parseFloat(formData.grasas_gp_amdr) || 0;
    const choConcent_AMDR = parseFloat(formData.cho_concent_amdr) || 0;
    const proteinasAVB_Pct = parseFloat(formData.proteinas_avb_porcentaje) || 0;

    const grasasGSCalorias = (totalCalorias * grasasGS_AMDR) / 100;
    const grasasGSCaloriasResto = grasasCalorias - grasasGSCalorias;
    const grasasGPCalorias = (totalCalorias * grasasGP_AMDR) / 100;
    const grasasGMCalorias = grasasGSCaloriasResto - grasasGPCalorias;

    const grasasGSGramos = grasasGSCalorias / 9;
    const grasasGMGramos = grasasGMCalorias / 9;
    const grasasGPGramos = grasasGPCalorias / 9;
    const grasasGM_AMDR = gAMDRFinal - grasasGS_AMDR - grasasGP_AMDR;

    const proteinasAVBGramos = (proteinasGramos * proteinasAVB_Pct) / 100;
    const choConcentGramos = (totalCalorias * choConcent_AMDR) / 100 / 4;

    const totalAMDR = pAMDRFinal + gAMDRFinal + cAMDRFinal;

    // Actualizar estados
    handleChange("proteinas_amdr_f2", pAMDRFinal.toFixed(2));
    handleChange("proteinas_calorias_f2", proteinasCalorias.toFixed(2));
    handleChange("proteinas_gramos_f2", proteinasGramos.toFixed(2));
    handleChange("grasas_calorias_f2", grasasCalorias.toFixed(2));
    handleChange("grasas_gramos_f2", grasasGramos.toFixed(2));
    handleChange("grasas_gm_amdr", grasasGM_AMDR.toFixed(2));
    handleChange("cho_amdr_f2", cAMDRFinal.toFixed(2));
    handleChange("cho_calorias_f2", choCalorias.toFixed(2));
    handleChange("cho_gramos_f2", choGramos.toFixed(2));
    handleChange("cho_kg_peso", choKgPeso_Calc.toFixed(2));
    handleChange("grasas_gs_gramos", grasasGSGramos.toFixed(2));
    handleChange("grasas_gm_gramos", grasasGMGramos.toFixed(2));
    handleChange("grasas_gp_gramos", grasasGPGramos.toFixed(2));
    handleChange("proteinas_avb_gramos", proteinasAVBGramos.toFixed(2));
    handleChange("cho_concent_gramos", choConcentGramos.toFixed(2));
    handleChange("total_calorias_f2", totalCalorias.toFixed(2));
    handleChange("total_amdr_f2", totalAMDR.toFixed(2));
  };

  // Calcular totales de Fase 3
  const calculateFase3Totals = (updatedGrupos?: Record<string, any>) => {
    const grupos = updatedGrupos || formData.grupos_alimentos_f3;
    const totals = {
      kcal: 0, prot: 0, grasa: 0, gs: 0, gm: 0, gp: 0, col: 0, chos: 0, fd: 0,
      calcio: 0, p: 0, fe: 0, na: 0, k: 0, mg: 0, zn: 0, cu: 0
    };

    Object.keys(grupos).forEach(nombre => {
      const data = grupos[nombre];
      const porciones = parseFloat(data.porciones) || 0;
      if (porciones <= 0) return;

      const nutrients = getFoodNutrientsForGroup(nombre);
      if (nutrients) {
        totals.kcal += nutrients.kcal * porciones;
        totals.prot += nutrients.prot * porciones;
        totals.grasa += nutrients.grasa * porciones;
        totals.gs += nutrients.gs * porciones;
        totals.gm += nutrients.gm * porciones;
        totals.gp += nutrients.gp * porciones;
        totals.col += nutrients.col * porciones;
        totals.chos += nutrients.chos * porciones;
        totals.fd += nutrients.fd * porciones;
        totals.calcio += (nutrients.calcio || 0) * porciones;
        totals.p += (nutrients.p || 0) * porciones;
        totals.fe += (nutrients.fe || 0) * porciones;
        totals.na += (nutrients.na || 0) * porciones;
        totals.k += (nutrients.k || 0) * porciones;
        totals.mg += (nutrients.mg || 0) * porciones;
        totals.zn += (nutrients.zn || 0) * porciones;
        totals.cu += (nutrients.cu || 0) * porciones;
      } else {
        // Suplementos u otros grupos manuales: ya vienen multiplicados por porciones
        totals.kcal += parseFloat(data.kcal) || 0;
        totals.prot += parseFloat(data.prot) || 0;
        totals.grasa += parseFloat(data.grasa) || 0;
        totals.gs += parseFloat(data.gs) || 0;
        totals.gm += parseFloat(data.gm) || 0;
        totals.gp += parseFloat(data.gp) || 0;
        totals.col += parseFloat(data.col) || 0;
        totals.chos += parseFloat(data.chos) || 0;
        totals.fd += parseFloat(data.fd) || 0;
        totals.calcio += parseFloat(data.calcio) || 0;
        totals.p += parseFloat(data.p) || 0;
        totals.fe += parseFloat(data.fe) || 0;
        totals.na += parseFloat(data.na) || 0;
        totals.k += parseFloat(data.k) || 0;
        totals.mg += parseFloat(data.mg) || 0;
        totals.zn += parseFloat(data.zn) || 0;
        totals.cu += parseFloat(data.cu) || 0;
      }
    });

    handleChange("totals_f3", totals);
  };

  const applyManualGrupoTotals = (nombre: string, base: Record<string, any>) => {
    const porciones = parseFloat(base.porciones) || 0;
    const per = (key: string) => parseFloat(base[key]) || 0;
    return {
      ...base,
      manual: true,
      kcal: per("per_kcal") * porciones,
      prot: per("per_prot") * porciones,
      grasa: per("per_grasa") * porciones,
      gs: per("per_gs") * porciones,
      gm: per("per_gm") * porciones,
      gp: per("per_gp") * porciones,
      col: per("per_col") * porciones,
      chos: per("per_chos") * porciones,
      fd: per("per_fd") * porciones,
    };
  };

  // Manejar cambio en porciones de Fase 3
  const handleFase3PorcionesChange = (nombre: string, value: string) => {
    const porciones = parseFloat(value) || 0;
    const nutrients = getFoodNutrientsForGroup(nombre);
    const prevGrupo = formData.grupos_alimentos_f3[nombre] || emptyGrupoNutrients();

    let updatedGrupo: Record<string, any>;
    if (isSuplementoGrupoKey(nombre) || prevGrupo.manual || !nutrients) {
      updatedGrupo = applyManualGrupoTotals(nombre, { ...prevGrupo, porciones: value });
    } else {
      updatedGrupo = {
        ...prevGrupo,
        porciones: value,
        kcal: nutrients.kcal * porciones,
        prot: nutrients.prot * porciones,
        grasa: nutrients.grasa * porciones,
        gs: nutrients.gs * porciones,
        gm: nutrients.gm * porciones,
        gp: nutrients.gp * porciones,
        col: nutrients.col * porciones,
        chos: nutrients.chos * porciones,
        fd: nutrients.fd * porciones,
        calcio: (nutrients.calcio || 0) * porciones,
        p: (nutrients.p || 0) * porciones,
        fe: (nutrients.fe || 0) * porciones,
        na: (nutrients.na || 0) * porciones,
        k: (nutrients.k || 0) * porciones,
        mg: (nutrients.mg || 0) * porciones,
        zn: (nutrients.zn || 0) * porciones,
        cu: (nutrients.cu || 0) * porciones,
      };
    }

    const newGrupos = {
      ...formData.grupos_alimentos_f3,
      [nombre]: updatedGrupo,
    };

    handleChange("grupos_alimentos_f3", newGrupos);
    calculateFase3Totals(newGrupos);
  };

  const handleSuplementoNutrientChange = (grupoKey: string, field: string, value: string) => {
    const prevGrupo = formData.grupos_alimentos_f3[grupoKey] || {
      ...emptyGrupoNutrients(),
      manual: true,
    };
    const updated = applyManualGrupoTotals(grupoKey, { ...prevGrupo, [field]: value });
    const newGrupos = {
      ...formData.grupos_alimentos_f3,
      [grupoKey]: updated,
    };
    handleChange("grupos_alimentos_f3", newGrupos);
    calculateFase3Totals(newGrupos);
  };

  const handleMipressSuplementoSelect = (grupoKey: string, suplementoId: string) => {
    if (suplementoId === "__manual__") {
      const prevGrupo = formData.grupos_alimentos_f3[grupoKey] || {
        ...emptyGrupoNutrients(),
        manual: true,
      };
      const updated = applyManualGrupoTotals(grupoKey, {
        ...prevGrupo,
        manual: true,
        mipress_id: "",
        mipress_nombre: "",
        mipress_categoria: "",
        mipress_porcion: "",
      });
      const newGrupos = {
        ...formData.grupos_alimentos_f3,
        [grupoKey]: updated,
      };
      handleChange("grupos_alimentos_f3", newGrupos);
      calculateFase3Totals(newGrupos);
      return;
    }

    const supp = getMipressSuplementoById(suplementoId);
    if (!supp) return;
    const prevGrupo = formData.grupos_alimentos_f3[grupoKey] || {
      ...emptyGrupoNutrients(),
      manual: true,
    };
    const updated = applyManualGrupoTotals(grupoKey, {
      ...prevGrupo,
      manual: true,
      mipress_id: supp.id,
      mipress_nombre: supp.nombre,
      mipress_categoria: supp.categoria,
      mipress_porcion: supp.porcion,
      per_kcal: String(supp.kcal),
      per_prot: String(supp.prot),
      per_grasa: String(supp.grasa),
      per_gs: String(supp.gs),
      per_gm: String(supp.gm),
      per_gp: String(supp.gp),
      per_col: prevGrupo.per_col || "0",
      per_chos: String(supp.chos),
      per_fd: String(supp.fd),
      porciones: prevGrupo.porciones || "1",
    });
    const newGrupos = {
      ...formData.grupos_alimentos_f3,
      [grupoKey]: updated,
    };
    handleChange("grupos_alimentos_f3", newGrupos);
    calculateFase3Totals(newGrupos);
  };

  const handleAddSuplemento = () => {
    const key = makeSuplementoExtraKey();
    const newGrupos = {
      ...ensureSuplementosGrupoF3(),
      [key]: { ...emptyGrupoNutrients(), manual: true, porciones: "1" },
    };
    handleChange("grupos_alimentos_f3", newGrupos);
    calculateFase3Totals(newGrupos);
  };

  const handleRemoveSuplemento = (grupoKey: string) => {
    if (grupoKey === SUPLEMENTOS_GRUPO) {
      // El principal no se elimina: se limpia
      const cleared = applyManualGrupoTotals(SUPLEMENTOS_GRUPO, {
        ...emptyGrupoNutrients(),
        manual: true,
        mipress_id: "",
        mipress_nombre: "",
        mipress_categoria: "",
        mipress_porcion: "",
        mipress_categoria_filtro: formData.grupos_alimentos_f3?.[SUPLEMENTOS_GRUPO]?.mipress_categoria_filtro,
      });
      const newGrupos = {
        ...formData.grupos_alimentos_f3,
        [SUPLEMENTOS_GRUPO]: cleared,
      };
      handleChange("grupos_alimentos_f3", newGrupos);
      calculateFase3Totals(newGrupos);
      return;
    }
    if (!grupoKey.startsWith(SUPLEMENTO_EXTRA_PREFIX)) return;
    const newGrupos = { ...formData.grupos_alimentos_f3 };
    delete newGrupos[grupoKey];
    handleChange("grupos_alimentos_f3", newGrupos);
    calculateFase3Totals(newGrupos);
  };

  const ensureSuplementosGrupoF3 = (grupos?: Record<string, any>) => {
    const base = grupos || formData.grupos_alimentos_f3 || {};
    if (base[SUPLEMENTOS_GRUPO]) return base;
    return {
      ...buildGruposAlimentos(formData.tipo_plan),
      ...base,
      [SUPLEMENTOS_GRUPO]: { ...emptyGrupoNutrients(), manual: true },
    };
  };

  const ensureDeportistaDefaultsForFase2 = () => {
    const updates: Record<string, string> = {};
    if (!formData.proteinas_kg_peso) updates.proteinas_kg_peso = "1.5";
    if (!formData.grasas_amdr_f2) updates.grasas_amdr_f2 = "27.5";
    if (!formData.proteinas_avb_porcentaje) updates.proteinas_avb_porcentaje = "70";
    if (!formData.grasas_gs_amdr) updates.grasas_gs_amdr = "10";
    if (!formData.grasas_gp_amdr) updates.grasas_gp_amdr = "8";
    if (!formData.cho_concent_amdr) updates.cho_concent_amdr = "10";
    if (!formData.peso_referencia_f2) {
      const m = calculateDeportistaMetrics(formData);
      const ref = m.pesoOptimo > 0
        ? m.pesoOptimo.toFixed(2)
        : (formData.deportista_peso || formData.peso_actual || "");
      if (ref) {
        updates.peso_referencia_f2 = ref;
        updates.peso_objetivo = ref;
      }
    }
    if (Object.keys(updates).length) {
      setFormData((prev: any) => ({ ...prev, ...updates }));
    }
  };

  const ensureGeriatricoDefaultsForFase2 = () => {
    const calc = calculateGeriatricoEnergia(formData);
    const updates: Record<string, string> = {};
    if (!formData.proteinas_kg_peso) updates.proteinas_kg_peso = "1.1";
    if (!formData.grasas_amdr_f2) updates.grasas_amdr_f2 = "30";
    if (!formData.proteinas_avb_porcentaje) updates.proteinas_avb_porcentaje = "70";
    if (!formData.grasas_gs_amdr) updates.grasas_gs_amdr = "10";
    if (!formData.grasas_gp_amdr) updates.grasas_gp_amdr = "8";
    if (!formData.cho_concent_amdr) updates.cho_concent_amdr = "10";
    if (!formData.total_fibra) updates.total_fibra = "25";
    const ref = String(calc.pesoRef || formData.peso_actual || "");
    if (!formData.peso_referencia_f2 && ref) {
      updates.peso_referencia_f2 = ref;
      updates.peso_objetivo = ref;
    }
    if (calc.requerimientoFinal > 0) {
      Object.assign(updates, withAjusteCaloriasFields(calc.requerimientoFinal, { ...formData, ...updates }));
      if (calc.tmb > 0) updates.tmb = calc.tmb.toFixed(1);
    }
    if (Object.keys(updates).length) {
      setFormData((prev: any) => ({ ...prev, ...updates }));
    }
  };

  const ensurePediatriaDefaultsForFase2 = () => {
    const calc = calculatePediatriaEnergia(formData);
    const rien = calc.rien;
    const updates: Record<string, string> = {};
    if (!formData.proteinas_kg_peso) updates.proteinas_kg_peso = String(rien.proteinas_kg);
    if (!formData.grasas_amdr_f2) updates.grasas_amdr_f2 = String(rien.grasas_amdr);
    if (!formData.proteinas_avb_porcentaje) updates.proteinas_avb_porcentaje = "70";
    if (!formData.grasas_gs_amdr) updates.grasas_gs_amdr = "10";
    if (!formData.grasas_gp_amdr) updates.grasas_gp_amdr = "8";
    if (!formData.cho_concent_amdr) updates.cho_concent_amdr = "10";
    const ref = formData.pediatria_peso_referencia || formData.pediatria_peso || "";
    if (!formData.peso_referencia_f2 && ref) {
      updates.peso_referencia_f2 = ref;
      updates.peso_objetivo = ref;
    }
    if (calc.requerimientoFinal > 0) {
      Object.assign(updates, withAjusteCaloriasFields(calc.requerimientoFinal, { ...formData, ...updates }));
    }
    if (Object.keys(updates).length) {
      setFormData((prev: any) => ({ ...prev, ...updates }));
    }
  };

  const ensureGestanteDefaultsForFase2 = () => {
    const adoles = isGestAdoles(formData.tipo_plan);
    const calc = adoles
      ? calculateGestanteAdolescenteEnergia(formData)
      : calculateGestanteEnergia(formData);
    const updates: Record<string, string> = {};
    if (!formData.proteinas_kg_peso) updates.proteinas_kg_peso = String(calc.rien.proteinas_kg);
    if (!formData.grasas_amdr_f2) updates.grasas_amdr_f2 = String(calc.rien.grasas_amdr);
    if (!formData.proteinas_avb_porcentaje) updates.proteinas_avb_porcentaje = "70";
    if (!formData.grasas_gs_amdr) updates.grasas_gs_amdr = "10";
    if (!formData.grasas_gp_amdr) updates.grasas_gp_amdr = "8";
    if (!formData.cho_concent_amdr) updates.cho_concent_amdr = "10";
    if (!formData.total_fibra) updates.total_fibra = String(calc.rien.fibra_g);
    const ref = String(calc.pesoRef || formData.gestante_peso_ref || formData.gestante_peso_preg || "");
    if (!formData.peso_referencia_f2 && ref) {
      updates.peso_referencia_f2 = ref;
      updates.peso_objetivo = ref;
    }
    if (calc.requerimientoFinal > 0) {
      Object.assign(updates, withAjusteCaloriasFields(calc.requerimientoFinal, { ...formData, ...updates }));
      if (!adoles && "tmr" in calc) updates.tmb = (calc as any).tmr.toFixed(1);
    }
    if (Object.keys(updates).length) {
      setFormData((prev: any) => ({ ...prev, ...updates }));
    }
  };

  const validateCurrentPhase = (): boolean => {
    if (currentPhase === 0) {
      if (!formData.tipo_plan) {
        toast({ title: "Selecciona un tipo de plan", variant: "destructive" });
        return false;
      }
      return true;
    }

    if (currentPhase === 1) {
      if (formData.tipo_plan === "deportista") {
        if (!(parseFloat(formData.deportista_peso) > 0) || !(parseFloat(formData.deportista_estatura) > 0)) {
          toast({
            title: "Datos incompletos",
            description: "Ingresa peso y estatura del deportista",
            variant: "destructive",
          });
          return false;
        }
        if (!(parseFloat(formData.requerimiento_energetico) > 0)) {
          toast({
            title: "Calorías requeridas",
            description: "Define las calorías totales del plan (requerimientos generales o METs), como indica EVANUT",
            variant: "destructive",
          });
          return false;
        }
        ensureDeportistaDefaultsForFase2();
        // Asegurar grupo suplementos en Fase 3
        if (!formData.grupos_alimentos_f3[SUPLEMENTOS_GRUPO]) {
          handleChange("grupos_alimentos_f3", ensureSuplementosGrupoF3());
        }
      } else if (formData.tipo_plan === "pediatria") {
        if (!(parseFloat(formData.pediatria_peso) > 0) || !(parseFloat(formData.pediatria_talla_cm) > 0)) {
          toast({
            title: "Datos incompletos",
            description: "Ingresa peso y talla del paciente pediátrico",
            variant: "destructive",
          });
          return false;
        }
        const calc = calculatePediatriaEnergia(formData);
        if (!(calc.requerimientoFinal > 0) && !(parseFloat(formData.requerimiento_energetico) > 0)) {
          toast({
            title: "Requerimiento energético",
            description: "Completa edad, sexo y peso de referencia para calcular el GER FAO/OMS",
            variant: "destructive",
          });
          return false;
        }
        ensurePediatriaDefaultsForFase2();
        handleChange("grupos_alimentos_f3", {
          ...buildGruposAlimentos("pediatria"),
          ...formData.grupos_alimentos_f3,
        });
      } else if (isGestanteTipo(formData.tipo_plan)) {
        if (!(parseFloat(formData.gestante_peso_preg) > 0) || !(parseFloat(formData.gestante_estatura_m) > 0)) {
          toast({
            title: "Datos incompletos",
            description: "Ingresa peso pregestacional y estatura",
            variant: "destructive",
          });
          return false;
        }
        if (!(parseFloat(formData.gestante_semana) > 0)) {
          toast({
            title: "Semana gestacional",
            description: "Indica la semana de gestación para calcular extras y ganancia",
            variant: "destructive",
          });
          return false;
        }
        if (isGestAdoles(formData.tipo_plan) && formData.gestante_puntaje_z === "") {
          toast({
            title: "Puntaje Z requerido",
            description: "Ingresa el puntaje Z IMC/edad pregestacional (EVANUT Ges Adoles)",
            variant: "destructive",
          });
          return false;
        }
        const calc = isGestAdoles(formData.tipo_plan)
          ? calculateGestanteAdolescenteEnergia(formData)
          : calculateGestanteEnergia(formData);
        if (!(calc.requerimientoFinal > 0) && !(parseFloat(formData.requerimiento_energetico) > 0)) {
          toast({
            title: "Requerimiento energético",
            description: isGestAdoles(formData.tipo_plan)
              ? "Completa edad, puntaje Z y actividad para calcular GET + extras"
              : "Completa edad, PAL y datos antropométricos para calcular TMR + extras",
            variant: "destructive",
          });
          return false;
        }
        ensureGestanteDefaultsForFase2();
        handleChange("grupos_alimentos_f3", {
          ...buildGruposAlimentos("gestante"),
          ...formData.grupos_alimentos_f3,
        });
      } else if (isHospitalizado(formData.tipo_plan)) {
        if (!(parseFloat(formData.peso_actual) > 0) || !(parseFloat(formData.altura) > 0 || parseFloat(formData.hosp_talon_rodilla_cm) > 0)) {
          toast({
            title: "Datos incompletos",
            description: "Ingresa peso y altura (o talón-rodilla para estimar talla Chumlea)",
            variant: "destructive",
          });
          return false;
        }
        if (!(parseFloat(formData.edad) > 0) || !formData.genero) {
          toast({
            title: "Datos incompletos",
            description: "Ingresa edad y sexo del paciente hospitalizado",
            variant: "destructive",
          });
          return false;
        }
        const calc = calculateHospitalizadoEnergia(formData);
        if (!(calc.requerimientoFinal > 0) && !(parseFloat(formData.requerimiento_energetico) > 0)) {
          toast({
            title: "Requerimiento energético",
            description: "Completa fórmula, factor de actividad y estrés (EVANUT Hospitalizado)",
            variant: "destructive",
          });
          return false;
        }
        const updates: Record<string, any> = {};
        if (!formData.proteinas_kg_peso) updates.proteinas_kg_peso = "1.2";
        if (!formData.grasas_amdr_f2) updates.grasas_amdr_f2 = "30";
        if (Object.keys(updates).length) setFormData((prev: any) => ({ ...prev, ...updates }));
        handleChange("grupos_alimentos_f3", {
          ...buildGruposAlimentos("hospitalizado"),
          ...formData.grupos_alimentos_f3,
        });
      } else if (isGeriatrico(formData.tipo_plan)) {
        if (!(parseFloat(formData.peso_actual) > 0) || !(parseFloat(formData.altura) > 0 || parseFloat(formData.ger_talon_rodilla_cm) > 0)) {
          toast({
            title: "Datos incompletos",
            description: "Ingresa peso y altura (o talón-rodilla para estimar talla Chumlea)",
            variant: "destructive",
          });
          return false;
        }
        if (!(parseFloat(formData.edad) > 0) || !formData.genero) {
          toast({
            title: "Datos incompletos",
            description: "Ingresa edad y sexo del adulto mayor",
            variant: "destructive",
          });
          return false;
        }
        const calc = calculateGeriatricoEnergia(formData);
        if (!(calc.requerimientoFinal > 0) && !(parseFloat(formData.requerimiento_energetico) > 0)) {
          toast({
            title: "Requerimiento energético",
            description: "Completa fórmula, factor de actividad y estrés para calcular las calorías",
            variant: "destructive",
          });
          return false;
        }
        ensureGeriatricoDefaultsForFase2();
        handleChange("grupos_alimentos_f3", {
          ...buildGruposAlimentos("geriatrico"),
          ...formData.grupos_alimentos_f3,
        });
      } else {
        if (!(parseFloat(formData.requerimiento_energetico) > 0)) {
          toast({
            title: "Requerimiento energético",
            description: "Completa los datos para calcular el requerimiento energético",
            variant: "destructive",
          });
          return false;
        }
      }
      return true;
    }

    if (currentPhase === 2) {
      const kcal = parseFloat(formData.total_calorias_f2) || parseFloat(formData.requerimiento_energetico) || 0;
      const prot = parseFloat(formData.proteinas_gramos_f2) || 0;
      if (kcal <= 0 || prot <= 0) {
        toast({
          title: "Fórmula sintética incompleta",
          description: formData.tipo_plan === "deportista"
            ? "Indica proteína g/kg (1.11–2.00) y % grasa AMDR para calcular los macros"
            : formData.tipo_plan === "pediatria"
              ? "Indica proteína g/kg RIEN y % grasa AMDR para calcular los macros"
            : isGestanteTipo(formData.tipo_plan)
              ? "Indica proteína g/kg (1.53–1.7) y % grasa AMDR para calcular los macros"
            : isGeriatrico(formData.tipo_plan)
              ? "Indica proteína g/kg (1.0–1.2, hasta 1.5 en sarcopenia) y % grasa AMDR para calcular los macros"
            : "Completa proteína g/kg y % grasa AMDR para calcular los macros",
          variant: "destructive",
        });
        return false;
      }
      // Al pasar a fórmula desarrollada, asegurar fila de suplementos MIPRESS
      if (!formData.grupos_alimentos_f3?.[SUPLEMENTOS_GRUPO]) {
        handleChange("grupos_alimentos_f3", ensureSuplementosGrupoF3());
      }
      return true;
    }

    if (currentPhase === 3) {
      const hasPortions = Object.values(formData.grupos_alimentos_f3 || {}).some(
        (g: any) => parseFloat(g?.porciones) > 0
      );
      if (!hasPortions) {
        toast({
          title: "Sin porciones",
          description: "Asigna al menos una porción en los grupos de alimentos",
          variant: "destructive",
        });
        return false;
      }
      return true;
    }

    return true;
  };

  // Efecto para calcular Fase 2 cuando cambian los valores
  useEffect(() => {
    if (currentPhase === 2 && formData.requerimiento_energetico) {
      calculateFase2Values();
    }
  }, [
    currentPhase,
    formData.requerimiento_energetico,
    formData.grasas_amdr_f2,
    formData.grasas_gs_amdr,
    formData.grasas_gp_amdr,
    formData.cho_concent_amdr,
    formData.proteinas_avb_porcentaje,
    formData.proteinas_kg_peso,
    formData.peso_referencia_f2,
    formData.peso_objetivo
  ]);

  const handleNext = () => {
    if (currentPhase < 4) {
      if (!validateCurrentPhase()) return;
      if (!completedPhases.includes(currentPhase)) {
        setCompletedPhases([...completedPhases, currentPhase]);
      }
      setCurrentPhase(currentPhase + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPhase > 0) {
      setCurrentPhase(currentPhase - 1);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Solo permitir submit en la Fase 4
    if (currentPhase !== 4) {
      return;
    }

    const calories = parseInt(formData.requerimiento_energetico) || parseInt(formData.total_calorias_f2) || 0;
    const proteinG = parseFloat(formData.proteinas_gramos_f2) || 0;
    const carbsG = parseFloat(formData.cho_gramos_f2) || 0;
    const fatG = parseFloat(formData.grasas_gramos_f2) || 0;

    if (calories <= 0) {
      toast({
        title: "No se puede guardar",
        description: "El plan debe tener calorías totales mayores a 0",
        variant: "destructive",
      });
      return;
    }
    if (!formData.nombre_plan?.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Ingresa un nombre para el plan",
        variant: "destructive",
      });
      return;
    }

    const planData = {
      name: formData.nombre_plan || "Plan Nutricional",
      description: formData.descripcion,
      calories,
      duration: formData.duracion,
      category: formData.categoria,
      color: formData.color,
      tipo: formData.tipo_plan || "adulto",
      meals_per_day: parseInt(formData.comidas_dia) || 3,
      protein_target: Math.round(proteinG),
      carbs_target: Math.round(carbsG),
      fat_target: Math.round(fatG),

      // Datos de las fases
      fase_1: formData.tipo_plan === "deportista"
        ? (() => {
          const m = calculateDeportistaMetrics(formData);
          return {
            tipo_fase: "deportista",
            deportista_peso: formData.deportista_peso,
            deportista_triceps: formData.deportista_triceps,
            deportista_subescapular: formData.deportista_subescapular,
            deportista_supraespinal: formData.deportista_supraespinal,
            deportista_estatura: formData.deportista_estatura,
            deportista_diametro_humero: formData.deportista_diametro_humero,
            deportista_diametro_femur: formData.deportista_diametro_femur,
            deportista_perim_brazo_tenso: formData.deportista_perim_brazo_tenso,
            deportista_perim_pantorrilla: formData.deportista_perim_pantorrilla,
            deportista_pliegue_pantorrilla: formData.deportista_pliegue_pantorrilla,
            deportista_yuhasz_sexo: formData.deportista_yuhasz_sexo,
            deportista_yuhasz_abdominal: formData.deportista_yuhasz_abdominal,
            deportista_yuhasz_muslo_medio: formData.deportista_yuhasz_muslo_medio,
            deportista_pct_grasa_esperado: formData.deportista_pct_grasa_esperado,
            deportista_metodo_grasa: formData.deportista_metodo_grasa,
            deportista_talla_sentado: formData.deportista_talla_sentado,
            deportista_altura_rodilla: formData.deportista_altura_rodilla,
            deportista_perim_brazo_relajado: formData.deportista_perim_brazo_relajado,
            deportista_biceps: formData.deportista_biceps,
            deportista_pecho: formData.deportista_pecho,
            deportista_edad_composicion: formData.deportista_edad_composicion || formData.edad,
            requerimiento_energetico: formData.requerimiento_energetico,
            requerimiento_antes_ajuste: formData.requerimiento_base_f1,
            ajuste_calorias_modo: formData.ajuste_calorias_modo,
            ajuste_calorias_valor: formData.ajuste_calorias_valor,
            peso_referencia: formData.peso_referencia_f2,
            sumatoria: m.sumatoria,
            correccion_proporcionalidad: m.correccionProp,
            perimetro_brazo_corregido: m.perimBrazoCorr,
            perimetro_pantorrilla_corregido: m.perimPantCorr,
            hwr: m.hwr,
            endomorfia: m.endomorfia,
            mesomorfia: m.mesomorfia,
            ectomorfia: m.ectomorfia,
            coordenada_x: m.coordX,
            coordenada_y: m.coordY,
            pct_grasa_yuhasz: m.pctGrasaYuhasz,
            pct_grasa_seleccionado: m.pctGrasaSeleccionado,
            metodo_grasa: m.metodoGrasaLabel,
            pct_grasa_durnin: m.pctGrasaDurnin,
            pct_grasa_jackson: m.pctGrasaJackson,
            pct_grasa_brozek: m.pctGrasaBrozek,
            densidad_corporal: m.densidadSeleccionada,
            indice_cormico: m.indiceCormico,
            clasificacion_cormico: m.clasificacionCormico,
            talla_estimada: m.tallaEstimada,
            area_braquial: m.areaBraquial,
            area_muscular_brazo: m.areaMuscularBrazo,
            area_grasa_brazo: m.areaGrasaBrazo,
            perimetro_muscular_brazo: m.perimetroMuscularBrazo,
            peso_graso: m.pesoGraso,
            masa_libre_grasa: m.masaLibreGrasa,
            aks: m.aks,
            clasificacion_aks: m.clasificacionAks,
            peso_optimo: m.pesoOptimo,
            masa_osea: m.masaOsea,
            masa_residual: m.masaResidual,
            masa_muscular: m.masaMuscular,
            suma_5_componentes: m.suma5Componentes,
          };
        })()
        : formData.tipo_plan === "pediatria"
        ? (() => {
          const p = calculatePediatriaEnergia(formData);
          return {
            tipo_fase: "pediatria",
            pediatria_sexo: formData.pediatria_sexo,
            pediatria_edad_anos: formData.pediatria_edad_anos,
            pediatria_edad_meses: formData.pediatria_edad_meses,
            pediatria_peso: formData.pediatria_peso,
            pediatria_talla_cm: formData.pediatria_talla_cm,
            pediatria_peso_referencia: formData.pediatria_peso_referencia || p.pesoRef,
            pediatria_imc_deseado: formData.pediatria_imc_deseado,
            pediatria_alimentacion_0_1: formData.pediatria_alimentacion_0_1,
            pediatria_ganancia_g_dia: formData.pediatria_ganancia_g_dia,
            pediatria_kcal_por_gramo: formData.pediatria_kcal_por_gramo,
            pediatria_actividad: formData.pediatria_actividad,
            pediatria_deficit: formData.pediatria_deficit,
            pediatria_perim_brazo_mm: formData.pediatria_perim_brazo_mm,
            pediatria_pliegue_tricipital_mm: formData.pediatria_pliegue_tricipital_mm,
            pediatria_pliegue_subescapular_mm: formData.pediatria_pliegue_subescapular_mm,
            imc: p.imc,
            age_years: p.ageYears,
            ger_modo: p.gerModo,
            ger_base: p.gerBase,
            adicionales_crecimiento: p.adicionalesCrecimiento,
            requerimiento_base: p.requerimientoBase,
            catch_up_kcal: p.catchUpKcal,
            requerimiento_energetico: formData.requerimiento_energetico || Math.round(p.requerimientoFinal),
            requerimiento_antes_ajuste: formData.requerimiento_base_f1 || Math.round(p.requerimientoFinal),
            ajuste_calorias_modo: formData.ajuste_calorias_modo,
            ajuste_calorias_valor: formData.ajuste_calorias_valor,
            peso_referencia: formData.peso_referencia_f2 || p.pesoRef,
            rien_band: p.rien.band,
            rien_proteinas_kg: p.rien.proteinas_kg,
            rien_grasas_amdr: p.rien.grasas_amdr,
            perimetro_muscular_brazo: p.perimMuscularBrazo,
            area_muscular_brazo: p.areaMuscularBrazo,
            area_grasa_brazo: p.areaGrasaBrazo,
            adiposidad: p.adiposidad,
          };
        })()
        : isGestanteTipo(formData.tipo_plan)
        ? (() => {
          if (isGestAdoles(formData.tipo_plan)) {
            const g = calculateGestanteAdolescenteEnergia(formData);
            return {
              tipo_fase: "gestante_adolescente",
              gestante_edad: formData.gestante_edad,
              gestante_peso_preg: formData.gestante_peso_preg,
              gestante_estatura_m: g.estM,
              gestante_semana: formData.gestante_semana,
              gestante_peso_actual: formData.gestante_peso_actual,
              gestante_peso_ref: formData.gestante_peso_ref || g.pesoRef,
              gestante_puntaje_z: formData.gestante_puntaje_z,
              gestante_ganancia_diaria_g: formData.gestante_ganancia_diaria_g || g.gananciaDiaria,
              gestante_actividad_adoles: formData.gestante_actividad_adoles || g.actividad,
              imc_pregestacional: g.imcPreg,
              clasificacion_z: g.zClass,
              puntaje_z: g.z,
              imc_gestacional: g.imcGest,
              ganancia_presentada: g.gananciaPresentada,
              debio_ganar: g.debioGanar,
              ganancia_esperada_total: g.totalEsperado,
              trimestre: g.trimestre,
              get_fao: g.get,
              tmr: g.tmr,
              formula_requerimiento: formData.formula_requerimiento || "schofield",
              rango_kcal_kg: formData.rango_kcal_kg,
              rango_objetivo: formData.rango_objetivo,
              metodo_energia: g.metodoLabel,
              requerimiento_base: g.reqBase,
              calorias_adicionales: g.extra,
              requerimiento_energetico: formData.requerimiento_energetico || Math.round(g.requerimientoFinal),
              requerimiento_antes_ajuste: formData.requerimiento_base_f1 || Math.round(g.requerimientoFinal),
              ajuste_calorias_modo: formData.ajuste_calorias_modo,
              ajuste_calorias_valor: formData.ajuste_calorias_valor,
              peso_referencia: formData.peso_referencia_f2 || g.pesoRef,
              rien_proteinas_kg: g.rien.proteinas_kg,
            };
          }
          const g = calculateGestanteEnergia(formData);
          return {
            tipo_fase: "gestante",
            gestante_edad: formData.gestante_edad,
            gestante_peso_preg: formData.gestante_peso_preg,
            gestante_estatura_m: g.estM,
            gestante_semana: formData.gestante_semana,
            gestante_peso_actual: formData.gestante_peso_actual,
            gestante_peso_ref: formData.gestante_peso_ref || g.pesoRef,
            gestante_imc_deseado: formData.gestante_imc_deseado,
            gestante_pal: formData.gestante_pal,
            gestante_extra_normal_variant: formData.gestante_extra_normal_variant,
            gestante_perim_brazo_mm: formData.gestante_perim_brazo_mm,
            gestante_pliegue_tricipital_mm: formData.gestante_pliegue_tricipital_mm,
            gestante_pliegue_subescapular_mm: formData.gestante_pliegue_subescapular_mm,
            imc_pregestacional: g.imcPreg,
            clasificacion_atalah: g.atalah,
            imc_gestacional: g.imcGest,
            ganancia_presentada: g.gananciaPresentada,
            debio_ganar: g.debioGanar,
            ganancia_esperada_total: g.totalEsperado,
            trimestre: g.trimestre,
            tmr: g.tmr,
            formula_requerimiento: formData.formula_requerimiento || "schofield",
            rango_kcal_kg: formData.rango_kcal_kg,
            rango_objetivo: formData.rango_objetivo,
            metodo_energia: g.metodoLabel,
            requerimiento_base: g.reqBase,
            calorias_adicionales: g.extra,
            requerimiento_energetico: formData.requerimiento_energetico || Math.round(g.requerimientoFinal),
            requerimiento_antes_ajuste: formData.requerimiento_base_f1 || Math.round(g.requerimientoFinal),
            ajuste_calorias_modo: formData.ajuste_calorias_modo,
            ajuste_calorias_valor: formData.ajuste_calorias_valor,
            peso_referencia: formData.peso_referencia_f2 || g.pesoRef,
            rien_proteinas_kg: g.rien.proteinas_kg,
            perimetro_muscular_brazo: g.perimMuscularBrazo,
            area_muscular_brazo: g.areaMuscularBrazo,
            area_grasa_brazo: g.areaGrasaBrazo,
          };
        })()
        : isHospitalizado(formData.tipo_plan)
        ? (() => {
          const h = calculateHospitalizadoEnergia(formData);
          return {
            tipo_fase: "hospitalizado",
            peso_actual: formData.peso_actual,
            altura: formData.altura || (h.alturaCm > 0 ? h.alturaCm.toFixed(1) : ""),
            edad: formData.edad,
            genero: formData.genero,
            peso_saludable: formData.peso_saludable || (h.pesoSaludable > 0 ? h.pesoSaludable.toFixed(2) : ""),
            peso_ajustado: formData.peso_ajustado || (h.pesoAjustado > 0 ? h.pesoAjustado.toFixed(2) : ""),
            peso_objetivo: formData.peso_objetivo,
            imc: formData.imc || (h.imc > 0 ? h.imc.toFixed(2) : ""),
            tmb: formData.tmb || (h.tmb > 0 ? h.tmb.toFixed(2) : ""),
            formula_requerimiento: formData.formula_requerimiento || "harris_benedict",
            rango_kcal_kg: formData.rango_kcal_kg,
            rango_objetivo: formData.rango_objetivo,
            metodo_energia: h.metodoLabel,
            hosp_factor_actividad: formData.hosp_factor_actividad || h.fa,
            hosp_actividad_preset: formData.hosp_actividad_preset,
            hosp_factor_estres: formData.hosp_factor_estres || h.fe,
            hosp_estres_preset: formData.hosp_estres_preset,
            hosp_liquidos_cc_kg: formData.hosp_liquidos_cc_kg || h.liquidosCcKg,
            liquidos_ml: Math.round(h.liquidosMl),
            hosp_talon_rodilla_cm: formData.hosp_talon_rodilla_cm,
            hosp_perim_brazo_cm: formData.hosp_perim_brazo_cm,
            hosp_perim_pantorrilla_cm: formData.hosp_perim_pantorrilla_cm,
            hosp_pliegue_subescapular_mm: formData.hosp_pliegue_subescapular_mm,
            talla_estimada_chumlea: h.tallaEstimada > 0 ? Number(h.tallaEstimada.toFixed(1)) : null,
            peso_estimado_chumlea: h.pesoEstimado > 0 ? Number(h.pesoEstimado.toFixed(1)) : null,
            regla_peso: h.reglaPeso,
            hosp_ventilatorio: formData.hosp_ventilatorio,
            hosp_obesidad: formData.hosp_obesidad,
            hosp_trauma: formData.hosp_trauma,
            hosp_quemadura: formData.hosp_quemadura,
            nutricion_parenteral: {
              peso_kg: h.parenteral.peso,
              calorias: h.parenteral.calorias,
              liquidos_ml: h.parenteral.liquidos,
              prot_gkg: h.parenteral.protGkg,
              cho_gkg: h.parenteral.choGkg,
              prot_g: Number(h.parenteral.protG.toFixed(2)),
              cho_g: Number(h.parenteral.choG.toFixed(2)),
              lip_g: Number(h.parenteral.lipG.toFixed(2)),
              lip_gkg: Number(h.parenteral.lipGkg.toFixed(3)),
              flujo_mg_kg_min: Number(h.parenteral.flujoMgKgMin.toFixed(3)),
              na_meq_kg: h.parenteral.naMeqKg,
              k_meq_kg: h.parenteral.kMeqKg,
              na_total_meq: Number(h.parenteral.naTotal.toFixed(1)),
              k_total_meq: Number(h.parenteral.kTotal.toFixed(1)),
              ca_meq_dia: h.parenteral.caMeqDia,
              p_mmol_dia: h.parenteral.pMmolDia,
            },
            pn_peso_kg: formData.pn_peso_kg,
            pn_calorias: formData.pn_calorias,
            pn_liquidos_ml: formData.pn_liquidos_ml,
            pn_prot_gkg: formData.pn_prot_gkg,
            pn_cho_gkg: formData.pn_cho_gkg,
            pn_na_meq_kg: formData.pn_na_meq_kg,
            pn_k_meq_kg: formData.pn_k_meq_kg,
            pn_ca_meq_dia: formData.pn_ca_meq_dia,
            pn_p_mmol_dia: formData.pn_p_mmol_dia,
            requerimiento_base: h.reqBase,
            requerimiento_energetico: formData.requerimiento_energetico || Math.round(h.requerimientoFinal),
            requerimiento_antes_ajuste: formData.requerimiento_base_f1 || Math.round(h.requerimientoFinal),
            ajuste_calorias_modo: formData.ajuste_calorias_modo,
            ajuste_calorias_valor: formData.ajuste_calorias_valor,
            peso_referencia: formData.peso_referencia_f2 || h.pesoRef,
            factor_actividad: formData.hosp_factor_actividad || h.fa,
          };
        })()
        : isGeriatrico(formData.tipo_plan)
        ? (() => {
          const g = calculateGeriatricoEnergia(formData);
          return {
            tipo_fase: "geriatrico",
            peso_actual: formData.peso_actual,
            altura: formData.altura || (g.alturaCm > 0 ? g.alturaCm.toFixed(1) : ""),
            edad: formData.edad,
            genero: formData.genero,
            peso_saludable: formData.peso_saludable || (g.pesoSaludable > 0 ? g.pesoSaludable.toFixed(2) : ""),
            peso_ajustado: formData.peso_ajustado || (g.pesoAjustado > 0 ? g.pesoAjustado.toFixed(2) : ""),
            peso_objetivo: formData.peso_objetivo,
            imc: formData.imc || (g.imc > 0 ? g.imc.toFixed(2) : ""),
            clasificacion_imc: g.clasificacionImc,
            riesgo_sarcopenia: g.riesgoSarcopenia,
            tmb: formData.tmb || (g.tmb > 0 ? g.tmb.toFixed(2) : ""),
            formula_requerimiento: formData.formula_requerimiento || "harris_benedict",
            rango_kcal_kg: formData.rango_kcal_kg,
            rango_objetivo: formData.rango_objetivo,
            metodo_energia: g.metodoLabel,
            ger_factor_actividad: formData.ger_factor_actividad || g.fa,
            ger_actividad_preset: formData.ger_actividad_preset,
            ger_factor_estres: formData.ger_factor_estres || g.fe,
            ger_estres_preset: formData.ger_estres_preset,
            ger_liquidos_cc_kg: formData.ger_liquidos_cc_kg || g.liquidosCcKg,
            liquidos_ml: Math.round(g.liquidosMl),
            ger_talon_rodilla_cm: formData.ger_talon_rodilla_cm,
            ger_perim_brazo_cm: formData.ger_perim_brazo_cm,
            ger_perim_pantorrilla_cm: formData.ger_perim_pantorrilla_cm,
            ger_pliegue_subescapular_mm: formData.ger_pliegue_subescapular_mm,
            talla_estimada_chumlea: g.tallaEstimada > 0 ? Number(g.tallaEstimada.toFixed(1)) : null,
            peso_estimado_chumlea: g.pesoEstimado > 0 ? Number(g.pesoEstimado.toFixed(1)) : null,
            regla_peso: g.reglaPeso,
            requerimiento_base: g.reqBase,
            requerimiento_energetico: formData.requerimiento_energetico || Math.round(g.requerimientoFinal),
            requerimiento_antes_ajuste: formData.requerimiento_base_f1 || Math.round(g.requerimientoFinal),
            ajuste_calorias_modo: formData.ajuste_calorias_modo,
            ajuste_calorias_valor: formData.ajuste_calorias_valor,
            peso_referencia: formData.peso_referencia_f2 || g.pesoRef,
            factor_actividad: formData.ger_factor_actividad || g.fa,
          };
        })()
        : {
          peso_actual: formData.peso_actual,
          altura: formData.altura,
          edad: formData.edad,
          genero: formData.genero,
          peso_saludable: formData.peso_saludable,
          peso_ajustado: formData.peso_ajustado,
          peso_objetivo: formData.peso_objetivo,
          requerimiento_energetico: formData.requerimiento_energetico,
          requerimiento_antes_ajuste: formData.requerimiento_base_f1,
          ajuste_calorias_modo: formData.ajuste_calorias_modo,
          ajuste_calorias_valor: formData.ajuste_calorias_valor,
          formula_requerimiento: formData.formula_requerimiento || "schofield",
          rango_kcal_kg: formData.rango_kcal_kg,
          rango_objetivo: formData.rango_objetivo,
          imc: formData.imc,
          tmb: formData.tmb,
          factor_actividad: formData.factor_actividad,
          peso_referencia: formData.peso_referencia_f2
        },
      fase_2: {
        proteinas_gramos: formData.proteinas_gramos_f2,
        proteinas_calorias: formData.proteinas_calorias_f2,
        proteinas_amdr: formData.proteinas_amdr_f2,
        proteinas_avb_gramos: formData.proteinas_avb_gramos,
        proteinas_avb_porcentaje: formData.proteinas_avb_porcentaje,
        proteinas_kg_peso: formData.proteinas_kg_peso,
        grasas_gramos: formData.grasas_gramos_f2,
        grasas_calorias: formData.grasas_calorias_f2,
        grasas_amdr: formData.grasas_amdr_f2,
        grasas_gs_gramos: formData.grasas_gs_gramos,
        grasas_gs_amdr: formData.grasas_gs_amdr,
        grasas_gm_gramos: formData.grasas_gm_gramos,
        grasas_gm_amdr: formData.grasas_gm_amdr,
        grasas_gp_gramos: formData.grasas_gp_gramos,
        grasas_gp_amdr: formData.grasas_gp_amdr,
        grasas_colesterol: formData.grasas_colesterol,
        cho_gramos: formData.cho_gramos_f2,
        cho_calorias: formData.cho_calorias_f2,
        cho_amdr: formData.cho_amdr_f2,
        cho_concent_gramos: formData.cho_concent_gramos,
        cho_concent_amdr: formData.cho_concent_amdr,
        total_calorias: formData.total_calorias_f2,
        total_amdr: formData.total_amdr_f2,
        total_fibra: formData.total_fibra,
        peso_referencia: formData.peso_referencia_f2
      },
      fase_3: {
        grupos_alimentos: formData.grupos_alimentos_f3,
        totales: formData.totals_f3
      },
      fase_4: {
        nombre_plan: formData.nombre_plan,
        descripcion: formData.descripcion,
        categoria: formData.categoria,
        color: formData.color,
        duracion: formData.duracion,
        comidas_dia: formData.comidas_dia,
        ingredientes_f4: formData.ingredientes_f4,
        observaciones: formData.observaciones,
        weekly_menu_id: formData.weekly_menu_id
      }
    };

    // Crear el plan y asignar menú si existe
    try {
      const token = localStorage.getItem("userToken");
      // Crear el plan primero
      const response = await fetch(`${API_URL}/meal-plans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(planData),
      });

      if (response.ok) {
        const newPlan = await response.json();
        const planId = newPlan.id;

        // Si se seleccionó un menú semanal, asignarlo al plan recién creado
        if (formData.weekly_menu_id) {
          try {
            const menuResponse = await fetch(`${API_URL}/meal-plans/${planId}/assign-menu`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ weekly_menu_id: parseInt(formData.weekly_menu_id) }),
            });

            if (menuResponse.ok) {
              toast({
                title: "¡Éxito!",
                description: "Plan nutricional creado y menú asignado correctamente",
              });
            } else {
              toast({
                title: "Plan creado",
                description: "El plan se creó pero no se pudo asignar el menú semanal",
                variant: "default",
              });
            }
          } catch (error) {
            console.error("Error assigning menu:", error);
            toast({
              title: "Plan creado",
              description: "El plan se creó pero hubo un error al asignar el menú",
              variant: "default",
            });
          }
        } else {
          toast({
            title: "¡Éxito!",
            description: "Plan nutricional creado correctamente",
          });
        }

        // Llamar al callback del padre con el plan creado (ya incluye el menú asignado si se seleccionó)
        // El padre solo necesita actualizar la lista, no crear el plan de nuevo
        onCreatePlan(newPlan);

        // ASIGNACIÓN AUTOMÁTICA AL PACIENTE (prop o paciente seleccionado en fase 1)
        const effectivePatientId = patientId ?? (formData.patient_id ? Number(formData.patient_id) : null);
        if (effectivePatientId) {
          try {
            const startDate = todayInColombiaISO();
            let endDate = null;

            // Calcular fecha de fin basada en la duración (ej. "4 semanas")
            if (formData.duracion && formData.duracion.toLowerCase().includes("semana")) {
              const weeks = parseInt(formData.duracion);
              if (!isNaN(weeks)) {
                endDate = addDaysColombiaISO(weeks * 7, startDate);
              }
            }

            const assignResponse = await fetch(`${API_URL}/meal-plans/assign`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                patient_id: effectivePatientId,
                meal_plan_id: planId,
                start_date: startDate,
                end_date: endDate,
                notes: "Asignado automáticamente al crear el plan"
              }),
            });

            if (assignResponse.ok) {
              toast({
                title: "¡Asignación Automática!",
                description: `El plan "${formData.nombre_plan}" ha sido asignado al paciente.`,
              });
            }
          } catch (error) {
            console.error("Error in automatic assignment:", error);
          }
        }

        // Limpiar borrador de este paciente y reset form
        localStorage.removeItem(getDraftKey(patientId ?? formData.patient_id));
        setFormData(getDefaultFormData());
        setCurrentPhase(0);
        setCompletedPhases([]);
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo crear el plan",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating plan:", error);
      toast({
        title: "Error",
        description: "Error al crear el plan nutricional",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Plan Nutricional</DialogTitle>
          <DialogDescription>
            {currentPhase === 0
              ? "Selecciona el tipo de plan para comenzar"
              : "Completa las 4 fases para crear un plan nutricional completo"}
          </DialogDescription>
        </DialogHeader>

        {/* Paso 0: Selección de tipo de plan */}
        {currentPhase === 0 && (
          <div className="space-y-5 py-2">
            <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-background to-background px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Selecciona el tipo de plan nutricional</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Cada modalidad activa fórmulas, grupos de alimentos y flujos clínicos según EVANUT.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PLAN_TYPES.map(({ value, label, description, icon: Icon, iconClass, cardHoverClass }) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    "group relative flex w-full flex-col items-start gap-3 rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all duration-200",
                    "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    cardHoverClass,
                  )}
                  onClick={async () => {
                    handleChange("tipo_plan", value);
                    if (value === "deportista") {
                      handleChange("grupos_alimentos_f3", buildGruposAlimentos("deportista"));
                      if (!formData.factor_actividad) handleChange("factor_actividad", "2.25");
                    } else {
                      handleChange("grupos_alimentos_f3", buildGruposAlimentos(value));
                    }
                    setCurrentPhase(1);
                    if (value === "adulto") {
                      const id = await getPatientIdToLoad();
                      if (id != null) await fetchPatientAndPrefill(id);
                    } else if (value === "deportista") {
                      const id = await getPatientIdToLoad();
                      if (id != null) await fetchPatientAndPrefillDeportista(id);
                      else toast({ title: "Sin pacientes", description: "No hay pacientes registrados. Crea uno primero para cargar sus datos.", variant: "destructive" });
                    } else if (value === "pediatria") {
                      const id = await getPatientIdToLoad();
                      if (id != null) await fetchPatientAndPrefillPediatria(id);
                      else toast({ title: "Sin pacientes", description: "No hay pacientes registrados. Crea uno primero para cargar sus datos.", variant: "destructive" });
                    } else if (value === "gestante" || value === "gestante_adolescente") {
                      const id = await getPatientIdToLoad();
                      if (id != null) await fetchPatientAndPrefillGestante(id, value);
                      else toast({ title: "Sin pacientes", description: "No hay pacientes registrados. Crea uno primero para cargar sus datos.", variant: "destructive" });
                    } else if (value === "hospitalizado") {
                      handleChange("formula_requerimiento", "harris_benedict");
                      handleChange("hosp_factor_actividad", "1.15");
                      handleChange("hosp_factor_estres", "1.0");
                      handleChange("hosp_liquidos_cc_kg", "35");
                      const id = await getPatientIdToLoad();
                      if (id != null) await fetchPatientAndPrefillHospitalizado(id);
                      else toast({ title: "Sin pacientes", description: "No hay pacientes registrados. Crea uno primero para cargar sus datos.", variant: "destructive" });
                    } else if (value === "geriatrico") {
                      handleChange("formula_requerimiento", "harris_benedict");
                      handleChange("ger_factor_actividad", "1.3");
                      handleChange("ger_factor_estres", "1.0");
                      handleChange("ger_liquidos_cc_kg", "30");
                      const id = await getPatientIdToLoad();
                      if (id != null) await fetchPatientAndPrefillGeriatrico(id);
                      else toast({ title: "Sin pacientes", description: "No hay pacientes registrados. Crea uno primero para cargar sus datos.", variant: "destructive" });
                    }
                  }}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105", iconClass)}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                  </div>
                  <div className="space-y-1 pr-2">
                    <p className="text-sm font-semibold leading-tight text-foreground">{label}</p>
                    <p className="text-xs leading-snug text-muted-foreground">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentPhase >= 1 ? (
          <>
            {/* Tipo de plan (visible en fases clínicas para poder cambiarlo) */}
            <div className="space-y-2">
              <Label className="text-base font-semibold text-primary">Tipo de plan</Label>
              <Select
                value={formData.tipo_plan || "adulto"}
                onValueChange={(value) => {
                  handleChange("tipo_plan", value);
                  handleChange("grupos_alimentos_f3", {
                    ...buildGruposAlimentos(value),
                    ...Object.fromEntries(
                      Object.entries(formData.grupos_alimentos_f3 || {}).filter(([k, v]: any) =>
                        parseFloat(v?.porciones) > 0 || v?.manual
                      )
                    ),
                  });
                  if (value === "deportista" && !formData.factor_actividad) {
                    handleChange("factor_actividad", "2.25");
                  }
                  if (value === "hospitalizado") {
                    if (!formData.formula_requerimiento || formData.formula_requerimiento === "schofield") {
                      handleChange("formula_requerimiento", "harris_benedict");
                    }
                    if (!formData.hosp_factor_actividad) handleChange("hosp_factor_actividad", "1.15");
                    if (!formData.hosp_factor_estres) handleChange("hosp_factor_estres", "1.0");
                    if (!formData.hosp_liquidos_cc_kg) handleChange("hosp_liquidos_cc_kg", "35");
                  }
                  if (value === "geriatrico") {
                    if (!formData.formula_requerimiento || formData.formula_requerimiento === "schofield") {
                      handleChange("formula_requerimiento", "harris_benedict");
                    }
                    if (!formData.ger_factor_actividad) handleChange("ger_factor_actividad", "1.3");
                    if (!formData.ger_factor_estres) handleChange("ger_factor_estres", "1.0");
                    if (!formData.ger_liquidos_cc_kg) handleChange("ger_liquidos_cc_kg", "30");
                  }
                }}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Progress Bar (5 pasos: tipo + 4 fases) */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Paso {currentPhase + 1} de 5</span>
                <span>{Math.round(((currentPhase + 1) / 5) * 100)}% completado</span>
              </div>
              <Progress value={((currentPhase + 1) / 5) * 100} />
            </div>

            {/* Phase Indicators */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {PHASES.map((phase) => {
                const Icon = phase.icon;
                const isActive = currentPhase === phase.id;
                const isCompleted = completedPhases.includes(phase.id);

                return (
                  <div
                    key={phase.id}
                    className={`flex flex-col items-center p-2 rounded-lg border-2 transition-colors ${isActive
                      ? "border-primary bg-primary/10"
                      : isCompleted
                        ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                        : "border-muted bg-muted/50"
                      }`}
                  >
                    <Icon className={`h-5 w-5 mb-1 ${isActive ? "text-primary" : isCompleted ? "text-green-600" : "text-muted-foreground"
                      }`} />
                    <span className={`text-xs text-center font-medium ${isActive ? "text-primary" : isCompleted ? "text-green-600" : "text-muted-foreground"
                      }`}>
                      {phase.id}
                    </span>
                    {isCompleted && (
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        <div>
          {/* Phase 1 Deportista: Somatotipo + composición corporal (EVANUT 4.1) */}
          {currentPhase === 1 && formData.tipo_plan === "deportista" && (() => {
            const m = calculateDeportistaMetrics(formData);
            return (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                  <div className="space-y-1 min-w-[200px]">
                    <Label>Paciente (cargar desde BD)</Label>
                    <Select
                      value={formData.patient_id ? String(formData.patient_id) : undefined}
                      onValueChange={(v) => handleChange("patient_id", v === "" ? "" : Number(v))}
                      disabled={loadingPatientsList}
                    >
                      <SelectTrigger><SelectValue placeholder={loadingPatientsList ? "Cargando..." : "Selecciona un paciente"} /></SelectTrigger>
                      <SelectContent>
                        {patientsList.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loadingPatient || !formData.patient_id}
                    onClick={() => formData.patient_id && fetchPatientAndPrefillDeportista(Number(formData.patient_id))}
                  >
                    {loadingPatient ? "Cargando..." : "Cargar datos del paciente"}
                  </Button>
                </div>

                {/* ——— 1. SOMATOTIPO ——— */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      1. Somatotipo (Heath-Carter)
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Endomorfia, mesomorfia y ectomorfia a partir de pliegues, diámetros y perímetros (EVANUT 4.1)
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg border bg-slate-100/80 dark:bg-slate-900/40 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide mb-2 text-foreground">
                        Medidas para somatotipo
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Endomorfia → pliegues (tríceps, subescapular, supraespinal) + estatura</li>
                        <li>• Mesomorfia → diámetros (húmero, fémur), perímetros corregidos, estatura</li>
                        <li>• Ectomorfia → peso y estatura (HWR)</li>
                      </ul>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1"><Label>Peso (kg)</Label><Input type="number" step="0.1" value={formData.deportista_peso} onChange={(e) => handleChange("deportista_peso", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Estatura (cm)</Label><Input type="number" step="0.1" value={formData.deportista_estatura} onChange={(e) => handleChange("deportista_estatura", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Tríceps (mm)</Label><Input type="number" step="0.1" value={formData.deportista_triceps} onChange={(e) => handleChange("deportista_triceps", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Subescapular (mm)</Label><Input type="number" step="0.1" value={formData.deportista_subescapular} onChange={(e) => handleChange("deportista_subescapular", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Supraespinal (mm)</Label><Input type="number" step="0.1" value={formData.deportista_supraespinal} onChange={(e) => handleChange("deportista_supraespinal", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Diám. húmero (cm)</Label><Input type="number" step="0.01" value={formData.deportista_diametro_humero} onChange={(e) => handleChange("deportista_diametro_humero", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Diám. fémur (cm)</Label><Input type="number" step="0.01" value={formData.deportista_diametro_femur} onChange={(e) => handleChange("deportista_diametro_femur", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Perím. brazo tenso (cm)</Label><Input type="number" step="0.1" value={formData.deportista_perim_brazo_tenso} onChange={(e) => handleChange("deportista_perim_brazo_tenso", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Perím. pantorrilla (cm)</Label><Input type="number" step="0.1" value={formData.deportista_perim_pantorrilla} onChange={(e) => handleChange("deportista_perim_pantorrilla", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Pliegue pantorrilla (mm)</Label><Input type="number" step="0.1" value={formData.deportista_pliegue_pantorrilla} onChange={(e) => handleChange("deportista_pliegue_pantorrilla", e.target.value)} /></div>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Sumatoria</span><p className="font-medium">{m.sumatoria > 0 ? m.sumatoria.toFixed(2) : "—"}</p></div>
                      <div><span className="text-muted-foreground">Corrección prop.</span><p className="font-medium">{m.correccionProp > 0 ? m.correccionProp.toFixed(4) : "—"}</p></div>
                      <div><span className="text-muted-foreground">Perím. brazo corregido</span><p className="font-medium">{formData.deportista_perim_brazo_tenso ? m.perimBrazoCorr.toFixed(2) : "—"}</p></div>
                      <div><span className="text-muted-foreground">Perím. pant. corregido</span><p className="font-medium">{formData.deportista_perim_pantorrilla ? m.perimPantCorr.toFixed(2) : "—"}</p></div>
                      <div><span className="text-muted-foreground">HWR</span><p className="font-medium">{m.hwr > 0 ? m.hwr.toFixed(2) : "—"}</p></div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Componentes del somatotipo</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                        <div className="rounded border p-2"><span className="text-muted-foreground block">Endomorfia</span><p className="font-bold">{m.endomorfia ? m.endomorfia.toFixed(2) : "—"}</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">Mesomorfia</span><p className="font-bold">{m.mesomorfia ? m.mesomorfia.toFixed(2) : "—"}</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">Ectomorfia</span><p className="font-bold">{m.ectomorfia ? m.ectomorfia.toFixed(2) : "—"}</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">X</span><p className="font-bold">{m.endomorfia || m.ectomorfia ? m.coordX.toFixed(2) : "—"}</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">Y</span><p className="font-bold">{m.mesomorfia ? m.coordY.toFixed(2) : "—"}</p></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ——— 2. COMPOSICIÓN CORPORAL ——— */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-primary" />
                      2. Composición corporal
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Índice córmico, estimación de talla, AB/AMB/AGM, % grasa (Yuhasz / Durnin / Jackson-Pollock / Brozek), 5 componentes y peso óptimo
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg border bg-slate-100/80 dark:bg-slate-900/40 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide mb-2 text-foreground">
                        Medidas para composición
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Índice córmico → talla sentado + estatura</li>
                          <li>• Estimación de talla → altura de rodilla + edad</li>
                          <li>• AB / AMB / AGM → perímetro brazo relajado + pliegue tríceps</li>
                          <li>• 5 componentes → peso, % grasa, diámetros, estatura</li>
                        </ul>
                        <ul className="space-y-1 text-muted-foreground">
                          <li className="font-medium text-foreground">% Grasa corporal</li>
                          <li>• Yuhasz → 6 pliegues</li>
                          <li>• Durnin & Womersley → 4 pliegues (+ bíceps)</li>
                          <li>• Jackson & Pollock → 3 sitios</li>
                          <li>• Brozek → densidad (Durnin/Jackson)</li>
                        </ul>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1"><Label>Perím. brazo relajado (cm)</Label><Input type="number" step="0.1" value={formData.deportista_perim_brazo_relajado} onChange={(e) => handleChange("deportista_perim_brazo_relajado", e.target.value)} placeholder="Para AB/AMB/AGM" /></div>
                      <div className="space-y-1"><Label>Talla sentado (cm)</Label><Input type="number" step="0.1" value={formData.deportista_talla_sentado} onChange={(e) => handleChange("deportista_talla_sentado", e.target.value)} placeholder="Índice córmico" /></div>
                      <div className="space-y-1"><Label>Altura de rodilla (cm)</Label><Input type="number" step="0.1" value={formData.deportista_altura_rodilla} onChange={(e) => handleChange("deportista_altura_rodilla", e.target.value)} placeholder="Estimación talla" /></div>
                      <div className="space-y-1"><Label>Bíceps (mm)</Label><Input type="number" step="0.1" value={formData.deportista_biceps} onChange={(e) => handleChange("deportista_biceps", e.target.value)} placeholder="Durnin" /></div>
                      <div className="space-y-1"><Label>Pecho (mm)</Label><Input type="number" step="0.1" value={formData.deportista_pecho} onChange={(e) => handleChange("deportista_pecho", e.target.value)} placeholder="Jackson ♂" /></div>
                      <div className="space-y-1"><Label>Edad (compos./Chumlea)</Label><Input type="number" step="1" value={formData.deportista_edad_composicion || formData.edad} onChange={(e) => { handleChange("deportista_edad_composicion", e.target.value); handleChange("edad", e.target.value); }} /></div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Índice córmico · Estimación de talla · AB/AMB/AGM</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                        <div className="rounded border p-2"><span className="text-muted-foreground block">Índice córmico</span><p className="font-bold">{m.indiceCormico > 0 ? m.indiceCormico.toFixed(2) : "—"}</p><p className="text-xs text-muted-foreground">{m.clasificacionCormico || ""}</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">Talla estimada (cm)</span><p className="font-bold">{m.tallaEstimada > 0 ? m.tallaEstimada.toFixed(1) : "—"}</p><p className="text-xs text-muted-foreground">Chumlea</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">AB (cm²)</span><p className="font-bold">{m.areaBraquial > 0 ? m.areaBraquial.toFixed(2) : "—"}</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">AMB (cm²)</span><p className="font-bold">{m.areaMuscularBrazo > 0 ? m.areaMuscularBrazo.toFixed(2) : "—"}</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">AGM (cm²)</span><p className="font-bold">{m.areaGrasaBrazo > 0 ? m.areaGrasaBrazo.toFixed(2) : "—"}</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">PMB (cm)</span><p className="font-bold">{m.perimetroMuscularBrazo > 0 ? m.perimetroMuscularBrazo.toFixed(2) : "—"}</p></div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">% Grasa corporal</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1"><Label>Método</Label>
                          <Select value={formData.deportista_metodo_grasa || "yuhasz"} onValueChange={(v) => handleChange("deportista_metodo_grasa", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yuhasz">Yuhasz</SelectItem>
                              <SelectItem value="durnin">Durnin & Womersley</SelectItem>
                              <SelectItem value="jackson_pollock">Jackson & Pollock</SelectItem>
                              <SelectItem value="brozek">Brozek</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1"><Label>Sexo</Label>
                          <Select value={formData.deportista_yuhasz_sexo || "masculino"} onValueChange={(v) => handleChange("deportista_yuhasz_sexo", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="masculino">Hombre</SelectItem><SelectItem value="femenino">Mujer</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1"><Label>Abdominal (mm)</Label><Input type="number" step="0.1" value={formData.deportista_yuhasz_abdominal} onChange={(e) => handleChange("deportista_yuhasz_abdominal", e.target.value)} /></div>
                        <div className="space-y-1"><Label>Muslo medio (mm)</Label><Input type="number" step="0.1" value={formData.deportista_yuhasz_muslo_medio} onChange={(e) => handleChange("deportista_yuhasz_muslo_medio", e.target.value)} /></div>
                      </div>
                      <div className="mt-3 rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div><span className="text-muted-foreground">% Grasa ({m.metodoGrasaLabel})</span><p className="font-bold text-primary">{m.pctGrasaSeleccionado > 0 ? m.pctGrasaSeleccionado.toFixed(2) : "—"}</p></div>
                        <div><span className="text-muted-foreground">Yuhasz</span><p className="font-medium">{m.pctGrasaYuhasz > 0 ? m.pctGrasaYuhasz.toFixed(2) : "—"}</p></div>
                        <div><span className="text-muted-foreground">Durnin (Siri)</span><p className="font-medium">{m.pctGrasaDurnin > 0 ? m.pctGrasaDurnin.toFixed(2) : "—"}</p></div>
                        <div><span className="text-muted-foreground">Jackson & Pollock</span><p className="font-medium">{m.pctGrasaJackson > 0 ? m.pctGrasaJackson.toFixed(2) : "—"}</p></div>
                        <div><span className="text-muted-foreground">Brozek (densidad)</span><p className="font-medium">{m.pctGrasaBrozek > 0 ? m.pctGrasaBrozek.toFixed(2) : "—"}</p></div>
                        <div><span className="text-muted-foreground">Densidad (g/ml)</span><p className="font-medium">{m.densidadSeleccionada > 0 ? m.densidadSeleccionada.toFixed(4) : "—"}</p></div>
                        <div><span className="text-muted-foreground">Peso graso (kg)</span><p className="font-medium">{m.pesoGraso > 0 ? m.pesoGraso.toFixed(2) : "—"}</p></div>
                        <div><span className="text-muted-foreground">Masa libre grasa (kg)</span><p className="font-medium">{m.masaLibreGrasa > 0 ? m.masaLibreGrasa.toFixed(2) : "—"}</p></div>
                        <div><span className="text-muted-foreground">Índice AKS</span><p className="font-medium">{m.aks > 0 ? m.aks.toFixed(3) : "—"}</p></div>
                        <div className="sm:col-span-2"><span className="text-muted-foreground">Clasificación AKS</span><p className="font-medium">{m.clasificacionAks || "—"}</p></div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">5 componentes corporales</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                        <div className="rounded border p-2"><span className="text-muted-foreground block">1. Masa grasa</span><p className="font-bold">{m.pesoGraso > 0 ? `${m.pesoGraso.toFixed(2)} kg` : "—"}</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">2. Masa ósea</span><p className="font-bold">{m.masaOsea > 0 ? `${m.masaOsea.toFixed(2)} kg` : "—"}</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">3. Masa residual</span><p className="font-bold">{m.masaResidual > 0 ? `${m.masaResidual.toFixed(2)} kg` : "—"}</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">4. Masa muscular</span><p className="font-bold">{m.masaMuscular > 0 ? `${m.masaMuscular.toFixed(2)} kg` : "—"}</p></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block">5. Suma / peso</span><p className="font-bold">{m.suma5Componentes > 0 ? `${m.suma5Componentes.toFixed(2)} kg` : "—"}</p><p className="text-xs text-muted-foreground">MLG {m.masaLibreGrasa > 0 ? m.masaLibreGrasa.toFixed(2) : "—"} kg</p></div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Peso óptimo</h4>
                      <div className="flex flex-wrap gap-3 items-end">
                        <div className="space-y-1"><Label>% grasa esperado</Label><Input type="number" step="0.1" value={formData.deportista_pct_grasa_esperado} onChange={(e) => handleChange("deportista_pct_grasa_esperado", e.target.value)} placeholder="Ej. 15" className="w-24" /></div>
                        <div className="rounded border p-2"><span className="text-muted-foreground block text-sm">Peso óptimo (kg)</span><p className="font-bold text-lg">{m.pesoOptimo > 0 ? m.pesoOptimo.toFixed(2) : "—"}</p></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ——— 3. REQUERIMIENTO ENERGÉTICO ——— */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-primary" />
                      3. Requerimiento energético
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Para definir las calorías totales utilice las fórmulas de requerimientos generales (TMR × PAL) o el cálculo de METs
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label>Edad (años)</Label>
                        <Input type="number" value={formData.edad} onChange={(e) => handleChange("edad", e.target.value)} placeholder="25" />
                      </div>
                      <div className="space-y-1">
                        <Label>Factor PAL</Label>
                        <Select
                          value={formData.factor_actividad || "2.25"}
                          onValueChange={(v) => handleChange("factor_actividad", v)}
                        >
                          <SelectTrigger><SelectValue placeholder="Actividad" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1.53">Sedentario (1.53)</SelectItem>
                            <SelectItem value="1.76">Moderado (1.76)</SelectItem>
                            <SelectItem value="2.25">Vigoroso (2.25)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 sm:col-span-2 flex items-end">
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full"
                          onClick={() => {
                            const pesoRef = m.pesoOptimo > 0
                              ? m.pesoOptimo
                              : (parseFloat(formData.deportista_peso) || 0);
                            const edad = parseFloat(formData.edad) || 25;
                            const genero = formData.deportista_yuhasz_sexo === "femenino" ? "femenino" : "masculino";
                            const pal = parseFloat(formData.factor_actividad) || 2.25;
                            if (!(pesoRef > 0)) {
                              toast({ title: "Falta el peso", description: "Ingresa peso o % grasa esperado para peso óptimo", variant: "destructive" });
                              return;
                            }
                            let tmb = 0;
                            if (genero === "masculino") {
                              if (edad <= 30) tmb = 15.057 * pesoRef + 692.2;
                              else if (edad <= 60) tmb = 11.472 * pesoRef + 873.1;
                              else tmb = 11.711 * pesoRef + 587.7;
                            } else {
                              if (edad <= 30) tmb = 14.818 * pesoRef + 486.6;
                              else if (edad <= 60) tmb = 8.126 * pesoRef + 845.6;
                              else tmb = 9.082 * pesoRef + 658.5;
                            }
                            const baseReq = Math.round(tmb * pal);
                            const adjFields = withAjusteCaloriasFields(baseReq, formData);
                            handleChange("tmb", tmb.toFixed(1));
                            handleChange("requerimiento_base_f1", adjFields.requerimiento_base_f1);
                            handleChange("requerimiento_energetico", adjFields.requerimiento_energetico);
                            handleChange("total_calorias_f2", adjFields.total_calorias_f2);
                            const delta = getAjusteCaloriasDelta(formData);
                            const deltaTxt = delta ? ` (ajuste ${delta > 0 ? "+" : ""}${delta})` : "";
                            toast({ title: "Calorías calculadas", description: `TMR ${tmb.toFixed(0)} × PAL ${pal} = ${baseReq} kcal${deltaTxt} → ${adjFields.requerimiento_energetico} kcal` });
                          }}
                        >
                          Calcular kcal (TMR × PAL)
                        </Button>
                      </div>
                    </div>
                    {renderAjusteCaloriasUI()}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="deportista_kcal">Calorías totales del plan (kcal) *</Label>
                        <Input
                          id="deportista_kcal"
                          type="number"
                          step="1"
                          value={formData.requerimiento_energetico}
                          onChange={(e) => {
                            handleChange("requerimiento_energetico", e.target.value);
                            handleChange("total_calorias_f2", e.target.value);
                          }}
                          placeholder="Ej. 2800"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Peso de referencia Fase 2 (kg)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.peso_referencia_f2}
                          onChange={(e) => {
                            handleChange("peso_referencia_f2", e.target.value);
                            handleChange("peso_objetivo", e.target.value);
                          }}
                          placeholder={m.pesoOptimo > 0 ? m.pesoOptimo.toFixed(2) : "Peso o peso óptimo"}
                        />
                        {m.pesoOptimo > 0 && (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-xs"
                            onClick={() => {
                              handleChange("peso_referencia_f2", m.pesoOptimo.toFixed(2));
                              handleChange("peso_objetivo", m.pesoOptimo.toFixed(2));
                            }}
                          >
                            Usar peso óptimo ({m.pesoOptimo.toFixed(2)} kg)
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Phase 1 Pediatría: GER FAO/OMS 2005 */}
          {currentPhase === 1 && formData.tipo_plan === "pediatria" && (() => {
            const syncReq = (next: Record<string, any>) => {
              const merged = { ...formData, ...next };
              const calc = calculatePediatriaEnergia(merged);
              const adj = withAjusteCaloriasFields(calc.requerimientoFinal, merged);
              setFormData((prev: any) => ({
                ...prev,
                ...next,
                ...adj,
                imc: calc.imc > 0 ? calc.imc.toFixed(2) : prev.imc,
                peso_referencia_f2: String(next.pediatria_peso_referencia ?? prev.peso_referencia_f2 ?? calc.pesoRef),
              }));
            };
            const p = calculatePediatriaEnergia(formData);
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Evaluación y requerimiento pediátrico
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    GER FAO/OMS 2005 según EVANUT 4.1 — hoja Pediatría
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                    <div className="space-y-1 min-w-[200px]">
                      <Label>Paciente (cargar desde BD)</Label>
                      <Select
                        value={formData.patient_id ? String(formData.patient_id) : undefined}
                        onValueChange={(v) => handleChange("patient_id", v === "" ? "" : Number(v))}
                        disabled={loadingPatientsList}
                      >
                        <SelectTrigger><SelectValue placeholder={loadingPatientsList ? "Cargando..." : "Selecciona un paciente"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" disabled>Selecciona un paciente</SelectItem>
                          {patientsList.map((pat) => (
                            <SelectItem key={pat.id} value={String(pat.id)}>{pat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={loadingPatient || !formData.patient_id}
                      onClick={() => formData.patient_id && fetchPatientAndPrefillPediatria(Number(formData.patient_id))}
                    >
                      {loadingPatient ? "Cargando..." : "Cargar datos del paciente"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label>Sexo</Label>
                      <Select value={formData.pediatria_sexo || "femenino"} onValueChange={(v) => syncReq({ pediatria_sexo: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="femenino">Mujer</SelectItem>
                          <SelectItem value="masculino">Hombre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Edad (años)</Label><Input type="number" min="0" value={formData.pediatria_edad_anos} onChange={(e) => syncReq({ pediatria_edad_anos: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Edad (meses)</Label><Input type="number" min="0" max="11" value={formData.pediatria_edad_meses} onChange={(e) => syncReq({ pediatria_edad_meses: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Peso (kg)</Label><Input type="number" step="0.1" value={formData.pediatria_peso} onChange={(e) => syncReq({ pediatria_peso: e.target.value, pediatria_peso_referencia: formData.pediatria_peso_referencia || e.target.value })} /></div>
                    <div className="space-y-1"><Label>Talla/Longitud (cm)</Label><Input type="number" step="0.1" value={formData.pediatria_talla_cm} onChange={(e) => syncReq({ pediatria_talla_cm: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Perímetro cefálico (cm)</Label><Input type="number" step="0.1" value={formData.pediatria_perimetro_cefalico} onChange={(e) => syncReq({ pediatria_perimetro_cefalico: e.target.value })} placeholder="Opcional" /></div>
                    <div className="space-y-1"><Label>Peso referencia (kg)</Label><Input type="number" step="0.1" value={formData.pediatria_peso_referencia} onChange={(e) => syncReq({ pediatria_peso_referencia: e.target.value })} /></div>
                    <div className="space-y-1"><Label>IMC deseado (opc.)</Label><Input type="number" step="0.1" value={formData.pediatria_imc_deseado} onChange={(e) => syncReq({ pediatria_imc_deseado: e.target.value })} placeholder="Ej. 17" /></div>
                    <div className="space-y-1">
                      <Label>IMC actual</Label>
                      <Input readOnly className="bg-muted" value={p.imc > 0 ? p.imc.toFixed(2) : "—"} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usa peso de referencia solo en exceso de peso (&lt;5 años: Peso/Talla ref; ≥5: IMC/Edad). IMC deseado calcula peso ref automáticamente.
                    {p.pesoRefImc > 0 ? ` Peso ref por IMC deseado: ${p.pesoRefImc.toFixed(2)} kg.` : ""}
                  </p>

                  {p.ageYears < 1 && (
                    <div className="space-y-2">
                      <Label>Alimentación 0–1 año</Label>
                      <Select value={formData.pediatria_alimentacion_0_1 || "leche_materna"} onValueChange={(v) => syncReq({ pediatria_alimentacion_0_1: v })}>
                        <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="leche_materna">Leche materna</SelectItem>
                          <SelectItem value="formula">Solo fórmula infantil</SelectItem>
                          <SelectItem value="mixto">Mixto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1"><Label>Ganancia (g/día)</Label><Input type="number" step="0.1" value={formData.pediatria_ganancia_g_dia} onChange={(e) => syncReq({ pediatria_ganancia_g_dia: e.target.value })} placeholder="0" /></div>
                    <div className="space-y-1"><Label>kcal × gramo</Label><Input type="number" step="0.1" value={formData.pediatria_kcal_por_gramo} onChange={(e) => syncReq({ pediatria_kcal_por_gramo: e.target.value })} /></div>
                    <div className="space-y-1">
                      <Label>Actividad física</Label>
                      <Select value={formData.pediatria_actividad || "Moderado"} onValueChange={(v) => syncReq({ pediatria_actividad: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sedentario">Sedentario (×0.85)</SelectItem>
                          <SelectItem value="Moderado">Moderado (×1.0)</SelectItem>
                          <SelectItem value="Activo">Activo (×1.15)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Déficit de peso</Label>
                      <Select value={formData.pediatria_deficit || "Ninguno"} onValueChange={(v) => syncReq({ pediatria_deficit: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ninguno">Ninguno</SelectItem>
                          <SelectItem value="Duplicar">Duplicar ganancia</SelectItem>
                          <SelectItem value="Triplicar">Triplicar ganancia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Modo GER</span><p className="font-medium">{p.gerModo || "—"}</p></div>
                    <div><span className="text-muted-foreground">GER base</span><p className="font-medium">{p.gerBase > 0 ? Math.round(p.gerBase) : "—"} kcal</p></div>
                    <div><span className="text-muted-foreground">+ Crecimiento</span><p className="font-medium">{Math.round(p.adicionalesCrecimiento)} kcal</p></div>
                    <div><span className="text-muted-foreground">× Actividad</span><p className="font-medium">{p.factorAct}</p></div>
                    <div><span className="text-muted-foreground">Catch-up</span><p className="font-medium">{Math.round(p.catchUpKcal)} kcal</p></div>
                    <div className="sm:col-span-2"><span className="text-muted-foreground">RIEN</span><p className="font-medium">{p.rien.band}: {p.rien.proteinas_kg} g/kg · grasa {p.rien.grasas_amdr}%</p></div>
                    <div>
                      <span className="text-muted-foreground">Requerimiento total</span>
                      <p className="font-bold text-lg text-primary">{Math.round(p.requerimientoFinal)} kcal</p>
                    </div>
                  </div>

                  <PediatricGrowthPanel
                    gender={formData.pediatria_sexo}
                    birthDate={formData.pediatria_fecha_nacimiento}
                    ageYears={formData.pediatria_edad_anos}
                    ageMonths={formData.pediatria_edad_meses}
                    weightKg={formData.pediatria_peso}
                    heightCm={formData.pediatria_talla_cm}
                    headCircumferenceCm={formData.pediatria_perimetro_cefalico}
                  />

                  <div>
                    <h4 className="font-semibold mb-2">Antropometría braquial (opcional)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="space-y-1"><Label>Perímetro brazo (mm)</Label><Input type="number" step="0.1" value={formData.pediatria_perim_brazo_mm} onChange={(e) => handleChange("pediatria_perim_brazo_mm", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Pliegue tricipital (mm)</Label><Input type="number" step="0.1" value={formData.pediatria_pliegue_tricipital_mm} onChange={(e) => handleChange("pediatria_pliegue_tricipital_mm", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Pliegue subescapular (mm)</Label><Input type="number" step="0.1" value={formData.pediatria_pliegue_subescapular_mm} onChange={(e) => handleChange("pediatria_pliegue_subescapular_mm", e.target.value)} /></div>
                    </div>
                    <div className="mt-3 rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <div><span className="text-muted-foreground">PMB (mm)</span><p className="font-medium">{p.perimMuscularBrazo > 0 ? p.perimMuscularBrazo.toFixed(1) : "—"}</p></div>
                      <div><span className="text-muted-foreground">AMB (mm²)</span><p className="font-medium">{p.areaMuscularBrazo > 0 ? p.areaMuscularBrazo.toFixed(1) : "—"}</p></div>
                      <div><span className="text-muted-foreground">AGB (mm²)</span><p className="font-medium">{p.areaGrasaBrazo > 0 ? p.areaGrasaBrazo.toFixed(1) : "—"}</p></div>
                      <div><span className="text-muted-foreground">Adiposidad</span><p className="font-medium">{p.adiposidad > 0 ? p.adiposidad.toFixed(1) : "—"}</p></div>
                    </div>
                  </div>

                  {renderAjusteCaloriasUI()}
                  <div className="space-y-1 max-w-xs">
                    <Label>Calorías del plan (editables)</Label>
                    <Input
                      type="number"
                      value={formData.requerimiento_energetico}
                      onChange={(e) => {
                        handleChange("requerimiento_energetico", e.target.value);
                        handleChange("total_calorias_f2", e.target.value);
                      }}
                    />
                    <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => syncReq({})}>
                      Recalcular desde fórmulas FAO/OMS
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Phase 1 Gestante / Gestante adolescente */}
          {currentPhase === 1 && isGestanteTipo(formData.tipo_plan) && (() => {
            const adoles = isGestAdoles(formData.tipo_plan);
            const syncReq = (next: Record<string, any>) => {
              const merged = { ...formData, ...next };
              if (adoles) {
                const calc = calculateGestanteAdolescenteEnergia(merged);
                const adj = withAjusteCaloriasFields(calc.requerimientoFinal, merged);
                setFormData((prev: any) => ({
                  ...prev,
                  ...next,
                  ...adj,
                  imc: calc.imcPreg > 0 ? calc.imcPreg.toFixed(2) : prev.imc,
                  tmb: calc.tmr > 0 ? calc.tmr.toFixed(1) : prev.tmb,
                  peso_referencia_f2: String(next.gestante_peso_ref ?? prev.peso_referencia_f2 ?? calc.pesoRef),
                }));
              } else {
                const calc = calculateGestanteEnergia(merged);
                const adj = withAjusteCaloriasFields(calc.requerimientoFinal, merged);
                setFormData((prev: any) => ({
                  ...prev,
                  ...next,
                  ...adj,
                  imc: calc.imcPreg > 0 ? calc.imcPreg.toFixed(2) : prev.imc,
                  tmb: calc.tmr > 0 ? calc.tmr.toFixed(1) : prev.tmb,
                  factor_actividad: String(next.gestante_pal ?? prev.gestante_pal ?? prev.factor_actividad),
                  peso_referencia_f2: String(next.gestante_peso_ref ?? prev.peso_referencia_f2 ?? calc.pesoRef),
                }));
              }
            };
            const gAdult = !adoles ? calculateGestanteEnergia(formData) : null;
            const gAd = adoles ? calculateGestanteAdolescenteEnergia(formData) : null;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    {adoles ? "Evaluación gestante adolescente" : "Evaluación y requerimiento gestante"}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {adoles
                      ? "Puntaje Z, fórmula energética + extras de gestación (EVANUT Ges Adoles)"
                      : "IMC Atalah, ganancia gestacional, fórmula energética + extras por trimestre (EVANUT Gestante)"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                    <div className="space-y-1 min-w-[200px]">
                      <Label>Paciente (cargar desde BD)</Label>
                      <Select
                        value={formData.patient_id ? String(formData.patient_id) : undefined}
                        onValueChange={(v) => handleChange("patient_id", v === "" ? "" : Number(v))}
                        disabled={loadingPatientsList}
                      >
                        <SelectTrigger><SelectValue placeholder={loadingPatientsList ? "Cargando..." : "Selecciona un paciente"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" disabled>Selecciona un paciente</SelectItem>
                          {patientsList.map((pat) => (
                            <SelectItem key={pat.id} value={String(pat.id)}>{pat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={loadingPatient || !formData.patient_id}
                      onClick={() => formData.patient_id && fetchPatientAndPrefillGestante(Number(formData.patient_id), formData.tipo_plan)}
                    >
                      {loadingPatient ? "Cargando..." : "Cargar datos del paciente"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1"><Label>Edad (años)</Label><Input type="number" value={formData.gestante_edad} onChange={(e) => {
                      const v = e.target.value;
                      const next: any = { gestante_edad: v };
                      if (adoles) next.gestante_ganancia_diaria_g = String(getGestAdolesDailyGainG(parseFloat(v) || 0));
                      syncReq(next);
                    }} /></div>
                    <div className="space-y-1"><Label>Peso pregestacional (kg)</Label><Input type="number" step="0.1" value={formData.gestante_peso_preg} onChange={(e) => syncReq({ gestante_peso_preg: e.target.value, gestante_peso_ref: formData.gestante_peso_ref || e.target.value })} /></div>
                    <div className="space-y-1"><Label>Estatura (m)</Label><Input type="number" step="0.01" value={formData.gestante_estatura_m} onChange={(e) => syncReq({ gestante_estatura_m: e.target.value })} placeholder="1.55" /></div>
                    <div className="space-y-1"><Label>Semana gestacional *</Label><Input type="number" min="1" max="42" value={formData.gestante_semana} onChange={(e) => syncReq({ gestante_semana: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Peso actual (kg)</Label><Input type="number" step="0.1" value={formData.gestante_peso_actual} onChange={(e) => syncReq({ gestante_peso_actual: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Peso ref (kg)</Label><Input type="number" step="0.1" value={formData.gestante_peso_ref} onChange={(e) => syncReq({ gestante_peso_ref: e.target.value })} /></div>
                    {adoles ? (
                      <>
                        <div className="space-y-1"><Label>Puntaje Z (IMC/edad) *</Label><Input type="number" step="0.01" value={formData.gestante_puntaje_z} onChange={(e) => syncReq({ gestante_puntaje_z: e.target.value })} placeholder="Ej. -0.5" /></div>
                        <div className="space-y-1"><Label>Ganancia diaria crecimiento (g)</Label><Input type="number" step="0.1" value={formData.gestante_ganancia_diaria_g} onChange={(e) => syncReq({ gestante_ganancia_diaria_g: e.target.value })} /></div>
                        {(formData.formula_requerimiento || "schofield") !== "rango_calorico" && (
                          <div className="space-y-1">
                            <Label>Actividad física</Label>
                            <Select value={formData.gestante_actividad_adoles || "Moderado"} onValueChange={(v) => syncReq({ gestante_actividad_adoles: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Sedentario">Sedentario (×0.85)</SelectItem>
                                <SelectItem value="Moderado">Moderado (×1.0)</SelectItem>
                                <SelectItem value="Activo">Activo (×1.15)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="space-y-1"><Label>IMC deseado (opc.)</Label><Input type="number" step="0.1" value={formData.gestante_imc_deseado} onChange={(e) => syncReq({ gestante_imc_deseado: e.target.value })} /></div>
                        {(formData.formula_requerimiento || "schofield") !== "rango_calorico" && (
                          <div className="space-y-1">
                            <Label>Actividad (PAL)</Label>
                            <Select value={formData.gestante_pal || "1.53"} onValueChange={(v) => syncReq({ gestante_pal: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1.53">Sedentario (1.53)</SelectItem>
                                <SelectItem value="1.76">Moderado (1.76)</SelectItem>
                                <SelectItem value="2.25">Vigoroso (2.25)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Fórmula de requerimiento energético</Label>
                      <Select
                        value={formData.formula_requerimiento || "schofield"}
                        onValueChange={(value) => {
                          const presets: Record<string, string> = {
                            perdida: "22",
                            mantenimiento: "25",
                            ganancia: "32",
                          };
                          const nextRango =
                            value === "rango_calorico"
                              ? (formData.rango_kcal_kg || presets[formData.rango_objetivo || "mantenimiento"] || "25")
                              : formData.rango_kcal_kg;
                          syncReq({
                            formula_requerimiento: value,
                            rango_kcal_kg: nextRango,
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecciona fórmula" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="schofield">
                            {adoles ? "GET FAO + crecimiento (EVANUT)" : "FAO / Schofield (EVANUT)"}
                          </SelectItem>
                          <SelectItem value="harris_benedict">Harris-Benedict</SelectItem>
                          <SelectItem value="mifflin">Mifflin-St Jeor</SelectItem>
                          <SelectItem value="rango_calorico">Rango calórico (kcal/kg)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {formData.formula_requerimiento === "rango_calorico"
                          ? "Peso de referencia × kcal/kg + extras de gestación"
                          : formData.formula_requerimiento === "harris_benedict"
                            ? adoles
                              ? "TMB Harris-Benedict + crecimiento × actividad + extras"
                              : "TMB Harris-Benedict × PAL + extras de gestación"
                            : formData.formula_requerimiento === "mifflin"
                              ? adoles
                                ? "TMB Mifflin-St Jeor + crecimiento × actividad + extras"
                                : "TMB Mifflin-St Jeor × PAL + extras de gestación"
                              : adoles
                                ? "GET FAO + g crecimiento × actividad + extras (método EVANUT)"
                                : "TMR FAO/Schofield × PAL + extras (método EVANUT)"}
                      </p>
                    </div>
                    {(formData.formula_requerimiento || "schofield") === "rango_calorico" && (
                      <>
                        <div className="space-y-1">
                          <Label>Objetivo (preset kcal/kg)</Label>
                          <Select
                            value={formData.rango_objetivo || "mantenimiento"}
                            onValueChange={(value) => {
                              const map: Record<string, string> = {
                                perdida: "22",
                                mantenimiento: "25",
                                ganancia: "32",
                              };
                              syncReq({
                                rango_objetivo: value,
                                rango_kcal_kg: map[value] || "25",
                              });
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="perdida">Pérdida (~20–25 kcal/kg)</SelectItem>
                              <SelectItem value="mantenimiento">Mantenimiento (~25–30 kcal/kg)</SelectItem>
                              <SelectItem value="ganancia">Ganancia (~30–35 kcal/kg)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>kcal / kg</Label>
                          <Input
                            type="number"
                            step="0.5"
                            min="10"
                            max="50"
                            value={formData.rango_kcal_kg}
                            onChange={(e) => syncReq({ rango_kcal_kg: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Peso ref: {formData.gestante_peso_ref || gAdult?.pesoRef || gAd?.pesoRef || "—"} kg
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {adoles && gAd ? (
                    <>
                      <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div><span className="text-muted-foreground">IMC pregestacional</span><p className="font-medium">{gAd.imcPreg > 0 ? gAd.imcPreg.toFixed(2) : "—"}</p></div>
                        <div><span className="text-muted-foreground">Clasificación Z</span><p className="font-bold">{gAd.zClass || "—"}</p></div>
                        <div><span className="text-muted-foreground">IMC gestacional</span><p className="font-medium">{gAd.imcGest > 0 ? gAd.imcGest.toFixed(2) : "—"}</p></div>
                        <div><span className="text-muted-foreground">Trimestre</span><p className="font-medium">{formData.gestante_semana ? `${gAd.trimestre}°` : "—"}</p></div>
                        <div><span className="text-muted-foreground">Debió ganar</span><p className="font-medium">{gAd.debioGanar > 0 ? `${gAd.debioGanar.toFixed(2)} kg` : "—"}</p></div>
                        <div><span className="text-muted-foreground">Ganancia presentada</span><p className="font-medium">{formData.gestante_peso_actual ? `${gAd.gananciaPresentada.toFixed(2)} kg` : "—"}</p></div>
                        <div><span className="text-muted-foreground">Esperada total</span><p className="font-medium">{gAd.totalEsperado > 0 ? `${gAd.totalEsperado.toFixed(1)} kg` : "—"}</p></div>
                        <div><span className="text-muted-foreground">Ganancia diaria sugerida</span><p className="font-medium">{gAd.gananciaSugerida} g</p></div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        {(formData.formula_requerimiento || "schofield") === "rango_calorico" ? (
                          <div><span className="text-muted-foreground">Peso × kcal/kg</span><p className="font-medium">{gAd.reqBase > 0 ? Math.round(gAd.reqBase) : "—"} kcal</p></div>
                        ) : (formData.formula_requerimiento === "harris_benedict" || formData.formula_requerimiento === "mifflin") ? (
                          <>
                            <div><span className="text-muted-foreground">
                              {formData.formula_requerimiento === "mifflin" ? "TMB Mifflin-St Jeor" : "TMB Harris-Benedict"}
                            </span><p className="font-medium">{gAd.tmr > 0 ? Math.round(gAd.tmr) : "—"} kcal</p></div>
                            <div><span className="text-muted-foreground">Base (+ crec. × act.)</span><p className="font-medium">{gAd.reqBase > 0 ? Math.round(gAd.reqBase) : "—"} kcal</p></div>
                          </>
                        ) : (
                          <>
                            <div><span className="text-muted-foreground">GET FAO</span><p className="font-medium">{gAd.get > 0 ? Math.round(gAd.get) : "—"} kcal</p></div>
                            <div><span className="text-muted-foreground">Base (+ crec. × act.)</span><p className="font-medium">{gAd.reqBase > 0 ? Math.round(gAd.reqBase) : "—"} kcal</p></div>
                          </>
                        )}
                        <div><span className="text-muted-foreground">+ Gestación ({gAd.trimestre}°)</span><p className="font-medium">{gAd.extra} kcal</p></div>
                        <div><span className="text-muted-foreground">Total</span><p className="font-bold text-lg text-primary">{Math.round(gAd.requerimientoFinal)} kcal</p></div>
                        <div className="sm:col-span-2"><span className="text-muted-foreground">Método · RIEN</span><p className="font-medium">{gAd.metodoLabel} · {gAd.rien.proteinas_kg} g prot/kg · grasa {gAd.rien.grasas_amdr}%</p></div>
                      </div>
                    </>
                  ) : gAdult ? (
                    <>
                      <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div><span className="text-muted-foreground">IMC pregestacional</span><p className="font-medium">{gAdult.imcPreg > 0 ? gAdult.imcPreg.toFixed(2) : "—"}</p></div>
                        <div><span className="text-muted-foreground">Clasificación Atalah</span><p className="font-bold">{gAdult.atalah || "—"}</p></div>
                        <div><span className="text-muted-foreground">IMC gestacional</span><p className="font-medium">{gAdult.imcGest > 0 ? gAdult.imcGest.toFixed(2) : "—"}</p></div>
                        <div><span className="text-muted-foreground">Trimestre</span><p className="font-medium">{formData.gestante_semana ? `${gAdult.trimestre}°` : "—"}</p></div>
                        <div><span className="text-muted-foreground">Debió ganar</span><p className="font-medium">{gAdult.debioGanar > 0 ? `${gAdult.debioGanar.toFixed(2)} kg` : "—"}</p></div>
                        <div><span className="text-muted-foreground">Ganancia presentada</span><p className="font-medium">{formData.gestante_peso_actual ? `${gAdult.gananciaPresentada.toFixed(2)} kg` : "—"}</p></div>
                        <div><span className="text-muted-foreground">Esperada total</span><p className="font-medium">{gAdult.totalEsperado > 0 ? `${gAdult.totalEsperado.toFixed(1)} kg` : "—"}</p></div>
                        <div><span className="text-muted-foreground">Dif. ganancia</span><p className="font-medium">{formData.gestante_peso_actual && gAdult.debioGanar ? `${(gAdult.gananciaPresentada - gAdult.debioGanar).toFixed(2)} kg` : "—"}</p></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Extras normopeso (fila Excel)</Label>
                          <Select value={formData.gestante_extra_normal_variant || "a"} onValueChange={(v) => syncReq({ gestante_extra_normal_variant: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="a">85 / 285 / 475 kcal</SelectItem>
                              <SelectItem value="b">— / 360 / 475 kcal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        {(formData.formula_requerimiento || "schofield") === "rango_calorico" ? (
                          <div><span className="text-muted-foreground">Peso × kcal/kg</span><p className="font-medium">{gAdult.reqBase > 0 ? Math.round(gAdult.reqBase) : "—"} kcal</p></div>
                        ) : (
                          <>
                            <div>
                              <span className="text-muted-foreground">
                                {formData.formula_requerimiento === "harris_benedict"
                                  ? "TMB Harris-Benedict"
                                  : formData.formula_requerimiento === "mifflin"
                                    ? "TMB Mifflin-St Jeor"
                                    : "TMR (Schofield)"}
                              </span>
                              <p className="font-medium">{gAdult.tmr > 0 ? Math.round(gAdult.tmr) : "—"} kcal</p>
                            </div>
                            <div><span className="text-muted-foreground">× PAL</span><p className="font-medium">{gAdult.reqBase > 0 ? Math.round(gAdult.reqBase) : "—"} kcal</p></div>
                          </>
                        )}
                        <div><span className="text-muted-foreground">+ Gestación ({gAdult.trimestre}° trim)</span><p className="font-medium">{gAdult.extra} kcal</p></div>
                        <div><span className="text-muted-foreground">Total</span><p className="font-bold text-lg text-primary">{Math.round(gAdult.requerimientoFinal)} kcal</p></div>
                        <div className="sm:col-span-2"><span className="text-muted-foreground">Método · RIEN</span><p className="font-medium">{gAdult.metodoLabel} · {gAdult.rien.proteinas_kg} g prot/kg · grasa {gAdult.rien.grasas_amdr}% · fibra {gAdult.rien.fibra_g}g</p></div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Antropometría braquial (opcional)</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="space-y-1"><Label>Perímetro brazo (mm)</Label><Input type="number" step="0.1" value={formData.gestante_perim_brazo_mm} onChange={(e) => handleChange("gestante_perim_brazo_mm", e.target.value)} /></div>
                          <div className="space-y-1"><Label>Pliegue tricipital (mm)</Label><Input type="number" step="0.1" value={formData.gestante_pliegue_tricipital_mm} onChange={(e) => handleChange("gestante_pliegue_tricipital_mm", e.target.value)} /></div>
                          <div className="space-y-1"><Label>Pliegue subescapular (mm)</Label><Input type="number" step="0.1" value={formData.gestante_pliegue_subescapular_mm} onChange={(e) => handleChange("gestante_pliegue_subescapular_mm", e.target.value)} /></div>
                        </div>
                        <div className="mt-3 rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          <div><span className="text-muted-foreground">PMB</span><p className="font-medium">{gAdult.perimMuscularBrazo > 0 ? gAdult.perimMuscularBrazo.toFixed(1) : "—"}</p></div>
                          <div><span className="text-muted-foreground">AMB</span><p className="font-medium">{gAdult.areaMuscularBrazo > 0 ? gAdult.areaMuscularBrazo.toFixed(1) : "—"}</p></div>
                          <div><span className="text-muted-foreground">AGB</span><p className="font-medium">{gAdult.areaGrasaBrazo > 0 ? gAdult.areaGrasaBrazo.toFixed(1) : "—"}</p></div>
                          <div><span className="text-muted-foreground">Adiposidad</span><p className="font-medium">{gAdult.adiposidad > 0 ? gAdult.adiposidad.toFixed(1) : "—"}</p></div>
                        </div>
                      </div>
                    </>
                  ) : null}

                  {renderAjusteCaloriasUI()}
                  <div className="space-y-1 max-w-xs">
                    <Label>Calorías del plan (editables)</Label>
                    <Input
                      type="number"
                      value={formData.requerimiento_energetico}
                      onChange={(e) => {
                        handleChange("requerimiento_energetico", e.target.value);
                        handleChange("total_calorias_f2", e.target.value);
                      }}
                    />
                    <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => syncReq({})}>
                      Recalcular según fórmula seleccionada + extras gestación
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Phase 1 Hospitalizado */}
          {currentPhase === 1 && isHospitalizado(formData.tipo_plan) && (() => {
            const h = calculateHospitalizadoEnergia(formData);
            const formula = formData.formula_requerimiento || "harris_benedict";
            const isRango = formula === "rango_calorico";
            const isIreton = formula === "ireton_jones";
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Evaluación y requerimiento hospitalizado
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    TMB × factor de actividad × factor de estrés, Ireton-Jones o kcal/kg + líquidos (EVANUT Hospitalizado)
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                    <div className="space-y-1 min-w-[200px]">
                      <Label>Paciente (cargar desde BD)</Label>
                      <Select
                        value={formData.patient_id ? String(formData.patient_id) : undefined}
                        onValueChange={(v) => handleChange("patient_id", v === "" ? "" : Number(v))}
                        disabled={loadingPatientsList}
                      >
                        <SelectTrigger><SelectValue placeholder={loadingPatientsList ? "Cargando..." : "Selecciona un paciente"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" disabled>Selecciona un paciente</SelectItem>
                          {patientsList.map((pat) => (
                            <SelectItem key={pat.id} value={String(pat.id)}>{pat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={loadingPatient || !formData.patient_id}
                      onClick={() => formData.patient_id && fetchPatientAndPrefillHospitalizado(Number(formData.patient_id))}
                    >
                      {loadingPatient ? "Cargando..." : "Cargar datos del paciente"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label>Peso actual (kg)</Label>
                      <Input type="number" step="0.1" value={formData.peso_actual}
                        onChange={(e) => recalculateHospitalizadoRequirement({ peso_actual: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Altura (cm)</Label>
                      <Input type="number" step="0.1" value={formData.altura}
                        onChange={(e) => recalculateHospitalizadoRequirement({ altura: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Edad (años)</Label>
                      <Input type="number" value={formData.edad}
                        onChange={(e) => recalculateHospitalizadoRequirement({ edad: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Sexo</Label>
                      <Select value={formData.genero || undefined}
                        onValueChange={(v) => recalculateHospitalizadoRequirement({ genero: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="masculino">Masculino</SelectItem>
                          <SelectItem value="femenino">Femenino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Peso ref (kg)</Label>
                      <Input type="number" step="0.1" value={formData.peso_referencia_f2}
                        onChange={(e) => recalculateHospitalizadoRequirement({ peso_referencia_f2: e.target.value })} />
                      {h.reglaPeso && (
                        <p className="text-xs text-muted-foreground">{h.reglaPeso}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Líquidos (cc/kg/día)</Label>
                      <Input type="number" step="1" min="20" max="60" value={formData.hosp_liquidos_cc_kg}
                        onChange={(e) => recalculateHospitalizadoRequirement({ hosp_liquidos_cc_kg: e.target.value })} />
                      <p className="text-xs text-muted-foreground">Ideal 30–40 cc/kg</p>
                    </div>
                  </div>

                  <div className="space-y-3 p-3 rounded-lg border border-dashed">
                    <div>
                      <h4 className="font-semibold text-sm">Estimación antropométrica Chumlea (opcional)</h4>
                      <p className="text-xs text-muted-foreground">
                        Talla (1985) y peso no ambulante (1988). Usa talón-rodilla, brazo, pantorrilla y pliegue subescapular.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label>Talón-rodilla (cm)</Label>
                        <Input type="number" step="0.1" value={formData.hosp_talon_rodilla_cm}
                          onChange={(e) => recalculateHospitalizadoRequirement({ hosp_talon_rodilla_cm: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Perímetro brazo (cm)</Label>
                        <Input type="number" step="0.1" value={formData.hosp_perim_brazo_cm}
                          onChange={(e) => recalculateHospitalizadoRequirement({ hosp_perim_brazo_cm: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Perímetro pantorrilla (cm)</Label>
                        <Input type="number" step="0.1" value={formData.hosp_perim_pantorrilla_cm}
                          onChange={(e) => recalculateHospitalizadoRequirement({ hosp_perim_pantorrilla_cm: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Pliegue subescapular (mm)</Label>
                        <Input type="number" step="0.1" value={formData.hosp_pliegue_subescapular_mm}
                          onChange={(e) => recalculateHospitalizadoRequirement({ hosp_pliegue_subescapular_mm: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span>Talla est.: <strong>{h.tallaEstimada > 0 ? `${h.tallaEstimada.toFixed(1)} cm` : "—"}</strong></span>
                      <span>Peso est.: <strong>{h.pesoEstimado > 0 ? `${h.pesoEstimado.toFixed(1)} kg` : "—"}</strong></span>
                      {h.pesoEstimado > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            recalculateHospitalizadoRequirement({
                              peso_actual: h.pesoEstimado.toFixed(1),
                              peso_referencia_f2: h.pesoEstimado.toFixed(1),
                              ...(h.tallaEstimada > 0 && !(parseFloat(formData.altura) > 0)
                                ? { altura: h.tallaEstimada.toFixed(1) }
                                : {}),
                            })
                          }
                        >
                          Usar peso/talla estimados
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div><span className="text-muted-foreground">IMC</span><p className="font-medium">{h.imc > 0 ? h.imc.toFixed(2) : "—"}</p></div>
                    <div><span className="text-muted-foreground">Peso saludable</span><p className="font-medium">{h.pesoSaludable > 0 ? h.pesoSaludable.toFixed(1) : "—"} kg</p></div>
                    <div><span className="text-muted-foreground">Peso ajustado</span><p className="font-medium">{h.pesoAjustado > 0 ? h.pesoAjustado.toFixed(1) : "—"} kg</p></div>
                    <div><span className="text-muted-foreground">Peso Chumlea</span><p className="font-medium">{h.pesoEstimado > 0 ? h.pesoEstimado.toFixed(1) : "—"} kg</p></div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Fórmula de requerimiento energético</Label>
                      <Select
                        value={formula}
                        onValueChange={(value) => {
                          const presets: Record<string, string> = {
                            perdida: "22",
                            mantenimiento: "25",
                            ganancia: "32",
                          };
                          const nextRango =
                            value === "rango_calorico"
                              ? (formData.rango_kcal_kg || presets[formData.rango_objetivo || "mantenimiento"] || "25")
                              : formData.rango_kcal_kg;
                          recalculateHospitalizadoRequirement({
                            formula_requerimiento: value,
                            rango_kcal_kg: nextRango,
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="harris_benedict">Harris-Benedict (EVANUT)</SelectItem>
                          <SelectItem value="mifflin">Mifflin-St Jeor</SelectItem>
                          <SelectItem value="ireton_jones">Ireton-Jones</SelectItem>
                          <SelectItem value="rango_calorico">Método del pulgar (kcal/kg)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {isRango
                          ? "Método del pulgar EVANUT: peso de referencia × kcal/kg/día"
                          : isIreton
                            ? "EEE Ireton-Jones × FA × FE (coloca FA/FE; suele usarse 1.0 si el EEE ya incluye estrés)"
                            : "TMB × factor de actividad × factor de estrés (obligatorio EVANUT)"}
                      </p>
                    </div>

                    {isRango ? (
                      <>
                        <div className="space-y-1">
                          <Label>Objetivo (preset kcal/kg)</Label>
                          <Select
                            value={formData.rango_objetivo || "mantenimiento"}
                            onValueChange={(value) => {
                              const map: Record<string, string> = {
                                perdida: "22",
                                mantenimiento: "25",
                                ganancia: "32",
                              };
                              recalculateHospitalizadoRequirement({
                                rango_objetivo: value,
                                rango_kcal_kg: map[value] || "25",
                              });
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="perdida">Pérdida (~20–25)</SelectItem>
                              <SelectItem value="mantenimiento">Mantenimiento (~25–30)</SelectItem>
                              <SelectItem value="ganancia">Ganancia (~30–35)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>kcal / kg</Label>
                          <Input type="number" step="0.5" value={formData.rango_kcal_kg}
                            onChange={(e) => recalculateHospitalizadoRequirement({ rango_kcal_kg: e.target.value })} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <Label>Factor de actividad</Label>
                          <Select
                            value={formData.hosp_actividad_preset || "cama"}
                            onValueChange={(value) => {
                              const preset = HOSP_ACTIVIDAD_PRESETS.find((p) => p.value === value);
                              recalculateHospitalizadoRequirement({
                                hosp_actividad_preset: value,
                                hosp_factor_actividad: preset?.factor || "1.15",
                              });
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {HOSP_ACTIVIDAD_PRESETS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input type="number" step="0.01" className="mt-1" value={formData.hosp_factor_actividad}
                            onChange={(e) => recalculateHospitalizadoRequirement({ hosp_factor_actividad: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label>Factor de estrés</Label>
                          <Select
                            value={formData.hosp_estres_preset || "ninguno"}
                            onValueChange={(value) => {
                              const preset = HOSP_ESTRES_PRESETS.find((p) => p.value === value);
                              recalculateHospitalizadoRequirement({
                                hosp_estres_preset: value,
                                hosp_factor_estres: preset?.factor || "1.0",
                              });
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {HOSP_ESTRES_PRESETS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input type="number" step="0.01" className="mt-1" value={formData.hosp_factor_estres}
                            onChange={(e) => recalculateHospitalizadoRequirement({ hosp_factor_estres: e.target.value })} />
                        </div>
                      </>
                    )}
                  </div>

                  {isIreton && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                      <div className="space-y-1">
                        <Label>Soporte ventilatorio</Label>
                        <Select value={formData.hosp_ventilatorio || "no"}
                          onValueChange={(v) => recalculateHospitalizadoRequirement({ hosp_ventilatorio: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="si">Sí</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Obesidad</Label>
                        <Select value={formData.hosp_obesidad || "no"}
                          onValueChange={(v) => recalculateHospitalizadoRequirement({ hosp_obesidad: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="si">Sí</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Trauma</Label>
                        <Select value={formData.hosp_trauma || "no"}
                          onValueChange={(v) => recalculateHospitalizadoRequirement({ hosp_trauma: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="si">Sí</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Quemadura</Label>
                        <Select value={formData.hosp_quemadura || "no"}
                          onValueChange={(v) => recalculateHospitalizadoRequirement({ hosp_quemadura: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="si">Sí</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    {!isRango && (
                      <div>
                        <span className="text-muted-foreground">{isIreton ? "EEE Ireton" : "TMB"}</span>
                        <p className="font-medium">{h.tmb > 0 ? Math.round(h.tmb) : "—"} kcal</p>
                      </div>
                    )}
                    {!isRango && (
                      <div>
                        <span className="text-muted-foreground">× FA × FE</span>
                        <p className="font-medium">{h.fa} × {h.fe}</p>
                      </div>
                    )}
                    {isRango && (
                      <div>
                        <span className="text-muted-foreground">Peso × kcal/kg</span>
                        <p className="font-medium">{h.reqBase > 0 ? Math.round(h.reqBase) : "—"} kcal</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Base</span>
                      <p className="font-medium">{h.reqBase > 0 ? Math.round(h.reqBase) : "—"} kcal</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total</span>
                      <p className="font-bold text-lg text-primary">{Math.round(h.requerimientoFinal)} kcal</p>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Método · Líquidos</span>
                      <p className="font-medium">{h.metodoLabel} · {Math.round(h.liquidosMl)} ml/día</p>
                    </div>
                  </div>

                  {/* Nutrición parenteral adulto — hoja EVANUT Hospitalizado */}
                  {(() => {
                    const pn = h.parenteral;
                    return (
                      <div className="space-y-3 p-3 rounded-lg border border-sky-200 bg-sky-50/40 dark:bg-sky-950/20">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold">Nutrición parenteral adulto</h4>
                            <p className="text-xs text-muted-foreground">
                              1) Calorías y líquidos · 2) Macros/micros (guía EVANUT). Lípidos = resto de kcal − (CHO + proteína).
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setFormData((prev: any) => ({
                                ...prev,
                                pn_peso_kg: String(h.pesoRef > 0 ? h.pesoRef.toFixed(1) : prev.pn_peso_kg || ""),
                                pn_calorias: String(Math.round(h.requerimientoFinal) || prev.pn_calorias || ""),
                                pn_liquidos_ml: String(Math.round(h.liquidosMl) || prev.pn_liquidos_ml || ""),
                              }))
                            }
                          >
                            Usar kcal/líquidos del plan
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label>Peso del paciente (kg)</Label>
                            <Input type="number" step="0.1" value={formData.pn_peso_kg}
                              onChange={(e) => handleChange("pn_peso_kg", e.target.value)}
                              placeholder={h.pesoRef > 0 ? String(h.pesoRef.toFixed(1)) : ""} />
                          </div>
                          <div className="space-y-1">
                            <Label>Calorías totales</Label>
                            <Input type="number" value={formData.pn_calorias}
                              onChange={(e) => handleChange("pn_calorias", e.target.value)}
                              placeholder={h.requerimientoFinal > 0 ? String(Math.round(h.requerimientoFinal)) : ""} />
                          </div>
                          <div className="space-y-1">
                            <Label>Líquidos totales (ml)</Label>
                            <Input type="number" value={formData.pn_liquidos_ml}
                              onChange={(e) => handleChange("pn_liquidos_ml", e.target.value)}
                              placeholder={h.liquidosMl > 0 ? String(Math.round(h.liquidosMl)) : ""} />
                          </div>
                          <div className="space-y-1">
                            <Label>Proteína (g/kg/día)</Label>
                            <Input type="number" step="0.1" value={formData.pn_prot_gkg}
                              onChange={(e) => handleChange("pn_prot_gkg", e.target.value)} />
                            <p className="text-xs text-muted-foreground">Usual 0.8–1.8</p>
                          </div>
                          <div className="space-y-1">
                            <Label>CHOs (g/kg/día)</Label>
                            <Input type="number" step="0.1" value={formData.pn_cho_gkg}
                              onChange={(e) => handleChange("pn_cho_gkg", e.target.value)} />
                            <p className="text-xs text-muted-foreground">Usual 3.0–7.0</p>
                          </div>
                          <div className="space-y-1">
                            <Label>Sodio (mEq/kg)</Label>
                            <Input type="number" step="0.1" value={formData.pn_na_meq_kg}
                              onChange={(e) => handleChange("pn_na_meq_kg", e.target.value)} />
                            <p className="text-xs text-muted-foreground">Usual 1–2</p>
                          </div>
                          <div className="space-y-1">
                            <Label>Potasio (mEq/kg)</Label>
                            <Input type="number" step="0.1" value={formData.pn_k_meq_kg}
                              onChange={(e) => handleChange("pn_k_meq_kg", e.target.value)} />
                            <p className="text-xs text-muted-foreground">Usual 1–2</p>
                          </div>
                          <div className="space-y-1">
                            <Label>Calcio (mEq/día)</Label>
                            <Input type="number" step="1" value={formData.pn_ca_meq_dia}
                              onChange={(e) => handleChange("pn_ca_meq_dia", e.target.value)} />
                            <p className="text-xs text-muted-foreground">Usual 10–15</p>
                          </div>
                          <div className="space-y-1">
                            <Label>Fósforo (mMol/día)</Label>
                            <Input type="number" step="1" value={formData.pn_p_mmol_dia}
                              onChange={(e) => handleChange("pn_p_mmol_dia", e.target.value)} />
                          </div>
                        </div>
                        <div className="rounded-md border bg-background/80 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          <div><span className="text-muted-foreground">Proteína</span><p className="font-medium">{pn.protG > 0 ? `${pn.protG.toFixed(1)} g (${Math.round(pn.protKcal)} kcal)` : "—"}</p></div>
                          <div><span className="text-muted-foreground">CHOs</span><p className="font-medium">{pn.choG > 0 ? `${pn.choG.toFixed(1)} g (${Math.round(pn.choKcal)} kcal)` : "—"}</p></div>
                          <div><span className="text-muted-foreground">Lípidos (resto)</span><p className="font-medium">{pn.lipG > 0 ? `${pn.lipG.toFixed(1)} g · ${pn.lipGkg.toFixed(2)} g/kg` : "—"}</p></div>
                          <div><span className="text-muted-foreground">Flujo metabólico</span><p className="font-medium">{pn.flujoMgKgMin > 0 ? `${pn.flujoMgKgMin.toFixed(2)} mg/kg/min` : "—"}</p></div>
                          <div><span className="text-muted-foreground">Na total</span><p className="font-medium">{pn.naTotal > 0 ? `${pn.naTotal.toFixed(0)} mEq` : "—"}</p></div>
                          <div><span className="text-muted-foreground">K total</span><p className="font-medium">{pn.kTotal > 0 ? `${pn.kTotal.toFixed(0)} mEq` : "—"}</p></div>
                          <div><span className="text-muted-foreground">Ca</span><p className="font-medium">{pn.caMeqDia > 0 ? `${pn.caMeqDia} mEq/día` : "—"}</p></div>
                          <div><span className="text-muted-foreground">P</span><p className="font-medium">{pn.pMmolDia > 0 ? `${pn.pMmolDia} mMol/día` : "—"}</p></div>
                          <div className="sm:col-span-2 text-xs text-muted-foreground">
                            Guía lípidos EVANUT: estable 0.7–1.3 g/kg · alta demanda 1.5–2.5 g/kg
                            {pn.lipGkg > 0 ? ` · actual ${pn.lipGkg.toFixed(2)} g/kg` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {renderAjusteCaloriasUI()}
                  <div className="space-y-1 max-w-xs">
                    <Label>Calorías del plan (editables)</Label>
                    <Input
                      type="number"
                      value={formData.requerimiento_energetico}
                      onChange={(e) => {
                        handleChange("requerimiento_energetico", e.target.value);
                        handleChange("total_calorias_f2", e.target.value);
                      }}
                    />
                    <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => recalculateHospitalizadoRequirement({})}>
                      Recalcular según fórmula hospitalaria + FA × FE
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Phase 1 Geriátrico: evaluación y requerimiento del adulto mayor */}
          {currentPhase === 1 && isGeriatrico(formData.tipo_plan) && (() => {
            const g = calculateGeriatricoEnergia(formData);
            const formula = formData.formula_requerimiento || "harris_benedict";
            const isRango = formula === "rango_calorico";
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Evaluación y requerimiento geriátrico
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    TMB × factor de actividad × factor de estrés + estimación Chumlea, IMC del adulto mayor y riesgo de sarcopenia
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                    <div className="space-y-1 min-w-[200px]">
                      <Label>Paciente (cargar desde BD)</Label>
                      <Select
                        value={formData.patient_id ? String(formData.patient_id) : undefined}
                        onValueChange={(v) => handleChange("patient_id", v === "" ? "" : Number(v))}
                        disabled={loadingPatientsList}
                      >
                        <SelectTrigger><SelectValue placeholder={loadingPatientsList ? "Cargando..." : "Selecciona un paciente"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" disabled>Selecciona un paciente</SelectItem>
                          {patientsList.map((pat) => (
                            <SelectItem key={pat.id} value={String(pat.id)}>{pat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={loadingPatient || !formData.patient_id}
                      onClick={() => formData.patient_id && fetchPatientAndPrefillGeriatrico(Number(formData.patient_id))}
                    >
                      {loadingPatient ? "Cargando..." : "Cargar datos del paciente"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label>Peso actual (kg)</Label>
                      <Input type="number" step="0.1" value={formData.peso_actual}
                        onChange={(e) => recalculateGeriatricoRequirement({ peso_actual: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Altura (cm)</Label>
                      <Input type="number" step="0.1" value={formData.altura}
                        onChange={(e) => recalculateGeriatricoRequirement({ altura: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Edad (años)</Label>
                      <Input type="number" value={formData.edad}
                        onChange={(e) => recalculateGeriatricoRequirement({ edad: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Sexo</Label>
                      <Select value={formData.genero || undefined}
                        onValueChange={(v) => recalculateGeriatricoRequirement({ genero: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="masculino">Masculino</SelectItem>
                          <SelectItem value="femenino">Femenino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Peso ref (kg)</Label>
                      <Input type="number" step="0.1" value={formData.peso_referencia_f2}
                        onChange={(e) => recalculateGeriatricoRequirement({ peso_referencia_f2: e.target.value })} />
                      {g.reglaPeso && (
                        <p className="text-xs text-muted-foreground">{g.reglaPeso}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Líquidos (cc/kg/día)</Label>
                      <Input type="number" step="1" min="20" max="45" value={formData.ger_liquidos_cc_kg}
                        onChange={(e) => recalculateGeriatricoRequirement({ ger_liquidos_cc_kg: e.target.value })} />
                      <p className="text-xs text-muted-foreground">Adulto mayor ~30 cc/kg</p>
                    </div>
                  </div>

                  <div className="space-y-3 p-3 rounded-lg border border-dashed">
                    <div>
                      <h4 className="font-semibold text-sm">Estimación antropométrica Chumlea (opcional)</h4>
                      <p className="text-xs text-muted-foreground">
                        Útil cuando el adulto mayor no puede pararse o pesarse. Talla (1985) y peso no ambulante (1988).
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label>Talón-rodilla (cm)</Label>
                        <Input type="number" step="0.1" value={formData.ger_talon_rodilla_cm}
                          onChange={(e) => recalculateGeriatricoRequirement({ ger_talon_rodilla_cm: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Perímetro brazo (cm)</Label>
                        <Input type="number" step="0.1" value={formData.ger_perim_brazo_cm}
                          onChange={(e) => recalculateGeriatricoRequirement({ ger_perim_brazo_cm: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Perímetro pantorrilla (cm)</Label>
                        <Input type="number" step="0.1" value={formData.ger_perim_pantorrilla_cm}
                          onChange={(e) => recalculateGeriatricoRequirement({ ger_perim_pantorrilla_cm: e.target.value })} />
                        <p className="text-xs text-muted-foreground">Sarcopenia si &lt; 31 cm</p>
                      </div>
                      <div className="space-y-1">
                        <Label>Pliegue subescapular (mm)</Label>
                        <Input type="number" step="0.1" value={formData.ger_pliegue_subescapular_mm}
                          onChange={(e) => recalculateGeriatricoRequirement({ ger_pliegue_subescapular_mm: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span>Talla est.: <strong>{g.tallaEstimada > 0 ? `${g.tallaEstimada.toFixed(1)} cm` : "—"}</strong></span>
                      <span>Peso est.: <strong>{g.pesoEstimado > 0 ? `${g.pesoEstimado.toFixed(1)} kg` : "—"}</strong></span>
                      {g.pesoEstimado > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            recalculateGeriatricoRequirement({
                              peso_actual: g.pesoEstimado.toFixed(1),
                              peso_referencia_f2: g.pesoEstimado.toFixed(1),
                              ...(g.tallaEstimada > 0 && !(parseFloat(formData.altura) > 0)
                                ? { altura: g.tallaEstimada.toFixed(1) }
                                : {}),
                            })
                          }
                        >
                          Usar peso/talla estimados
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div><span className="text-muted-foreground">IMC</span><p className="font-medium">{g.imc > 0 ? g.imc.toFixed(2) : "—"}</p></div>
                    <div><span className="text-muted-foreground">Peso saludable (IMC 24.5)</span><p className="font-medium">{g.pesoSaludable > 0 ? g.pesoSaludable.toFixed(1) : "—"} kg</p></div>
                    <div><span className="text-muted-foreground">Peso ajustado</span><p className="font-medium">{g.pesoAjustado > 0 ? g.pesoAjustado.toFixed(1) : "—"} kg</p></div>
                    <div><span className="text-muted-foreground">Peso Chumlea</span><p className="font-medium">{g.pesoEstimado > 0 ? g.pesoEstimado.toFixed(1) : "—"} kg</p></div>
                    {g.clasificacionImc && (
                      <div className="sm:col-span-2"><span className="text-muted-foreground">Clasificación IMC</span><p className="font-medium">{g.clasificacionImc}</p></div>
                    )}
                    {g.riesgoSarcopenia && (
                      <div className="sm:col-span-2"><span className="text-muted-foreground">Sarcopenia</span><p className="font-medium">{g.riesgoSarcopenia}</p></div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Fórmula de requerimiento energético</Label>
                      <Select
                        value={formula}
                        onValueChange={(value) => {
                          const presets: Record<string, string> = {
                            perdida: "22",
                            mantenimiento: "27",
                            ganancia: "32",
                          };
                          const nextRango =
                            value === "rango_calorico"
                              ? (formData.rango_kcal_kg || presets[formData.rango_objetivo || "mantenimiento"] || "27")
                              : formData.rango_kcal_kg;
                          recalculateGeriatricoRequirement({
                            formula_requerimiento: value,
                            rango_kcal_kg: nextRango,
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="harris_benedict">Harris-Benedict</SelectItem>
                          <SelectItem value="mifflin">Mifflin-St Jeor</SelectItem>
                          <SelectItem value="schofield">FAO / Schofield</SelectItem>
                          <SelectItem value="rango_calorico">Método del pulgar (kcal/kg)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {isRango
                          ? "Método del pulgar: peso de referencia × kcal/kg/día"
                          : "TMB × factor de actividad × factor de estrés"}
                      </p>
                    </div>

                    {isRango ? (
                      <>
                        <div className="space-y-1">
                          <Label>Objetivo (preset kcal/kg)</Label>
                          <Select
                            value={formData.rango_objetivo || "mantenimiento"}
                            onValueChange={(value) => {
                              const map: Record<string, string> = {
                                perdida: "22",
                                mantenimiento: "27",
                                ganancia: "32",
                              };
                              recalculateGeriatricoRequirement({
                                rango_objetivo: value,
                                rango_kcal_kg: map[value] || "27",
                              });
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="perdida">Pérdida (~20–25)</SelectItem>
                              <SelectItem value="mantenimiento">Mantenimiento (~25–30)</SelectItem>
                              <SelectItem value="ganancia">Ganancia (~30–35)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>kcal / kg</Label>
                          <Input type="number" step="0.5" value={formData.rango_kcal_kg}
                            onChange={(e) => recalculateGeriatricoRequirement({ rango_kcal_kg: e.target.value })} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <Label>Factor de actividad</Label>
                          <Select
                            value={formData.ger_actividad_preset || "sedentario"}
                            onValueChange={(value) => {
                              const preset = GER_ACTIVIDAD_PRESETS.find((p) => p.value === value);
                              recalculateGeriatricoRequirement({
                                ger_actividad_preset: value,
                                ger_factor_actividad: preset?.factor || "1.3",
                              });
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {GER_ACTIVIDAD_PRESETS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input type="number" step="0.01" className="mt-1" value={formData.ger_factor_actividad}
                            onChange={(e) => recalculateGeriatricoRequirement({ ger_factor_actividad: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label>Factor de estrés</Label>
                          <Select
                            value={formData.ger_estres_preset || "ninguno"}
                            onValueChange={(value) => {
                              const preset = GER_ESTRES_PRESETS.find((p) => p.value === value);
                              recalculateGeriatricoRequirement({
                                ger_estres_preset: value,
                                ger_factor_estres: preset?.factor || "1.0",
                              });
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {GER_ESTRES_PRESETS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input type="number" step="0.01" className="mt-1" value={formData.ger_factor_estres}
                            onChange={(e) => recalculateGeriatricoRequirement({ ger_factor_estres: e.target.value })} />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    {!isRango && (
                      <div>
                        <span className="text-muted-foreground">TMB</span>
                        <p className="font-medium">{g.tmb > 0 ? Math.round(g.tmb) : "—"} kcal</p>
                      </div>
                    )}
                    {!isRango && (
                      <div>
                        <span className="text-muted-foreground">× FA × FE</span>
                        <p className="font-medium">{g.fa} × {g.fe}</p>
                      </div>
                    )}
                    {isRango && (
                      <div>
                        <span className="text-muted-foreground">Peso × kcal/kg</span>
                        <p className="font-medium">{g.reqBase > 0 ? Math.round(g.reqBase) : "—"} kcal</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Base</span>
                      <p className="font-medium">{g.reqBase > 0 ? Math.round(g.reqBase) : "—"} kcal</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total</span>
                      <p className="font-bold text-lg text-primary">{Math.round(g.requerimientoFinal)} kcal</p>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Método · Líquidos</span>
                      <p className="font-medium">{g.metodoLabel} · {Math.round(g.liquidosMl)} ml/día</p>
                    </div>
                  </div>

                  {renderAjusteCaloriasUI()}
                  <div className="space-y-1 max-w-xs">
                    <Label>Calorías del plan (editables)</Label>
                    <Input
                      type="number"
                      value={formData.requerimiento_energetico}
                      onChange={(e) => {
                        handleChange("requerimiento_energetico", e.target.value);
                        handleChange("total_calorias_f2", e.target.value);
                      }}
                    />
                    <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => recalculateGeriatricoRequirement({})}>
                      Recalcular según fórmula geriátrica + FA × FE
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Phase 1: Requerimiento Energético y Peso Saludable (adulto y otros) */}
          {currentPhase === 1 && formData.tipo_plan !== "deportista" && formData.tipo_plan !== "pediatria" && !isGestanteTipo(formData.tipo_plan) && !isHospitalizado(formData.tipo_plan) && !isGeriatrico(formData.tipo_plan) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  {phaseTitle}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{phaseDescription}</p>
              </CardHeader>
              <CardContent className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="peso_actual">Peso Actual (kg)</Label>
                    <Input
                      id="peso_actual"
                      type="number"
                      step="0.1"
                      value={formData.peso_actual}
                      readOnly
                      className="bg-muted"
                      onChange={(e) => {
                        handleChange("peso_actual", e.target.value);
                        calculateIMC(e.target.value, formData.altura);
                        // Cuando cambia el peso actual, recalculamos PS y PA
                        calculatePesoSaludable(formData.altura, formData.imc, e.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="altura">Altura (cm)</Label>
                    <Input
                      id="altura"
                      type="number"
                      step="0.1"
                      value={formData.altura}
                      readOnly
                      className="bg-muted"
                      onChange={(e) => {
                        handleChange("altura", e.target.value);
                        calculateIMC(formData.peso_actual, e.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edad">Edad</Label>
                    <Input
                      id="edad"
                      type="number"
                      value={formData.edad}
                      readOnly
                      className="bg-muted"
                      onChange={(e) => {
                        handleChange("edad", e.target.value);
                        calculateTMB(formData.peso_objetivo, e.target.value, formData.genero);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="genero">Género</Label>
                    <Select value={formData.genero || undefined} disabled onValueChange={(value) => {
                      handleChange("genero", value);
                      // Usar peso de referencia (objetivo) para TMB
                      calculateTMB(formData.peso_referencia_f2, formData.edad, value);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="femenino">Femenino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Fórmula de requerimiento energético</Label>
                    <Select
                      value={formData.formula_requerimiento || "schofield"}
                      onValueChange={(value) => {
                        const presets: Record<string, string> = {
                          perdida: "22",
                          mantenimiento: "25",
                          ganancia: "32",
                        };
                        const nextRango =
                          value === "rango_calorico"
                            ? (formData.rango_kcal_kg || presets[formData.rango_objetivo || "mantenimiento"] || "25")
                            : formData.rango_kcal_kg;
                        recalculateAdultRequirement({
                          formula_requerimiento: value,
                          rango_kcal_kg: nextRango,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona fórmula" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="schofield">FAO / Schofield (EVANUT)</SelectItem>
                        <SelectItem value="harris_benedict">Harris-Benedict</SelectItem>
                        <SelectItem value="mifflin">Mifflin-St Jeor</SelectItem>
                        <SelectItem value="rango_calorico">Rango calórico (kcal/kg)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {formData.formula_requerimiento === "rango_calorico"
                        ? "Peso de referencia × kcal/kg según objetivo clínico"
                        : formData.formula_requerimiento === "harris_benedict"
                          ? "TMB Harris-Benedict × factor PAL"
                          : formData.formula_requerimiento === "mifflin"
                            ? "TMB Mifflin-St Jeor × factor PAL"
                            : "TMR FAO/Schofield × factor PAL (método EVANUT)"}
                    </p>
                  </div>

                  {formulaIsRango() ? (
                    <>
                      <div className="space-y-2">
                        <Label>Objetivo (preset kcal/kg)</Label>
                        <Select
                          value={formData.rango_objetivo || "mantenimiento"}
                          onValueChange={(value) => {
                            const map: Record<string, string> = {
                              perdida: "22",
                              mantenimiento: "25",
                              ganancia: "32",
                            };
                            recalculateAdultRequirement({
                              rango_objetivo: value,
                              rango_kcal_kg: map[value] || "25",
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="perdida">Pérdida (~20–25 kcal/kg)</SelectItem>
                            <SelectItem value="mantenimiento">Mantenimiento (~25–30 kcal/kg)</SelectItem>
                            <SelectItem value="ganancia">Ganancia (~30–35 kcal/kg)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rango_kcal_kg">kcal / kg</Label>
                        <Input
                          id="rango_kcal_kg"
                          type="number"
                          step="0.5"
                          min="10"
                          max="50"
                          value={formData.rango_kcal_kg}
                          onChange={(e) => recalculateAdultRequirement({ rango_kcal_kg: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Usa peso ref/objetivo:{" "}
                          {formData.peso_referencia_f2 || formData.peso_objetivo || formData.peso_actual || "—"} kg
                        </p>
                      </div>
                    </>
                  ) : (
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="factor_actividad">Factor de Actividad Física PAL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="factor_actividad"
                        type="number"
                        step="0.01"
                        value={formData.factor_actividad}
                        className="w-24"
                        onChange={(e) => {
                          recalculateAdultRequirement({ factor_actividad: e.target.value });
                        }}
                      />
                      <Select
                        value={["1.53", "1.76", "2.25"].includes(String(formData.factor_actividad)) ? String(formData.factor_actividad) : undefined}
                        onValueChange={(value) => {
                          recalculateAdultRequirement({ factor_actividad: value });
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecciona Nivel (Preset)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1.53">Sedentario (1.4 - 1.69) - Valor: 1.53</SelectItem>
                          <SelectItem value="1.76">Moderado (1.7 - 1.99) - Valor: 1.76</SelectItem>
                          <SelectItem value="2.25">Vigoroso (2.0 - 2.4) - Valor: 2.25</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">Escribe un valor manual o selecciona un nivel predefinido.</p>
                  </div>
                  )}
                </div>

                {/* Campos calculados */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="imc">IMC Actual</Label>
                    <Input
                      id="imc"
                      type="number"
                      step="0.01"
                      value={formData.imc}
                      readOnly
                      className="bg-muted font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="peso_saludable">Peso Saludable (IMC 25) (kg)</Label>
                    <Input
                      id="peso_saludable"
                      type="number"
                      step="0.1"
                      value={formData.peso_saludable}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="peso_ajustado">Peso Ajustado (&gt;30 IMC) (kg)</Label>
                    <Input
                      id="peso_ajustado"
                      type="number"
                      step="0.1"
                      value={formData.peso_ajustado}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  {!formulaIsRango() && (
                  <div className="space-y-2">
                    <Label htmlFor="tmb">
                      {formData.formula_requerimiento === "harris_benedict"
                        ? "TMB Harris-Benedict (kcal)"
                        : formData.formula_requerimiento === "mifflin"
                          ? "TMB Mifflin-St Jeor (kcal)"
                          : "TMR FAO/Schofield (kcal)"}
                    </Label>
                    <Input
                      id="tmb"
                      type="number"
                      step="0.1"
                      value={formData.tmb}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="requerimiento_energetico">Requerimiento Total (kcal)</Label>
                    <Input
                      id="requerimiento_energetico"
                      type="number"
                      value={formData.requerimiento_energetico}
                      readOnly
                      className="bg-primary/10 border-primary font-bold text-lg"
                    />
                    {formData.requerimiento_base_f1 && (
                      <p className="text-xs text-muted-foreground">
                        Base calculada: {formData.requerimiento_base_f1} kcal
                        {formulaIsRango()
                          ? ` (${formData.peso_referencia_f2 || formData.peso_objetivo || formData.peso_actual || "—"} kg × ${formData.rango_kcal_kg || "—"} kcal/kg)`
                          : formData.factor_actividad
                            ? ` (TMB × PAL ${formData.factor_actividad})`
                            : ""}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4">{renderAjusteCaloriasUI()}</div>
              </CardContent>
            </Card>
          )}

          {/* Phase 2: Fórmula Sintética de Consumo y Planeada */}
          {currentPhase === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  {phaseTitle}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{phaseDescription}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tabla de Resumen */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-cyan-200 text-black">
                        <th className="border border-cyan-300 p-2 text-center font-semibold">Kcal</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">Prot</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">Grasa</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">GS</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">GM</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">GP</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">COL</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">CHOS</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">Fibra</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-cyan-50">
                        <td className="border border-cyan-200 p-2 text-center font-medium">{formData.total_calorias_f2 || formData.requerimiento_energetico || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center">{formData.proteinas_gramos_f2 || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center">{formData.grasas_gramos_f2 || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center">{formData.grasas_gs_gramos || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center">{formData.grasas_gm_gramos || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center">{formData.grasas_gp_gramos || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center font-medium">
                          {formData.grasas_colesterol ? parseFloat(formData.grasas_colesterol).toFixed(0) : "---"}
                        </td>
                        <td className="border border-cyan-200 p-2 text-center">{formData.cho_gramos_f2 || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center font-medium">
                          {formData.total_fibra ? parseFloat(formData.total_fibra).toFixed(2) : "---"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Tabla Detallada */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-teal-600 text-black">
                        <th className="border border-teal-300 p-2 text-left font-semibold">Nutrientes</th>
                        <th className="border border-teal-300 p-2 text-center font-semibold">Gramos</th>
                        <th className="border border-teal-300 p-2 text-center font-semibold">Calorías</th>
                        <th className="border border-teal-300 p-2 text-center font-semibold">% AMDR</th>
                        <th className="border border-teal-300 p-2 text-center font-semibold" colSpan={2}>Otros</th>
                      </tr>
                      <tr className="bg-teal-50 text-black">
                        <th className="border border-teal-300 p-1"></th>
                        <th className="border border-teal-300 p-1"></th>
                        <th className="border border-teal-300 p-1"></th>
                        <th className="border border-teal-300 p-1"></th>
                        <th className="border border-teal-300 p-1 text-xs">Métrica</th>
                        <th className="border border-teal-300 p-1 text-xs">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Proteínas */}
                      <tr className="bg-white">
                        <td className="border border-teal-200 p-2 font-medium" rowSpan={3}>
                          Proteínas
                          <div className="text-[10px] text-teal-600 font-normal">
                            Target: {formData.tipo_plan === "pediatria" ? "10-20% AMDR (≥1 año)" : "14-20% AMDR"}
                            {formData.tipo_plan === "deportista" ? " · g/kg: 1.11–2.00" : ""}
                            {formData.tipo_plan === "pediatria" ? ` · g/kg RIEN según edad` : ""}
                            {isGestanteTipo(formData.tipo_plan) ? " · g/kg: 1.53 (1.7 si bajo peso)" : ""}
                          </div>
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={3}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_gramos_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={3}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_calorias_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={3}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_amdr_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted font-bold"
                          />
                        </td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">g AVB</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_avb_gramos}
                            readOnly
                            className="h-6 text-xs bg-muted"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">% AVB</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_avb_porcentaje}
                            onChange={(e) => {
                              handleChange("proteinas_avb_porcentaje", e.target.value);
                            }}
                            className="h-6 text-xs bg-white"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">g/kg</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.proteinas_kg_peso}
                            onChange={(e) => {
                              handleChange("proteinas_kg_peso", e.target.value);
                            }}
                            className="h-6 text-xs bg-white font-semibold border-teal-300"
                          />
                        </td>
                      </tr>

                      {/* Grasas */}
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-2 font-medium" rowSpan={7}>
                          Grasas
                          <div className="text-[10px] text-teal-600 font-normal">
                            {formData.tipo_plan === "pediatria"
                              ? "Target RIEN: 30-40% (1-3a) / 25-35% (4-18a)"
                              : "Target: 20-35% AMDR"}
                          </div>
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={7}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gramos_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={7}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_calorias_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={7}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_amdr_f2}
                            onChange={(e) => {
                              handleChange("grasas_amdr_f2", e.target.value);
                            }}
                            className="h-8 text-center text-sm bg-white"
                          />
                        </td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">g GS</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gs_gramos}
                            readOnly
                            className="h-6 text-xs bg-muted"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">%AMDR GS</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gs_amdr}
                            onChange={(e) => {
                              handleChange("grasas_gs_amdr", e.target.value);
                            }}
                            className="h-6 text-xs bg-white border-teal-200"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">g GM</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gm_gramos}
                            readOnly
                            className="h-6 text-xs bg-muted"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">%AMDR GM</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gm_amdr || "30"}
                            readOnly
                            className="h-6 text-xs bg-muted"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">g GP</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gp_gramos}
                            readOnly
                            className="h-6 text-xs bg-muted"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">%AMDR GP</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gp_amdr}
                            onChange={(e) => {
                              handleChange("grasas_gp_amdr", e.target.value);
                            }}
                            className="h-6 text-xs bg-white"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">Colesterol/mg</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_colesterol}
                            onChange={(e) => {
                              handleChange("grasas_colesterol", e.target.value);
                            }}
                            className="h-6 text-xs bg-white"
                          />
                        </td>
                      </tr>

                      {/* Carbohidratos */}
                      <tr className="bg-white">
                        <td className="border border-teal-200 p-2 font-medium" rowSpan={2}>
                          CHOs
                          <div className="text-[10px] text-teal-600 font-normal">Target: 50-65% AMDR</div>
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={2}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_gramos_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={2}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_calorias_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={2}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_amdr_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted font-bold"
                          />
                        </td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">g Concent</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_concent_gramos}
                            readOnly
                            className="h-6 text-xs bg-muted"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">%AMDR</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_concent_amdr}
                            onChange={(e) => {
                              handleChange("cho_concent_amdr", e.target.value);
                            }}
                            className="h-6 text-xs bg-white"
                          />
                        </td>
                      </tr>

                      {/* Total */}
                      <tr className="bg-teal-100">
                        <td className="border border-teal-200 p-2 font-medium" colSpan={2}>Total:</td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.total_calorias_f2}
                            readOnly
                            className="h-8 text-center text-sm font-semibold bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.total_amdr_f2}
                            readOnly
                            className="h-8 text-center text-sm font-semibold bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">Fibra</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.total_fibra}
                            onChange={(e) => {
                              handleChange("total_fibra", e.target.value);
                            }}
                            className="h-6 text-xs bg-white border-teal-200"
                            placeholder="14"
                          />
                        </td>
                      </tr>

                      {/* Peso Referencia */}
                      <tr className="bg-teal-50">
                        <td className="border border-teal-200 p-2 font-medium">Kg Ref</td>
                        <td className="border border-teal-200 p-1" colSpan={5}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.peso_referencia_f2 || formData.peso_objetivo}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                            placeholder="75"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Phase 3: Fórmula Sintética Desarrollada - Tabla simplificada */}
          {currentPhase === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {phaseTitle}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{phaseDescription}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const suplementoKeys = listSuplementoKeys(formData.grupos_alimentos_f3);
                  const fields = [
                    ["per_kcal", "Kcal"],
                    ["per_prot", "Prot"],
                    ["per_grasa", "Grasa"],
                    ["per_gs", "GS"],
                    ["per_gm", "GM"],
                    ["per_gp", "GP"],
                    ["per_col", "COL"],
                    ["per_chos", "CHOS"],
                    ["per_fd", "FD"],
                  ] as const;
                  return (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 p-4 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-sm">Suplementos MIPRESS (por porción)</h4>
                          <p className="text-xs text-muted-foreground">
                            Agrega uno o más suplementos del catálogo MIPRESS. Cada uno aparece como fila en la fórmula desarrollada.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 border-amber-300 bg-white hover:bg-amber-100"
                          onClick={handleAddSuplemento}
                        >
                          <Plus className="h-4 w-4 mr-1.5" />
                          Agregar suplemento
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {suplementoKeys.map((grupoKey, idx) => {
                          const s = formData.grupos_alimentos_f3[grupoKey] || {};
                          const categoriaFiltro = s.mipress_categoria_filtro || "__all__";
                          const suplementosFiltrados =
                            categoriaFiltro === "__all__"
                              ? MIPRESS_SUPLEMENTOS
                              : MIPRESS_SUPLEMENTOS.filter((x) => x.categoria === categoriaFiltro);
                          const canRemove =
                            grupoKey !== SUPLEMENTOS_GRUPO ||
                            Boolean(s.mipress_id || s.mipress_nombre || parseFloat(s.porciones) > 0 || parseFloat(s.per_kcal) > 0);

                          return (
                            <div
                              key={grupoKey}
                              className="rounded-xl border border-amber-200/80 bg-white/80 dark:bg-background/60 p-3 sm:p-4 space-y-3 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-amber-900/90">
                                  Suplemento {idx + 1}
                                  {s.mipress_nombre ? (
                                    <span className="font-normal text-muted-foreground"> · {s.mipress_nombre}</span>
                                  ) : null}
                                </p>
                                {canRemove ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleRemoveSuplemento(grupoKey)}
                                    title={grupoKey === SUPLEMENTOS_GRUPO ? "Limpiar suplemento" : "Eliminar suplemento"}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    {grupoKey === SUPLEMENTOS_GRUPO ? "Limpiar" : "Quitar"}
                                  </Button>
                                ) : null}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Categoría MIPRESS</Label>
                                  <Select
                                    value={categoriaFiltro}
                                    onValueChange={(v) => {
                                      const prev = formData.grupos_alimentos_f3[grupoKey] || {
                                        ...emptyGrupoNutrients(),
                                        manual: true,
                                      };
                                      handleChange("grupos_alimentos_f3", {
                                        ...formData.grupos_alimentos_f3,
                                        [grupoKey]: { ...prev, mipress_categoria_filtro: v },
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-9 text-xs bg-white">
                                      <SelectValue placeholder="Todas las categorías" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-72">
                                      <SelectItem value="__all__">Todas las categorías</SelectItem>
                                      {MIPRESS_CATEGORIAS.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                          {cat}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Suplemento</Label>
                                  <Select
                                    value={s.mipress_id || "__manual__"}
                                    onValueChange={(id) => handleMipressSuplementoSelect(grupoKey, id)}
                                  >
                                    <SelectTrigger className="h-9 text-xs bg-white">
                                      <SelectValue placeholder="Elegir suplemento…" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-72">
                                      <SelectItem value="__manual__">Entrada manual (sin catálogo)</SelectItem>
                                      {suplementosFiltrados.map((supp) => (
                                        <SelectItem key={supp.id} value={supp.id}>
                                          {supp.nombre} — {supp.porcion}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {s.mipress_nombre && (
                                <p className="text-xs text-amber-900/80">
                                  <span className="font-medium">{s.mipress_nombre}</span>
                                  {s.mipress_porcion ? ` · Porción: ${s.mipress_porcion}` : ""}
                                  {s.mipress_categoria ? ` · ${s.mipress_categoria}` : ""}
                                </p>
                              )}

                              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {fields.map(([key, label]) => (
                                  <div key={key} className="space-y-1">
                                    <Label className="text-xs">{label}/porción</Label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={s[key] || ""}
                                      onChange={(e) => handleSuplementoNutrientChange(grupoKey, key, e.target.value)}
                                      className="h-8 text-xs bg-white"
                                      placeholder="0"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-primary hover:bg-primary/95 text-white sticky top-0 z-30">
                        <th className="border border-primary-foreground/20 p-2 text-left font-bold sticky left-0 z-40 bg-inherit shadow-md min-w-[250px]">
                          Grupo de alimentos
                        </th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Port.</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Kcal</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Prot</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Grasa</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">GS</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">GM</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">GP</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">COL</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">CHOS</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">FD</th>
                        {/* <th className="border border-primary-foreground/20 p-2 text-center font-bold">Ca</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">P</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Fe</th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {gruposFase3.map((grupo, index) => {
                        const grupoData = formData.grupos_alimentos_f3[grupo] || {};
                        const isEven = index % 2 === 0;
                        const suplementoLabel = isSuplementoGrupoKey(grupo)
                          ? (grupoData.mipress_nombre
                              ? `Suplemento: ${grupoData.mipress_nombre}`
                              : grupo === SUPLEMENTOS_GRUPO
                                ? "Suplementos MIPRESS"
                                : "Suplemento adicional")
                          : grupo;

                        return (
                          <tr key={grupo} className={`transition-colors hover:bg-gray-100 ${isEven ? "bg-gray-50" : "bg-white"} ${isSuplementoGrupoKey(grupo) ? "bg-amber-50 hover:bg-amber-100" : ""}`}>
                            <td className="border border-gray-300 p-2 font-medium text-gray-800 sticky left-0 z-10 bg-inherit shadow-sm min-w-[250px] text-xs">
                              {suplementoLabel}
                            </td>
                            <td className="border border-gray-200 p-1">
                              <Input
                                type="number"
                                step="0.1"
                                value={grupoData.porciones || ""}
                                onChange={(e) => handleFase3PorcionesChange(grupo, e.target.value)}
                                className="h-8 text-xs text-center bg-white border-primary/20 w-16 font-bold"
                                placeholder="0"
                              />
                            </td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.kcal || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.prot || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.grasa || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.gs || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.gm || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.gp || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.col || 0).toFixed(0)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.chos || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.fd || 0).toFixed(2)}</td>
                            {/*<td className="border border-gray-200 p-1 text-center text-xs font-mono">{(grupoData.calcio || 0).toFixed(0)}</td>
                              <td className="border border-gray-200 p-1 text-center text-xs font-mono">{(grupoData.p || 0).toFixed(0)}</td>
                              <td className="border border-gray-200 p-1 text-center text-xs font-mono">{(grupoData.fe || 0).toFixed(2)}</td>*/}
                          </tr>
                        );
                      })}
                      {/* Fila de Totales */}
                      <tr className="bg-primary/10 font-bold sticky bottom-0 z-20 shadow-lg">
                        <td className="border border-primary/30 p-2 sticky left-0 bg-primary/20">TOTAL CALCULADO</td>
                        <td className="border border-primary/30 p-1"></td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.kcal || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.prot || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.grasa || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.gs || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.gm || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.gp || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.col || 0).toFixed(0)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.chos || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.fd || 0).toFixed(2)}</td>
                        {/* <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.calcio || 0).toFixed(0)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.p || 0).toFixed(0)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.fe || 0).toFixed(2)}</td> */}
                      </tr>
                      {/* Diferencia con Fase 2 */}
                      <tr className="bg-red-50 font-bold text-red-700">
                        <td className="border border-red-200 p-2 sticky left-0 bg-red-100">DIFERENCIA (Requerimiento)</td>
                        <td className="border border-red-200 p-1"></td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.total_calorias_f2) - formData.totals_f3.kcal).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.proteinas_gramos_f2) - formData.totals_f3.prot).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_gramos_f2) - formData.totals_f3.grasa).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_gs_gramos) - formData.totals_f3.gs).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_gm_gramos) - formData.totals_f3.gm).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_gp_gramos) - formData.totals_f3.gp).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_colesterol) - formData.totals_f3.col).toFixed(0)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.cho_gramos_f2) - formData.totals_f3.chos).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.total_fibra) - formData.totals_f3.fd).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1" colSpan={3}></td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary hover:bg-primary/95 text-white sticky top-0 z-30">
                        <th className="border border-primary-foreground/20 p-2 text-left font-bold sticky left-0 z-40 bg-inherit shadow-md min-w-[250px]">
                          Grupo de alimentos
                        </th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Port.</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Kcal</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Prot</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Grasa</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">GS</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">GM</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">GP</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">COL</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">CHOS</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">FD</th>
                        {/* <th className="border border-primary-foreground/20 p-2 text-center font-bold">Ca</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">P</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Fe</th> */}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Phase 4: Minuta Patrón */}
          {currentPhase === 4 && (
            <Card className="max-h-[70vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-primary" />
                  {phaseTitle}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{phaseDescription}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Resumen de Fases Previas - Sticky */}
                <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm pb-4 pt-1 -mt-1 border-b mb-6">
                  <Card className="bg-primary/5 border-primary/20 overflow-hidden shadow-sm">
                    <CardHeader className="py-2 px-4 bg-primary/10 border-b flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Utensils className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-bold uppercase text-primary">Resumen de Porciones (Fase 3)</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">
                        Referencia para Minuta
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-3">
                      <div className="max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                        <table className="w-full text-xs">
                          <tbody className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
                            {gruposFase3.map(grupo => {
                              const porciones = parseFloat(formData.grupos_alimentos_f3[grupo]?.porciones) || 0;
                              if (porciones <= 0) return null;
                              const label = isSuplementoGrupoKey(grupo)
                                ? (formData.grupos_alimentos_f3[grupo]?.mipress_nombre
                                    ? `Suplemento: ${formData.grupos_alimentos_f3[grupo].mipress_nombre}`
                                    : "Suplemento MIPRESS")
                                : grupo;
                              return (
                                <tr key={grupo} className="flex justify-between items-center py-1 border-b border-primary/5 last:border-0">
                                  <td className="text-muted-foreground truncate mr-2">{label}</td>
                                  <td className="font-bold text-primary tabular-nums">{porciones}</td>
                                </tr>
                              );
                            })}
                            {Object.values(formData.grupos_alimentos_f3).every((g: any) => !(parseFloat(g.porciones) > 0)) && (
                              <tr className="col-span-full">
                                <td className="py-2 text-center text-muted-foreground italic" colSpan={2}>
                                  No se han asignado porciones en la Fase 3
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Información Básica */}
                <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="nombre_plan">Nombre del Plan</Label>
                    <Input
                      id="nombre_plan"
                      value={formData.nombre_plan}
                      onChange={(e) => handleChange("nombre_plan", e.target.value)}
                      placeholder="Plan Nutricional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duracion">Duración</Label>
                    <Input
                      id="duracion"
                      value={formData.duracion}
                      onChange={(e) => handleChange("duracion", e.target.value)}
                      placeholder="4 semanas"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Textarea
                      id="descripcion"
                      value={formData.descripcion}
                      onChange={(e) => handleChange("descripcion", e.target.value)}
                      placeholder="Descripción del plan nutricional..."
                      rows={2}
                    />
                  </div>
                </div>

                {/* Asignar Menú Semanal */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="weekly_menu" className="text-base font-bold flex items-center gap-2 text-primary">
                      <ClipboardList className="h-5 w-5" />
                      SELECCIONAR MENÚ BASE
                    </Label>
                    {loadingMenus ? (
                      <div className="text-sm text-muted-foreground">Cargando menús disponibles...</div>
                    ) : (
                      <Select
                        value={formData.weekly_menu_id || "__none__"}
                        onValueChange={(value) =>
                          handleChange("weekly_menu_id", value === "__none__" ? "" : value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar menú semanal base" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin menú semanal</SelectItem>
                          {weeklyMenus.map((menu) => (
                            <SelectItem key={menu.id} value={menu.id.toString()}>
                              {menu.name} ({menu.total_calories} kcal)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {loadingRecipes && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-lg bg-muted/5">
                      <Flame className="h-8 w-8 animate-pulse mb-4 text-primary" />
                      <p className="animate-pulse">Cargando detalles de recetas e ingredientes...</p>
                    </div>
                  )}

                  {!loadingRecipes && detailedMenu && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b pb-2">
                        <Label className="text-base font-bold flex items-center gap-2 text-primary">
                          <Utensils className="h-5 w-5" />
                          DETALLE POR INGREDIENTE (GRAMOS)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="week_selector" className="text-xs font-medium">Semana:</Label>
                          <Select
                            value={selectedWeek.toString()}
                            onValueChange={(value) => setSelectedWeek(parseInt(value))}
                          >
                            <SelectTrigger id="week_selector" className="w-32 h-8 text-xs">
                              <SelectValue placeholder="Semana" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Semana 1</SelectItem>
                              <SelectItem value="2">Semana 2</SelectItem>
                              <SelectItem value="3">Semana 3</SelectItem>
                              <SelectItem value="4">Semana 4</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Tabs defaultValue={detailedMenu.week[0]?.day} className="w-full">
                        <TabsList className="grid w-full grid-cols-7 mb-6">
                          {detailedMenu.week.slice((selectedWeek - 1) * 7, selectedWeek * 7).map((day: any) => (
                            <TabsTrigger key={day.day} value={day.day} className="text-xs">
                              {day.day.substring(0, 3)}
                            </TabsTrigger>
                          ))}
                        </TabsList>

                        {detailedMenu.week.map((day: any, dayIdx: number) => {
                          // Solo mostrar si el día pertenece a la semana seleccionada
                          const isCurrentWeek = dayIdx >= (selectedWeek - 1) * 7 && dayIdx < selectedWeek * 7;
                          if (!isCurrentWeek) return null;

                          return (
                            <TabsContent key={`day-${dayIdx}`} value={day.day} className="space-y-6 mt-0">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-bold text-lg text-primary">{day.day} - Semana {selectedWeek}</h4>
                                <Badge variant="outline" className="text-xs uppercase px-2 py-0.5">
                                  {day.meals.length} Comidas
                                </Badge>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {day.meals.map((meal: any, mealIdx: number) => (
                                  <Card key={`${day.day}-${dayIdx}-${mealIdx}`} className="border-primary/20 shadow-sm">
                                    <CardHeader className="py-3 px-4 bg-primary/5 border-b flex flex-row items-center justify-between space-y-0">
                                      <div>
                                        <CardTitle className="text-sm font-bold uppercase text-primary">
                                          {meal.type}
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground font-medium">{meal.recipe_name}</p>
                                      </div>
                                      <Badge variant="secondary" className="text-[10px] font-bold">
                                        {meal.calories} kcal
                                      </Badge>
                                    </CardHeader>
                                    <CardContent className="py-4 px-4 space-y-3">
                                      {meal.recipeDetails?.ingredients && meal.recipeDetails.ingredients.length > 0 ? (
                                        <div className="space-y-3">
                                          <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                                            <FileText className="h-3 w-3" />
                                            Ingredientes y gramos (según receta / tabla de composición)
                                          </Label>
                                          <div className="grid gap-2">
                                            {meal.recipeDetails.ingredients.map((ing: string, ingIdx: number) => {
                                              const mealKey = meal.type || mealIdx.toString();
                                              const baseGramsStr =
                                                baseIngredientsF4?.[dayIdx]?.[mealKey]?.[ing] ??
                                                baseIngredientsF4?.[dayIdx]?.[mealIdx]?.[ing] ??
                                                "";
                                              const baseGrams = parseFloat(String(baseGramsStr));
                                              const currentMultiplier =
                                                ingredientMultipliers?.[dayIdx]?.[mealKey]?.[ing] ?? 1;
                                              const gramsValue =
                                                formData.ingredientes_f4[dayIdx]?.[mealKey]?.[ing] ?? "";

                                              const displayGrams =
                                                gramsValue ||
                                                (Number.isFinite(baseGrams)
                                                  ? (baseGrams * currentMultiplier).toFixed(2)
                                                  : "");

                                              return (
                                                <div
                                                  key={ingIdx}
                                                  className="flex items-center gap-3 bg-muted/10 p-2 rounded border border-transparent"
                                                >
                                                  <span className="text-xs flex-1 truncate font-medium">
                                                    {ing.replace(/\s*:.*$/, "").trim() || ing}
                                                  </span>
                                                  <span className="text-[11px] text-muted-foreground w-10 text-right tabular-nums">
                                                    {displayGrams ? `${displayGrams} g` : "—"}
                                                  </span>
                                                  <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-[10px] text-muted-foreground">x</span>
                                                    <Input
                                                      type="number"
                                                      step="0.1"
                                                      className="h-7 w-16 text-[11px] text-center"
                                                      value={currentMultiplier}
                                                      onChange={(e) => {
                                                        const raw = parseFloat(e.target.value);
                                                        const safeMultiplier =
                                                          Number.isFinite(raw) && raw >= 0 ? raw : 0;

                                                        setIngredientMultipliers(prev => ({
                                                          ...prev,
                                                          [dayIdx]: {
                                                            ...(prev[dayIdx] || {}),
                                                            [mealKey]: {
                                                              ...(prev[dayIdx]?.[mealKey] || {}),
                                                              [ing]: safeMultiplier,
                                                            },
                                                          },
                                                        }));

                                                        if (Number.isFinite(baseGrams)) {
                                                          const scaled = baseGrams * safeMultiplier;
                                                          updateIngredientGrams(
                                                            dayIdx,
                                                            mealKey,
                                                            ing,
                                                            scaled.toFixed(2)
                                                          );
                                                        }
                                                      }}
                                                    />
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-center py-4 bg-muted/5 rounded flex flex-col items-center gap-2">
                                          <AlertCircle className="h-4 w-4 text-muted-foreground opacity-30" />
                                          <p className="text-[11px] text-muted-foreground">No se encontraron ingredientes para esta receta</p>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </div>
                  )}

                  {!formData.weekly_menu_id && (
                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-lg text-center space-y-3">
                      <Utensils className="h-10 w-10 text-amber-400 mx-auto" />
                      <div className="space-y-1">
                        <p className="font-bold text-amber-800">No se ha seleccionado menú</p>
                        <p className="text-sm text-amber-700">Debe seleccionar un menú semanal base para poder especificar los gramos de los ingredientes.</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="observaciones" className="text-base font-bold text-primary">Observaciones Generales</Label>
                    <Textarea
                      id="observaciones"
                      value={formData.observaciones}
                      onChange={(e) => handleChange("observaciones", e.target.value)}
                      placeholder="Recomendaciones adicionales para la minuta patrón..."
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentPhase >= 1 ? (
            <DialogFooter className="mt-6">
              <div className="flex justify-between w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentPhase === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <div className="flex gap-2">
                  {currentPhase < 4 ? (
                    <Button type="button" onClick={handleNext}>
                      Siguiente
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleSubmit}>
                      Crear Plan
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
