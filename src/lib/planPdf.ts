import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Generador de PDF profesional para un plan nutricional.
 * Toma el mismo objeto `plan` que usa PlanDetailsDialog (con fase_1..fase_4)
 * y produce un documento con evaluación, fórmula sintética, desarrollo y minuta.
 */

export interface PlanPdfData {
  id?: number;
  name?: string;
  description?: string;
  calories?: number;
  duration?: string;
  category?: string;
  tipo?: string;
  protein_target?: number;
  carbs_target?: number;
  fat_target?: number;
  meals_per_day?: number;
  created_at?: string;
  fase_1?: any;
  fase_2?: any;
  fase_3?: any;
  fase_4?: any;
}

export interface WeeklyMenuData {
  week_number?: number;
  week?: Array<{
    day: string;
    meals: Array<Record<string, any>>;
  }>;
}

export interface PlanPdfOptions {
  nutritionistName?: string;
  patientName?: string;
  weeklyMenu?: WeeklyMenuData;
  licenseTo?: string;
  specialty?: string;
  generatedAt?: string;
  verificationCode?: string;
}

const PLAN_TYPE_LABELS: Record<string, string> = {
  adulto: "Adulto",
  pediatria: "Pediatría",
  gestante: "Gestante",
  gestante_adolescente: "Gestante adolescente",
  hospitalizado: "Hospitalizado",
  geriatrico: "Geriátrico",
  deportista: "Deportista",
};

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

// Verde nutrición para encabezados de tabla y bandas
const PRIMARY: [number, number, number] = [16, 122, 87];
const LIGHT: [number, number, number] = [236, 246, 242];

function parseMaybeJson(v: any): any {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function hasValue(v: any): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "" && v.trim() !== "---";
  if (typeof v === "number") return !Number.isNaN(v);
  return true;
}

function fmt(v: any): string {
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
  }
  return String(v);
}

/** Campos de Fase 1 en orden de aparición, con su etiqueta legible. */
const FASE1_FIELDS: Array<{ key: string; label: string; suffix?: string }> = [
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
  { key: "ger_factor_actividad", label: "Factor de actividad" },
  { key: "ger_factor_estres", label: "Factor de estrés" },
  { key: "factor_estres", label: "Factor de estrés" },
  { key: "rango_kcal_kg", label: "kcal / kg" },
  { key: "ger_liquidos_cc_kg", label: "Líquidos", suffix: " cc/kg" },
  { key: "liquidos_ml", label: "Líquidos totales", suffix: " ml/día" },
  { key: "requerimiento_base", label: "Requerimiento base", suffix: " kcal" },
  { key: "requerimiento_antes_ajuste", label: "Requerimiento sin ajuste", suffix: " kcal" },
  { key: "requerimiento_energetico", label: "Requerimiento total", suffix: " kcal" },
];

function transformFase1Value(key: string, value: any): string {
  if (key === "formula_requerimiento") return FORMULA_LABELS[String(value)] || String(value);
  if (key === "genero") return GENERO_LABELS[String(value).toLowerCase()] || String(value);
  return fmt(value);
}

