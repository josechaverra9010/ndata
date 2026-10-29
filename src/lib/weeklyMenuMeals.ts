import { normalizeCompositionIngredientList } from "@/lib/foodNutrients";

export const MAX_RECIPES_PER_MEAL = 5;

export type WeeklyMealType = "desayuno" | "almuerzo" | "comida" | "merienda" | "cena";

export interface MealRecipeEntry {
  recipe_id?: number;
  recipe_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  image?: string;
  ingredients?: string[];
  instructions?: string[];
}

export interface WeeklyMealSlot {
  type: WeeklyMealType;
  recipe_id?: number;
  recipe_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  notes?: string;
  image?: string;
  ingredients?: string[];
  instructions?: string[];
  recipes?: MealRecipeEntry[];
}

export interface RecipeLike {
  id: number;
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  image?: string;
  ingredients?: string[];
  instructions?: string[];
}

export function mealRecipeEntries(meal: Partial<WeeklyMealSlot> | undefined | null): MealRecipeEntry[] {
  if (!meal) return [];
  if (Array.isArray(meal.recipes) && meal.recipes.length > 0) {
    return meal.recipes.filter((r) => r.recipe_id || r.recipe_name);
  }
  if (meal.recipe_id || meal.recipe_name) {
    return [
      {
        recipe_id: meal.recipe_id,
        recipe_name: meal.recipe_name || "",
        calories: meal.calories || 0,
        protein: meal.protein || 0,
        carbs: meal.carbs || 0,
        fat: meal.fat || 0,
        image: meal.image,
        ingredients: meal.ingredients,
        instructions: meal.instructions,
      },
    ];
  }
  return [];
}

export function hasMealRecipes(meal: Partial<WeeklyMealSlot> | undefined | null): boolean {
  return mealRecipeEntries(meal).length > 0;
}

export function recipeFromCatalog(recipe: RecipeLike): MealRecipeEntry {
  return {
    recipe_id: recipe.id,
    recipe_name: recipe.name,
    calories: Number(recipe.calories) || 0,
    protein: Number(recipe.protein) || 0,
    carbs: Number(recipe.carbs) || 0,
    fat: Number(recipe.fat) || 0,
    image: recipe.image,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
  };
}

export function buildMealSlotFromRecipes(
  type: WeeklyMealType,
  time: string,
  recipes: MealRecipeEntry[],
  notes?: string
): WeeklyMealSlot {
  const entries = recipes.slice(0, MAX_RECIPES_PER_MEAL);
  const names = entries.map((r) => r.recipe_name).filter(Boolean);
  const first = entries[0];
  return {
    type,
    time,
    notes: notes ?? "",
    recipes: entries,
    recipe_id: first?.recipe_id,
    recipe_name: names.length > 1 ? names.join(" · ") : names[0] || "",
    calories: entries.reduce((s, r) => s + (r.calories || 0), 0),
    protein: entries.reduce((s, r) => s + (r.protein || 0), 0),
    carbs: entries.reduce((s, r) => s + (r.carbs || 0), 0),
    fat: entries.reduce((s, r) => s + (r.fat || 0), 0),
    image: first?.image,
    ingredients: first?.ingredients,
    instructions: first?.instructions,
  };
}

export function hydrateMealSlot(meal: WeeklyMealSlot): WeeklyMealSlot {
  const entries = mealRecipeEntries(meal);
  if (entries.length === 0) return meal;
  return buildMealSlotFromRecipes(meal.type, meal.time, entries, meal.notes);
}

/** Totales del slot (suma de todas las recetas del slot). */
export function getMealSlotMacroTotals(meal: Partial<WeeklyMealSlot> | undefined | null) {
  const entries = mealRecipeEntries(meal);
  return {
    calories: entries.reduce((s, e) => s + (Number(e.calories) || 0), 0),
    protein: entries.reduce((s, e) => s + (Number(e.protein) || 0), 0),
    carbs: entries.reduce((s, e) => s + (Number(e.carbs) || 0), 0),
    fat: entries.reduce((s, e) => s + (Number(e.fat) || 0), 0),
  };
}

/**
 * Rellena kcal/macros desde el catálogo si faltan en entries y re-suma el slot.
 */
export function syncMealSlotMacros(
  meal: WeeklyMealSlot,
  catalog?: RecipeLike[] | Map<number, RecipeLike>
): WeeklyMealSlot {
  const byId =
    catalog instanceof Map
      ? catalog
      : new Map((catalog || []).map((r) => [r.id, r]));

  const entries = mealRecipeEntries(meal).map((entry) => {
    const needsMacros =
      entry.recipe_id &&
      (!Number(entry.calories) || !Number(entry.protein));
    if (needsMacros) {
      const found = byId.get(entry.recipe_id!);
      if (found) return recipeFromCatalog(found);
    }
    return entry;
  });

  if (entries.length === 0) return meal;
  return buildMealSlotFromRecipes(meal.type, meal.time, entries, meal.notes);
}

