import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, RefreshCw } from "lucide-react";
import { normalizeCompositionIngredientList, stripIngredientPortionSuffix } from "@/lib/foodNutrients";
import { mealIngredientStorageKey, planMealRecipeOptions } from "@/lib/weeklyMenuMeals";

export type EnrichedWeeklyMenu = {
  week: Array<{
    day: string;
    week?: number;
    meals: Array<Record<string, unknown>>;
  }>;
};

type Props = {
  enrichedMenu: EnrichedWeeklyMenu | null;
  ingredientsGramos?: Record<string, unknown>;
  loadingRecipes?: boolean;
};

export function PlanMinutaPatternView({
  enrichedMenu,
  ingredientsGramos = {},
  loadingRecipes = false,
}: Props) {
  if (loadingRecipes) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin mb-4 opacity-20 text-teal-600" />
        <p className="animate-pulse">Cargando detalles de ingredientes...</p>
      </div>
    );
  }

  if (!enrichedMenu?.week?.length) {
    return (
      <div className="bg-teal-50 border border-teal-100 p-4 rounded-lg flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-teal-500" />
        <div className="text-sm">
          <p className="font-bold text-teal-800">Minuta no disponible</p>
          <p className="text-teal-700">Asigne un menú semanal al plan para ver la minuta completa.</p>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="1" className="w-full">
      <TabsList className="flex w-full mb-6 bg-teal-50/50 p-1">
        {[1, 2, 3, 4].map((w) => (
          <TabsTrigger
            key={w}
            value={w.toString()}
            className="flex-1 data-[state=active]:bg-teal-600 data-[state=active]:text-white"
          >
            Semana {w}
          </TabsTrigger>
        ))}
      </TabsList>

      {[1, 2, 3, 4].map((w) => (
        <TabsContent key={w} value={w.toString()} className="mt-0">
          {(() => {
            const weekDays = enrichedMenu.week.filter(
              (d) => d.week === w || (!d.week && w === 1)
            );
            if (weekDays.length === 0) {
              return (
                <p className="text-center py-8 text-muted-foreground">No hay datos para la semana {w}</p>
              );
            }

            return (
              <Tabs defaultValue={weekDays[0]?.day} className="w-full">
                <TabsList className="grid w-full grid-cols-7 mb-6">
                  {weekDays.map((day) => (
                    <TabsTrigger key={day.day} value={day.day} className="text-[10px] md:text-xs">
                      {day.day.substring(0, 3)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {weekDays.map((day) => {
                  const globalDayIdx = enrichedMenu.week.findIndex(
                    (d) => d.day === day.day && (d.week === w || (!d.week && w === 1))
                  );
                  return (
                    <TabsContent key={day.day} value={day.day} className="space-y-4 mt-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-teal-700">{day.day}</h4>
                        <Badge variant="outline" className="text-[10px] uppercase bg-teal-50">
                          {day.meals.length} Comidas
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {day.meals.map((meal, mealIdx) => (
                          <Card
                            key={`${day.day}-${mealIdx}`}
                            className="border-teal-50 shadow-none bg-teal-50/20"
                          >
                            <CardHeader className="py-2 px-3 border-b border-teal-100 flex flex-row items-center justify-between space-y-0">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-teal-600 block leading-tight">
                                  {String(meal.type ?? "")}
                                </span>
                                <span className="text-xs font-semibold text-teal-900">
                                  {String(meal.recipe_name ?? "")}
                                </span>
                              </div>
                              <Badge variant="secondary" className="text-[9px] bg-teal-100/50 text-teal-700">
                                {String(meal.calories ?? 0)} kcal
                              </Badge>
                            </CardHeader>
                            <CardContent className="py-3 px-3 space-y-3">
                              {(() => {
                                const options = planMealRecipeOptions(meal as Parameters<typeof planMealRecipeOptions>[0]);
                                const multi = options.length > 1;
                                const mealType = String(meal.type ?? mealIdx);
                                const dayGrams =
                                  (ingredientsGramos[String(globalDayIdx)] as Record<string, unknown>) ??
                                  (ingredientsGramos[globalDayIdx] as Record<string, unknown>) ??
                                  {};
                                const hasAny = options.some(
                                  (o) => (o.recipeDetails?.ingredients?.length ?? 0) > 0
                                );
                                if (!hasAny) {
                                  return (
                                    <p className="text-[10px] text-center text-muted-foreground italic">
                                      Sin detalles de ingredientes
                                    </p>
                                  );
                                }
                                return options.map((option, optIdx) => {
                                  const ings = normalizeCompositionIngredientList(
                                    option.recipeDetails?.ingredients || []
                                  );
                                  if (ings.length === 0) return null;
                                  const storageKey = mealIngredientStorageKey(
                                    mealType,
                                    option.recipe_id,
                                    optIdx,
                                    multi
                                  );
                                  const mealGrams =
                                    (dayGrams[storageKey] as Record<string, unknown>) ??
                                    (dayGrams[mealType] as Record<string, unknown>) ??
                                    (dayGrams[mealIdx] as Record<string, unknown>) ??
                                    {};
                                  return (
                                    <div key={`${option.recipe_id ?? optIdx}`} className="space-y-1">
                                      {multi && (
                                        <p className="text-[10px] font-bold text-teal-700">
                                          {option.recipe_name || option.recipeDetails?.name}
                                        </p>
                                      )}
                                      {ings.map((ing: string, ingIdx: number) => {
                                        const grams = (mealGrams as Record<string, unknown>)[ing] ?? "---";
                                        return (
                                          <div
                                            key={ingIdx}
                                            className="flex items-center justify-between text-xs py-1 border-b border-teal-50/50 last:border-0"
                                          >
                                            <span className="text-muted-foreground">
                                              {stripIngredientPortionSuffix(ing) || ing}
                                            </span>
                                            <span className="font-bold text-teal-700">
                                              {grams === "---" ? grams : `${grams} g`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                });
                              })()}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            );
          })()}
        </TabsContent>
      ))}
    </Tabs>
  );
}