export function generatePlanPdf(plan: PlanPdfData, opts: PlanPdfOptions = {}): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;

  // ---- Encabezado con banda de color ----
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Plan Nutricional", marginX, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(plan.name || "Plan", marginX, 52);

  const tipoLabel = plan.tipo ? PLAN_TYPE_LABELS[plan.tipo] || plan.tipo : null;
  if (tipoLabel) {
    doc.setFontSize(10);
    const badge = tipoLabel.toUpperCase();
    const bw = doc.getTextWidth(badge) + 16;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageWidth - marginX - bw, 20, bw, 20, 4, 4, "F");
    doc.setTextColor(...PRIMARY);
    doc.setFont("helvetica", "bold");
    doc.text(badge, pageWidth - marginX - bw + 8, 34);
  }

  let y = 90;
  doc.setTextColor(90, 90, 90);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const metaBits: string[] = [];
  if (opts.patientName) metaBits.push(`Paciente: ${opts.patientName}`);
  if (opts.nutritionistName) metaBits.push(`Nutricionista: ${opts.nutritionistName}`);
  metaBits.push(`Generado: ${new Date().toLocaleDateString("es-CO")}`);
  doc.text(metaBits.join("   ·   "), marginX, y);
  y += 8;

  if (plan.description && hasValue(plan.description)) {
    y += 6;
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(plan.description, contentWidth);
    doc.text(lines, marginX, y);
    y += lines.length * 12;
  }
  y += 6;

  const nextY = () => (doc as any).lastAutoTable.finalY + 18;

  // ---- Resumen del plan ----
  const resumen: Array<[string, string]> = [];
  if (hasValue(plan.calories)) resumen.push(["Calorías objetivo", `${fmt(plan.calories)} kcal`]);
  if (hasValue(plan.protein_target)) resumen.push(["Proteínas", `${fmt(plan.protein_target)} g`]);
  if (hasValue(plan.carbs_target)) resumen.push(["Carbohidratos", `${fmt(plan.carbs_target)} g`]);
  if (hasValue(plan.fat_target)) resumen.push(["Grasas", `${fmt(plan.fat_target)} g`]);
  if (hasValue(plan.meals_per_day)) resumen.push(["Comidas por día", fmt(plan.meals_per_day)]);
  if (hasValue(plan.duration)) resumen.push(["Duración", String(plan.duration)]);

  if (resumen.length) {
    sectionTitle(doc, "Resumen del plan", marginX, y);
    autoTable(doc, {
      startY: y + 6,
      margin: { left: marginX, right: marginX },
      body: resumen,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 160, fontStyle: "bold", fillColor: LIGHT, textColor: [40, 40, 40] },
        1: { textColor: [40, 40, 40] },
      },
    });
    y = nextY();
  }

  // ---- Fase 1: Evaluación y requerimiento ----
  const f1 = parseMaybeJson(plan.fase_1);
  if (f1 && typeof f1 === "object") {
    const rows: Array<[string, string]> = [];
    for (const f of FASE1_FIELDS) {
      const raw = f1[f.key];
      if (!hasValue(raw)) continue;
      rows.push([f.label, transformFase1Value(f.key, raw) + (f.suffix || "")]);
    }
    const ajusteModo = f1.ajuste_calorias_modo;
    const ajusteVal = f1.ajuste_calorias_valor;
    if (hasValue(ajusteModo) && hasValue(ajusteVal) && String(ajusteModo) !== "ninguno") {
      const modoLabel = ajusteModo === "restriccion" ? "Restricción" : ajusteModo === "aumento" ? "Aumento" : String(ajusteModo);
      rows.push(["Ajuste calórico", `${modoLabel} ${fmt(ajusteVal)} kcal`]);
    }
    if (rows.length) {
      ensureSpace(doc, y, 120, marginX);
      y = (doc as any)._planPdfY ?? y;
      sectionTitle(doc, "Fase 1 · Evaluación y requerimiento energético", marginX, y);
      autoTable(doc, {
        startY: y + 6,
        margin: { left: marginX, right: marginX },
        body: rows,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: {
          0: { cellWidth: 200, fontStyle: "bold", fillColor: LIGHT, textColor: [40, 40, 40] },
          1: { textColor: [40, 40, 40] },
        },
      });
      y = nextY();
    }
  }

  // ---- Fase 2: Fórmula sintética (macros) ----
  const f2 = parseMaybeJson(plan.fase_2);
  if (f2 && typeof f2 === "object") {
    sectionTitle(doc, "Fase 2 · Fórmula sintética de consumo y planeada", marginX, y);
    autoTable(doc, {
      startY: y + 6,
      margin: { left: marginX, right: marginX },
      head: [["Kcal", "Prot (g)", "Grasa (g)", "GS (g)", "GM (g)", "GP (g)", "COL (mg)", "CHOS (g)", "Fibra (g)"]],
      body: [[
        fmt2(f2.total_calorias),
        fmt2(f2.proteinas_gramos),
        fmt2(f2.grasas_gramos),
        fmt2(f2.grasas_gs_gramos),
        fmt2(f2.grasas_gm_gramos),
        fmt2(f2.grasas_gp_gramos),
        fmt2(f2.grasas_colesterol),
        fmt2(f2.cho_gramos),
        fmt2(f2.total_fibra),
      ]],
      theme: "grid",
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: 8, halign: "center" },
      styles: { fontSize: 8, cellPadding: 4, halign: "center" },
    });
    y = nextY();

    const extras: Array<[string, string]> = [];
    if (hasValue(f2.peso_referencia)) extras.push(["Peso de referencia", `${fmt(f2.peso_referencia)} kg`]);
    if (hasValue(f2.cho_concent_gramos))
      extras.push(["CHO concentración", `${fmt(f2.cho_concent_gramos)} g${hasValue(f2.cho_concent_amdr) ? ` (${fmt(f2.cho_concent_amdr)}%)` : ""}`]);
    if (hasValue(f2.proteinas_avb_gramos))
      extras.push(["Proteína AVB", `${fmt(f2.proteinas_avb_gramos)} g${hasValue(f2.proteinas_avb_porcentaje) ? ` (${fmt(f2.proteinas_avb_porcentaje)}%)` : ""}`]);
    if (extras.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        body: extras,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: { 0: { cellWidth: 200, fontStyle: "bold", fillColor: LIGHT, textColor: [40, 40, 40] } },
      });
      y = nextY();
    }
  }

  // ---- Fase 3: Fórmula desarrollada / grupos de alimentos ----
  const f3 = parseMaybeJson(plan.fase_3);
  if (f3 && typeof f3 === "object") {
    sectionTitle(doc, "Fase 3 · Fórmula sintética desarrollada", marginX, y);
    y += 6;

    const grupos = parseMaybeJson(f3.grupos_alimentos);
    const gruposRows = gruposToRows(grupos);
    if (gruposRows.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [["Grupo de alimento", "Intercambios / porciones"]],
        body: gruposRows,
        theme: "striped",
        headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: { 0: { cellWidth: 300 } },
      });
      y = nextY();
    }

    const macros: Array<[string, string]> = [];
    if (hasValue(f3.proteinas_gramos)) macros.push(["Proteínas", `${fmt(f3.proteinas_gramos)} g`]);
    if (hasValue(f3.carbohidratos_gramos)) macros.push(["Carbohidratos", `${fmt(f3.carbohidratos_gramos)} g`]);
    if (hasValue(f3.grasas_gramos)) macros.push(["Grasas", `${fmt(f3.grasas_gramos)} g`]);
    if (hasValue(f3.fibra)) macros.push(["Fibra", `${fmt(f3.fibra)} g`]);
    if (hasValue(f3.vitaminas)) macros.push(["Vitaminas", fmt(f3.vitaminas)]);
    if (hasValue(f3.minerales)) macros.push(["Minerales", fmt(f3.minerales)]);
    if (macros.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        body: macros,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: { 0: { cellWidth: 200, fontStyle: "bold", fillColor: LIGHT, textColor: [40, 40, 40] } },
      });
      y = nextY();
    }

    for (const [label, key] of [["Fórmula desarrollada", "formula_desarrollada"], ["Distribución de macronutrientes", "distribucion_macronutrientes"]] as const) {
      if (hasValue(f3[key])) {
        ensureSpace(doc, y, 60, marginX);
        y = (doc as any)._planPdfY ?? y;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...PRIMARY);
        doc.text(label, marginX, y);
        y += 12;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        const lines = doc.splitTextToSize(String(f3[key]), contentWidth);
        doc.text(lines, marginX, y);
        y += lines.length * 11 + 8;
      }
    }
  }

  // ---- Fase 4: Minuta / patrón ----
  const f4 = parseMaybeJson(plan.fase_4);
  const menuRows = menuToRows(f4);
  if (menuRows.length) {
    ensureSpace(doc, y, 100, marginX);
    y = (doc as any)._planPdfY ?? y;
    sectionTitle(doc, "Fase 4 · Minuta patrón", marginX, y);
    autoTable(doc, {
      startY: y + 6,
      margin: { left: marginX, right: marginX },
      head: [["Tiempo de comida", "Preparación", "Kcal"]],
      body: menuRows,
      theme: "striped",
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 5 },
      columnStyles: { 0: { cellWidth: 130 }, 2: { cellWidth: 60, halign: "right" } },
    });
    y = nextY();
  }

  // ---- Minuta semanal (si se proporciona) ----
  if (opts.weeklyMenu && Array.isArray(opts.weeklyMenu.week) && opts.weeklyMenu.week.length) {
    ensureSpace(doc, y, 120, marginX);
    y = (doc as any)._planPdfY ?? y;
    const wkTitle = opts.weeklyMenu.week_number
      ? `Minuta semanal · Semana ${opts.weeklyMenu.week_number}`
      : "Minuta semanal";
    sectionTitle(doc, wkTitle, marginX, y);
    y += 6;
    for (const dia of opts.weeklyMenu.week) {
      const dayRows: Array<[string, string, string]> = [];
      for (const m of dia.meals || []) {
        const tiempo = m.type || m.tiempo || m.momento || "";
        const prep = m.recipe_name || m.receta || m.preparacion || m.descripcion || "Sin receta asignada";
        const kcal = m.calories ?? m.calorias ?? "";
        dayRows.push([String(tiempo), String(prep), hasValue(kcal) ? fmt(kcal) : ""]);
      }
      if (!dayRows.length) continue;
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [[dia.day || "Día", "Preparación", "Kcal"]],
        body: dayRows,
        theme: "striped",
        headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 4 },
        columnStyles: { 0: { cellWidth: 120, fontStyle: "bold" }, 2: { cellWidth: 55, halign: "right" } },
      });
      y = nextY();
    }
  }

  // ---- Firma digital + pie de página ----
  const pageCount = doc.getNumberOfPages();
  const sigOpts = opts;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    const pw = doc.internal.pageSize.getWidth();
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.5);
    doc.line(marginX, ph - 52, pageWidth - marginX, ph - 52);

    if (i === pageCount && sigOpts.nutritionistName) {
      doc.setFillColor(246, 250, 247);
      doc.roundRect(marginX, ph - 48, pw - marginX * 2, 36, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PRIMARY);
      doc.text("Firma digital del profesional", marginX + 4, ph - 38);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(53, 45, 38);
      doc.text(sigOpts.nutritionistName, marginX + 4, ph - 28);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(107, 97, 89);
      let meta = sigOpts.specialty || "Nutricionista Dietista";
      if (sigOpts.licenseTo) meta += ` · TO: ${sigOpts.licenseTo}`;
      doc.text(meta, marginX + 4, ph - 21);
      if (sigOpts.generatedAt) {
        doc.text(`Generado: ${sigOpts.generatedAt}`, marginX + 4, ph - 14);
      }
      if (sigOpts.verificationCode) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...PRIMARY);
        doc.text("VERIFICACIÓN", pw - marginX - 4, ph - 32, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(53, 45, 38);
        doc.text(sigOpts.verificationCode, pw - marginX - 4, ph - 24, { align: "right" });
      }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text("NutriData · Documento con firma digital", marginX, ph - 8);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, ph - 8, { align: "right" });
  }

  const safeName = (plan.name || "plan").replace(/[^\w\-]+/g, "_").toLowerCase();
  doc.save(`plan_${safeName}.pdf`);
}

