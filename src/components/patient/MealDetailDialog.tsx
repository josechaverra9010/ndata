import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Flame, List, Utensils, Loader2 } from "lucide-react";
import {
  parseIngredientForDisplay,
  sumMealNutritionFromIngredients,
  resolveMealCalories,
  type IngredientInput,
} from "@/lib/mealIngredientDisplay";

export interface MealDetail {
  meal?: string;
  food?: string;
  receta?: string;
  name?: string;
  description?: string;
  calories?: number;
  calorias?: number;
  time?: string;
  ingredients?: IngredientInput[];
  instructions?: string[];
  image?: string;
  recipes?: {
    recipe_id?: number;
    recipe_name?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    image?: string;
  }[];
}

interface MealDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealDetail | null;
  /** Si se pasa, se usa para construir la URL de la imagen (ej. path relativo -> URL completa) */
  getImageUrl?: (imagePath: string | undefined) => string;
  loading?: boolean;
  showCloseFooter?: boolean;
}

function normalizeList<T>(val: unknown, stringKeys?: string[]): T[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return [];
    if (trimmed.includes("\n")) return trimmed.split("\n").map((s) => s.trim()).filter(Boolean) as T[];
    if (trimmed.includes(",")) return trimmed.split(",").map((s) => s.trim()).filter(Boolean) as T[];
    return [trimmed] as T[];
  }
  return [];
}

export function MealDetailDialog({
  open,
  onOpenChange,
  meal,
  getImageUrl,
  loading = false,
  showCloseFooter = false,
}: MealDetailDialogProps) {
  const title = meal?.receta ?? meal?.food ?? meal?.name ?? meal?.description ?? "Detalle de comida";
  const ingredients = Array.isArray(meal?.ingredients)
    ? meal.ingredients
    : normalizeList<IngredientInput>(
        (meal as Record<string, unknown>)?.ingredients ?? (meal as Record<string, unknown>)?.ingredientes
      );
  const nutritionSum = sumMealNutritionFromIngredients(ingredients);
  const kcal = resolveMealCalories(ingredients, meal?.calories ?? meal?.calorias ?? 0);
  const imgSrc = meal?.image
    ? (getImageUrl ? getImageUrl(meal.image) : meal.image)
    : "";
  const instructions = Array.isArray(meal?.instructions)
    ? meal.instructions
    : normalizeList<string>((meal as Record<string, unknown>)?.instructions ?? (meal as Record<string, unknown>)?.instrucciones ?? (meal as Record<string, unknown>)?.steps);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90dvh,90vh)] w-full max-w-md flex-col gap-0 overflow-hidden border-border/70 p-0 sm:rounded-2xl lg:max-w-2xl">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cargando receta...</p>
            </div>
          </div>
        )}

        {meal && (
          <>
            <div className="relative shrink-0 border-b border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-background px-5 pb-5 pt-4 sm:px-6">
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    {meal.meal ?? "Comida"}
                  </div>
                  <DialogTitle className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl sm:leading-tight">
                    {title}
                  </DialogTitle>
                </div>
                <Badge className="mb-0.5 shrink-0 rounded-full border-0 bg-orange-500/15 px-3 py-1 font-bold text-orange-700 dark:text-orange-300">
                  <Flame className="mr-1 inline h-3 w-3" />
                  {kcal} kcal
                </Badge>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="w-full min-w-0 space-y-6 px-5 py-5 pb-8 sm:px-6">
                {meal.recipes && meal.recipes.length > 1 && (
                  <div className="space-y-2 rounded-2xl border border-border/50 bg-muted/20 p-4">
                    <p className="text-sm font-semibold text-foreground">Opciones para esta comida</p>
                    <ul className="space-y-2">
                      {meal.recipes.map((r, idx) => (
                        <li key={r.recipe_id ?? idx} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-medium">{r.recipe_name}</span>
                          <span className="shrink-0 text-muted-foreground">{r.calories ?? 0} kcal</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      Puedes elegir cualquiera de estas recetas; los totales del slot suman {kcal} kcal.
                    </p>
                  </div>
                )}

                {imgSrc && (
                  <div data-meal-photo className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20 shadow-md">
                    <div className="relative aspect-[16/10] w-full min-h-[9.5rem] sm:min-h-[11rem]">
                      <img
                        src={imgSrc}
                        alt={title}
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).closest("[data-meal-photo]")?.style.setProperty("display", "none");
                        }}
                      />
                    </div>
                  </div>
                )}

                {meal.time && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Horario sugerido: {meal.time}
                  </div>
                )}

                {nutritionSum.matched > 0 && (
                  <div className="flex flex-wrap gap-2 rounded-2xl border border-border/50 bg-muted/25 px-3 py-2.5 text-xs">
                    <span className="font-semibold text-foreground">
                      Total calculado: {nutritionSum.kcal} kcal
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      P {nutritionSum.protein}g · C {nutritionSum.carbs}g · G {nutritionSum.fat}g
                    </span>
                  </div>
                )}

                <div className="flex w-full min-w-0 flex-col gap-8 lg:flex-row lg:items-start lg:gap-8">
                  <section className="min-w-0 flex-1 space-y-4 lg:max-w-[50%]">
                    <div className="flex items-center gap-3 border-b border-border/50 pb-2">
                      <div className="rounded-xl bg-orange-500/10 p-2 text-orange-600 dark:text-orange-400">
                        <List className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold tracking-tight text-foreground">Ingredientes</h3>
                    </div>

                    {ingredients.length > 0 ? (
                      <ul className="m-0 grid list-none gap-2.5 p-0">
                        {ingredients.map((ingredient, idx) => {
                          const row = parseIngredientForDisplay(ingredient);
                          return (
                            <li
                              key={idx}
                              className="grid grid-cols-[1fr_auto] items-start gap-x-2 gap-y-1 rounded-xl border border-border/40 bg-muted/30 p-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold capitalize leading-snug text-foreground/90">
                                  {row.name}
                                </p>
                                {row.porcionLabel && (
                                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                                    Porción: {row.porcionLabel}
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                {row.gramsLabel && (
                                  <Badge
                                    variant="outline"
                                    className="whitespace-nowrap border-primary/20 bg-primary/10 px-2 py-0 text-[10px] font-bold text-primary"
                                  >
                                    {row.gramsLabel}
                                  </Badge>
                                )}
                                {row.matchedTable && row.kcal > 0 && (
                                  <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                                    ~{Math.round(row.kcal)} kcal
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-10 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                          <List className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No hay ingredientes listados.</p>
                      </div>
                    )}
                  </section>

                  <section className="min-w-0 flex-1 space-y-4 lg:max-w-[50%]">
                    <div className="flex items-center gap-3 border-b border-border/50 pb-2">
                      <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                        <Utensils className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold tracking-tight text-foreground">Preparación</h3>
                    </div>

                    {instructions.length > 0 ? (
                      <ol className="m-0 flex list-none flex-col gap-4 p-0">
                        {instructions.map((step, idx) => (
                          <li
                            key={idx}
                            className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0"
                          >
                            <span
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary"
                              aria-hidden
                            >
                              {idx + 1}
                            </span>
                            <p className="min-w-0 pt-0.5 text-sm font-medium leading-relaxed text-muted-foreground">
                              {typeof step === "string" ? step : String(step)}
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-10 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                          <Utensils className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No hay pasos disponibles.</p>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>

            {showCloseFooter && (
              <div className="flex shrink-0 justify-end border-t border-border bg-background/95 p-4">
                <Button className="rounded-full px-6" type="button" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
