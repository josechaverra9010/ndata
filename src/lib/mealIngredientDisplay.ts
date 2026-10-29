import {
  getCompositionRowForIngredient,
  kcalForIngredientAtGrams,
  macrosForIngredientAtGrams,
  parseLocaleNumberInput,
  stripIngredientPortionSuffix,
} from "@/lib/foodNutrients";

export type IngredientInput =
  | string
  | {
      name?: string;
      portion?: string | number;
      portion_size?: string | number;
      grams?: string | number;
      cantidad?: string | number;
      amount?: string | number;
      quantity?: string | number;
      porciones?: string | number;
      porcion?: string | number;
      exchanges?: string | number;
    };

export type ParsedIngredientDisplay = {
  name: string;
  grams: number | null;
  gramsLabel: string | null;
  porcionLabel: string | null;
  exchangePortions: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  matchedTable: boolean;
};

const GRAMS_RE = /(-?\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos?)\b/i;

/** Extrae gramos de "112g", "112.00G", "112 gramos", o número suelto con unidad implícita. */
export function parseGramsFromPortion(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const m = raw.match(GRAMS_RE);
  if (m) {
    const n = parseLocaleNumberInput(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = parseLocaleNumberInput(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

function formatPorcionesCount(n: number): string {
  if (n >= 0.95 && n <= 1.05) return "1";
  const rounded = Math.round(n * 10) / 10;
  return String(rounded).replace(/\.0$/, "");
}

export function formatExchangePorcionLabel(porciones: number | null, unitMeasure?: string): string | null {
  if (porciones == null || porciones <= 0) return unitMeasure ?? null;
  if (!unitMeasure) return `${formatPorcionesCount(porciones)} porc.`;
  if (porciones >= 0.95 && porciones <= 1.05) return unitMeasure;
  return `${formatPorcionesCount(porciones)} × ${unitMeasure}`;
}

export function parseIngredientForDisplay(ingredient: IngredientInput): ParsedIngredientDisplay {
  const isObject = typeof ingredient === "object" && ingredient !== null;
  let name = "";
  let grams: number | null = null;
  let exchangePortions: number | null = null;

  if (isObject) {
    const ing = ingredient;
    name = stripIngredientPortionSuffix(ing.name ?? "");
    const portionRaw =
      ing.portion ?? ing.portion_size ?? ing.grams ?? ing.cantidad ?? ing.amount ?? ing.quantity;
    grams = parseGramsFromPortion(portionRaw);
    const exch = ing.porciones ?? ing.porcion ?? ing.exchanges;
    if (exch != null && exch !== "") {
      const p = parseLocaleNumberInput(String(exch));
      if (Number.isFinite(p) && p > 0) exchangePortions = p;
    }
  } else {
    const str = String(ingredient ?? "").trim();
    const colonIdx = str.indexOf(":");
    if (colonIdx > 0) {
      name = stripIngredientPortionSuffix(str.slice(0, colonIdx).trim());
      grams = parseGramsFromPortion(str.slice(colonIdx + 1).trim());
    } else {
      name = stripIngredientPortionSuffix(str);
    }
  }

  const row = name ? getCompositionRowForIngredient(name) : null;
  const macros = name && grams ? macrosForIngredientAtGrams(name, grams) : null;
  const matchedTable = !!macros;

  let porcionLabel: string | null = null;
  if (exchangePortions != null) {
    porcionLabel = formatExchangePorcionLabel(exchangePortions, row?.unit_measure);
  } else if (macros?.unitMeasure) {
    porcionLabel = formatExchangePorcionLabel(macros.porciones, macros.unitMeasure);
  } else if (row?.unit_measure) {
    porcionLabel = row.unit_measure;
  }

  const gramsLabel =
    grams != null
      ? `${Number.isInteger(grams) ? grams : Math.round(grams * 100) / 100} g`
      : null;

  return {
    name,
    grams,
    gramsLabel,
    porcionLabel,
    exchangePortions,
    kcal: macros?.kcal ?? (name && grams ? kcalForIngredientAtGrams(name, grams) : 0),
    protein: macros?.protein ?? 0,
    carbs: macros?.carbs ?? 0,
    fat: macros?.fat ?? 0,
    matchedTable,
  };
}

export function sumMealNutritionFromIngredients(
  ingredients: IngredientInput[] | undefined | null
): {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  matched: number;
} {
  const list = ingredients ?? [];
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let matched = 0;
  for (const ing of list) {
    const p = parseIngredientForDisplay(ing);
    if (!p.name) continue;
    if (p.matchedTable && p.grams) matched += 1;
    kcal += p.kcal;
    protein += p.protein;
    carbs += p.carbs;
    fat += p.fat;
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    matched,
  };
}

export function resolveMealCalories(
  ingredients: IngredientInput[] | undefined | null,
  declaredCalories?: number
): number {
  const sum = sumMealNutritionFromIngredients(ingredients);
  if (sum.matched > 0) return sum.kcal;
  return Math.round(declaredCalories ?? 0);
}