function fmt2(v: any): string {
  return hasValue(v) ? fmt(v) : "---";
}

function sectionTitle(doc: jsPDF, title: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.text(title, x, y);
}

/** Asegura espacio vertical; si no cabe, agrega página. Guarda la nueva Y en doc._planPdfY */
function ensureSpace(doc: jsPDF, y: number, needed: number, marginX: number) {
  const ph = doc.internal.pageSize.getHeight();
  if (y + needed > ph - 50) {
    doc.addPage();
    (doc as any)._planPdfY = 60;
  } else {
    (doc as any)._planPdfY = y;
  }
}

function gruposToRows(grupos: any): Array<[string, string]> {
  if (!grupos) return [];
  const rows: Array<[string, string]> = [];
  if (Array.isArray(grupos)) {
    for (const g of grupos) {
      if (g && typeof g === "object") {
        const name = g.nombre || g.grupo || g.name || "";
        const val = g.intercambios ?? g.porciones ?? g.cantidad ?? g.value ?? "";
        if (hasValue(name)) rows.push([String(name), hasValue(val) ? fmt(val) : ""]);
      }
    }
  } else if (typeof grupos === "object") {
    for (const [k, v] of Object.entries(grupos)) {
      if (!hasValue(v)) continue;
      if (v && typeof v === "object") {
        const val = (v as any).intercambios ?? (v as any).porciones ?? (v as any).cantidad ?? "";
        rows.push([prettifyKey(k), hasValue(val) ? fmt(val) : JSON.stringify(v)]);
      } else {
        rows.push([prettifyKey(k), fmt(v)]);
      }
    }
  }
  return rows;
}

function menuToRows(f4: any): Array<[string, string, string]> {
  if (!f4) return [];
  const rows: Array<[string, string, string]> = [];
  const candidates = f4.comidas || f4.meals || f4.tiempos || (Array.isArray(f4) ? f4 : null);
  if (Array.isArray(candidates)) {
    for (const m of candidates) {
      if (m && typeof m === "object") {
        const tiempo = m.tiempo || m.type || m.momento || m.nombre || "";
        const prep = m.receta || m.recipe_name || m.preparacion || m.descripcion || m.nombre || "";
        const kcal = m.calorias ?? m.calories ?? m.kcal ?? "";
        rows.push([String(tiempo), String(prep), hasValue(kcal) ? fmt(kcal) : ""]);
      }
    }
  }
  return rows;
}

function prettifyKey(k: string): string {
  return k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
