import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { extractGruposPorciones } from "@/lib/planPhases";
import {
  normalizeCompositionIngredientList,
  stripIngredientPortionSuffix,
} from "@/lib/foodNutrients";
import {
  mealIngredientStorageKey,
  planMealRecipeOptions,
} from "@/lib/weeklyMenuMeals";
import type { PlanPdfData, PlanPdfOptions } from "@/lib/planPdf";

const PRIMARY: [number, number, number] = [13, 148, 136];
const PRIMARY_SOFT: [number, number, number] = [232, 245, 243];
const WARM: [number, number, number] = [255, 247, 237];
const TEXT: [number, number, number] = [45, 55, 52];

const MEAL_LABELS: Record<string, string> = {
  desayuno: "Desayuno",
  breakfast: "Desayuno",
  almuerzo: "Almuerzo",
  morning_snack: "Media mañana",
  comida: "Comida",
  merienda: "Merienda",
  afternoon_snack: "Merienda",
  cena: "Cena",
  dinner: "Cena",
  snack: "Snack",
};

const PLAN_TYPE_LABELS: Record<string, string> = {
  adulto: "Adulto",
  pediatria: "Pediatría",
  gestante: "Gestante",
  gestante_adolescente: "Gestante adolescente",
  hospitalizado: "Hospitalizado",
  geriatrico: "Geriátrico",
  deportista: "Deportista",
};

function parseMaybeJson(v: unknown): unknown {
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

function hasValue(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "" && v.trim() !== "---";
  if (typeof v === "number") return !Number.isNaN(v);
  return true;
}

function fmt(v: unknown): string {
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(1)));
  }
  return String(v);
}

function mealLabel(type: string): string {
  const k = (type || "").toLowerCase();
  return MEAL_LABELS[k] || type || "Comida";
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const ph = doc.internal.pageSize.getHeight();
  if (y + needed > ph - 56) {
    doc.addPage();
    return 56;
  }
  return y;
}

function sectionBanner(doc: jsPDF, title: string, marginX: number, y: number, width: number): number {
  doc.setFillColor(...PRIMARY_SOFT);
  doc.roundedRect(marginX, y - 10, width, 22, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY);
  doc.text(title, marginX + 10, y + 4);
  return y + 22;
}