export function toggleRecipeSelection(
  selected: RecipeLike[],
  recipe: RecipeLike,
  max = MAX_RECIPES_PER_MEAL
): RecipeLike[] {
  const exists = selected.some((r) => r.id === recipe.id);
  if (exists) return selected.filter((r) => r.id !== recipe.id);
  if (selected.length >= max) return selected;
  return [...selected, recipe];
}

export function emptyMealSlot(type: WeeklyMealType, time: string): WeeklyMealSlot {
  return {
    type,
    recipe_name: "",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    time,
    notes: "",
    recipes: [],
  };
}

export interface MealRecipeOptionEnriched extends MealRecipeEntry {
  recipeDetails?: RecipeLike | null;
}

/** Clave en ingredientes_f4: una receta usa el tipo de comida; varias usan `tipo__id`. */
export function mealIngredientStorageKey(
  mealType: string,
  recipeId: number | undefined,
  recipeIndex: number,
  multiRecipe: boolean
): string {
  if (!multiRecipe) return mealType;
  return `${mealType}__${recipeId ?? recipeIndex}`;
}

export function parseRecipeDetailsForPlan(raw: unknown): RecipeLike | null {
  if (!raw || typeof raw !== "object") return null;
  const details = { ...(raw as RecipeLike) };
  const ing = (details as { ingredients?: unknown }).ingredients;
  if (typeof ing === "string") {
    try {
      (details as { ingredients?: string[] }).ingredients = JSON.parse(ing);
    } catch {
      (details as { ingredients?: string[] }).ingredients = [];
    }
  }
  if (Array.isArray((details as { ingredients?: unknown[] }).ingredients)) {
    (details as { ingredients?: string[] }).ingredients = normalizeCompositionIngredientList(
      (details as { ingredients: unknown[] }).ingredients
    );
  }
  return details;
}

export function planMealRecipeOptions(meal: {
  recipeOptions?: MealRecipeOptionEnriched[];
  recipeDetails?: RecipeLike | null;
  recipe_id?: number;
  recipe_name?: string;
}): MealRecipeOptionEnriched[] {
  if (meal.recipeOptions?.length) return meal.recipeOptions;
  if (meal.recipeDetails) {
    return [
      {
        recipe_id: meal.recipe_id,
        recipe_name: meal.recipe_name || meal.recipeDetails.name || "",
        calories: meal.recipeDetails.calories || 0,
        protein: meal.recipeDetails.protein || 0,
        carbs: meal.recipeDetails.carbs || 0,
        fat: meal.recipeDetails.fat || 0,
        recipeDetails: meal.recipeDetails,
      },
    ];
  }
  return [];
}

export async function enrichMealForPlanWizard(
  meal: WeeklyMealSlot & Record<string, unknown>,
  fetchRecipe: (id: number) => Promise<unknown | null>
): Promise<WeeklyMealSlot & { recipeOptions: MealRecipeOptionEnriched[] }> {
  const entries = mealRecipeEntries(meal);
  if (entries.length === 0) {
    return { ...meal, recipeOptions: [] };
  }

  const recipeOptions: MealRecipeOptionEnriched[] = await Promise.all(
    entries.map(async (entry) => {
      let recipeDetails: RecipeLike | null = null;
      if (entry.recipe_id) {
        recipeDetails = parseRecipeDetailsForPlan(await fetchRecipe(entry.recipe_id));
      }
      if (!recipeDetails && (entry.ingredients?.length || entry.recipe_name)) {
        recipeDetails = parseRecipeDetailsForPlan({
          id: entry.recipe_id,
          name: entry.recipe_name,
          ingredients: entry.ingredients || [],
          instructions: entry.instructions || [],
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          image: entry.image,
        });
      }
      return { ...entry, recipeDetails };
    })
  );

  return {
    ...meal,
    recipeOptions,
    recipeDetails: recipeOptions[0]?.recipeDetails ?? undefined,
  } as WeeklyMealSlot & { recipeOptions: MealRecipeOptionEnriched[] };
}

export function forEachPlanMealIngredient(
  meal: { type?: string; recipeOptions?: MealRecipeOptionEnriched[]; recipeDetails?: RecipeLike | null; recipe_id?: number; recipe_name?: string },
  mealIdx: number,
  visit: (ctx: {
    storageKey: string;
    ing: string;
    recipeName: string;
    option: MealRecipeOptionEnriched;
  }) => void
): void {
  const options = planMealRecipeOptions(meal);
  if (options.length === 0) return;
  const mealType = meal.type || String(mealIdx);
  const multi = options.length > 1;
  options.forEach((option, idx) => {
    const storageKey = mealIngredientStorageKey(mealType, option.recipe_id, idx, multi);
    const ingredients = normalizeCompositionIngredientList(option.recipeDetails?.ingredients || []);
    const recipeName = option.recipe_name || option.recipeDetails?.name || "";
    for (const ing of ingredients) {
      visit({ storageKey, ing, recipeName, option });
    }
  });
}