function tipBox(doc: jsPDF, text: string, marginX: number, y: number, width: number): number {
  if (!hasValue(text)) return y;
  doc.setFillColor(...WARM);
  doc.setDrawColor(251, 191, 36);
  doc.setLineWidth(0.5);
  const lines = doc.splitTextToSize(text, width - 20);
  const h = lines.length * 11 + 16;
  y = ensureSpace(doc, y, h);
  doc.roundedRect(marginX, y, width, h, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(180, 83, 9);
  doc.text("Recomendaciones para ti", marginX + 10, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(lines, marginX + 10, y + 28);
  return y + h + 14;
}

type WeekDay = {
  day: string;
  week?: number;
  meals: Array<Record<string, unknown>>;
};

function weekDaysForNumber(days: WeekDay[], weekNum: number): WeekDay[] {
  return days.filter((d) => d.week === weekNum || (!d.week && weekNum === 1));
}

function formatMealIngredientsBlock(
  meal: Record<string, unknown>,
  mealIdx: number,
  globalDayIdx: number,
  ingredientesF4: Record<string, unknown>
): string {
  const options = planMealRecipeOptions(meal as Parameters<typeof planMealRecipeOptions>[0]);
  if (!options.length) {
    const name = String(meal.recipe_name || meal.receta || "").trim();
    return name || "Sin receta asignada";
  }

  const multi = options.length > 1;
  const mealType = String(meal.type ?? mealIdx);
  const dayGrams =
    (ingredientesF4[String(globalDayIdx)] as Record<string, unknown>) ??
    (ingredientesF4[globalDayIdx] as Record<string, unknown>) ??
    {};

  const lines: string[] = [];
  options.forEach((option, optIdx) => {
    const ings = normalizeCompositionIngredientList(option.recipeDetails?.ingredients || []);
    if (multi && (option.recipe_name || option.recipeDetails?.name)) {
      lines.push(`• ${option.recipe_name || option.recipeDetails?.name}`);
    }
    const storageKey = mealIngredientStorageKey(mealType, option.recipe_id, optIdx, multi);
    const mealGrams =
      (dayGrams[storageKey] as Record<string, unknown>) ??
      (dayGrams[mealType] as Record<string, unknown>) ??
      (dayGrams[mealIdx] as Record<string, unknown>) ??
      {};

    for (const ing of ings) {
      const grams = (mealGrams as Record<string, unknown>)[ing];
      const label = stripIngredientPortionSuffix(ing) || ing;
      lines.push(grams != null && grams !== "" && grams !== "---" ? `  – ${label}: ${grams} g` : `  – ${label}`);
    }
    if (ings.length === 0 && option.recipe_name) {
      lines.push(`  – ${option.recipe_name}`);
    }
  });
  return lines.join("\n");
}

function renderWeeklyMenusPatient(
  doc: jsPDF,
  marginX: number,
  contentWidth: number,
  y: number,
  days: WeekDay[],
  ingredientesF4: Record<string, unknown>
): number {
  if (!days.length) return y;

  y = sectionBanner(doc, "Tu menú — semana a semana", marginX, y, contentWidth);

  for (let weekNum = 1; weekNum <= 4; weekNum++) {
    const weekDays = weekDaysForNumber(days, weekNum);
    if (!weekDays.length) continue;

    y = ensureSpace(doc, y, 48);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY);
    doc.text(`Semana ${weekNum}`, marginX, y);
    y += 10;

    for (const day of weekDays) {
      const globalDayIdx = days.findIndex(
        (d) => d.day === day.day && (d.week === weekNum || (!d.week && weekNum === 1))
      );

      y = ensureSpace(doc, y, 40);
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(marginX, y - 2, contentWidth, 18, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(day.day, marginX + 8, y + 10);
      y += 22;

      const body: string[][] = [];
      const meals = Array.isArray(day.meals) ? day.meals : [];
      meals.forEach((meal, mealIdx) => {
        const tiempo = mealLabel(String(meal.type ?? ""));
        const detail = formatMealIngredientsBlock(meal, mealIdx, globalDayIdx, ingredientesF4);
        const kcal = meal.calories ?? meal.calorias ?? "";
        body.push([tiempo, detail, hasValue(kcal) ? `${fmt(kcal)} kcal` : ""]);
      });

      if (!body.length) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text("Sin comidas configuradas este día.", marginX + 4, y);
        y += 16;
        continue;
      }

      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [["Momento", "Qué comer (ingredientes)", "Energía"]],
        body,
        theme: "grid",
        headStyles: {
          fillColor: PRIMARY_SOFT,
          textColor: PRIMARY,
          fontSize: 8,
          fontStyle: "bold",
        },
        styles: {
          fontSize: 8,
          cellPadding: 5,
          textColor: TEXT,
          valign: "top",
        },
        columnStyles: {
          0: { cellWidth: 72, fontStyle: "bold" },
          1: { cellWidth: contentWidth - 72 - 68 },
          2: { cellWidth: 68, halign: "right" },
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    }
    y += 4;
  }
  return y;
}

/** PDF amigable para entregar al paciente (porciones + menú detallado). */
export function generatePatientPlanPdf(plan: PlanPdfData, opts: PlanPdfOptions = {}): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 44;
  const contentWidth = pageWidth - marginX * 2;

  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageWidth, 88, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Tu plan de alimentación", marginX, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const subtitle = opts.patientName
    ? `Preparado para ${opts.patientName}`
    : plan.name || "Plan nutricional personalizado";
  doc.text(subtitle, marginX, 58);
  doc.setFontSize(9);
  doc.text(
    `Fecha: ${new Date().toLocaleDateString("es-CO", { dateStyle: "long" })}`,
    marginX,
    74
  );

  let y = 108;
  doc.setTextColor(...TEXT);
  doc.setFontSize(10);
  if (plan.description && hasValue(plan.description)) {
    const lines = doc.splitTextToSize(String(plan.description), contentWidth);
    doc.text(lines, marginX, y);
    y += lines.length * 12 + 8;
  }

  const tipoLabel = plan.tipo ? PLAN_TYPE_LABELS[plan.tipo] || plan.tipo : null;
  const resumen: [string, string][] = [];
  if (hasValue(plan.calories)) resumen.push(["Meta de energía", `${fmt(plan.calories)} kcal / día`]);
  if (hasValue(plan.protein_target)) resumen.push(["Proteínas", `${fmt(plan.protein_target)} g`]);
  if (hasValue(plan.carbs_target)) resumen.push(["Carbohidratos", `${fmt(plan.carbs_target)} g`]);
  if (hasValue(plan.fat_target)) resumen.push(["Grasas", `${fmt(plan.fat_target)} g`]);
  if (hasValue(plan.meals_per_day)) resumen.push(["Comidas al día", fmt(plan.meals_per_day)]);
  if (tipoLabel) resumen.push(["Tipo de plan", tipoLabel]);
  if (hasValue(plan.duration)) resumen.push(["Duración", String(plan.duration)]);

  if (resumen.length) {
    y = sectionBanner(doc, "Resumen de tu plan", marginX, y, contentWidth);
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      body: resumen,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 6 },
      columnStyles: {
        0: { cellWidth: 160, fontStyle: "bold", textColor: PRIMARY },
        1: { textColor: TEXT },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  const f3 = parseMaybeJson(plan.fase_3) as Record<string, unknown> | null;
  const gruposRows = extractGruposPorciones(f3);
  if (gruposRows.length) {
    y = sectionBanner(doc, "Porciones diarias (grupos de alimentos)", marginX, y, contentWidth);
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [["Grupo", "Porciones / día"]],
      body: gruposRows.map((r) => [r.grupo, fmt(r.porciones)]),
      theme: "striped",
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: contentWidth - 80 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  const f4 = parseMaybeJson(plan.fase_4) as Record<string, unknown> | null;
  const observaciones = f4?.observaciones ? String(f4.observaciones) : "";
  y = tipBox(doc, observaciones, marginX, y, contentWidth);

  const ingredientesF4 = (opts.ingredientesF4 || f4?.ingredientes_f4 || {}) as Record<string, unknown>;
  const enrichedDays =
    opts.enrichedWeeklyMenu?.week ||
    opts.weeklyMenu?.week ||
    [];

  if (enrichedDays.length) {
    y = renderWeeklyMenusPatient(doc, marginX, contentWidth, y, enrichedDays as WeekDay[], ingredientesF4);
  } else {
    y = ensureSpace(doc, y, 40);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      "El menú semanal aún no está asignado. Consulta con tu nutricionista la minuta día a día.",
      marginX,
      y
    );
    y += 20;
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...PRIMARY_SOFT);
    doc.setLineWidth(0.5);
    doc.line(marginX, ph - 36, pageWidth - marginX, ph - 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    const footerLeft = opts.nutritionistName
      ? `Nutricionista: ${opts.nutritionistName}`
      : "Plan elaborado con NutriData";
    doc.text(footerLeft, marginX, ph - 22);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, ph - 22, { align: "right" });
    if (i === pageCount) {
      doc.setFontSize(7);
      const note = doc.splitTextToSize(
        "Este documento es una guía alimentaria personalizada. Ante dudas, contacta a tu profesional.",
        contentWidth
      );
      doc.text(note, marginX, ph - 12);
    }
  }

  const safeName = (opts.patientName || plan.name || "plan")
    .replace(/[^\w\-]+/g, "_")
    .toLowerCase();
  doc.save(`plan_paciente_${safeName}.pdf`);
}
