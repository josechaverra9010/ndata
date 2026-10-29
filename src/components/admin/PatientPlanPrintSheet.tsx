import { extractGruposPorciones } from "@/lib/planPhases";
import {
  normalizeCompositionIngredientList,
  stripIngredientPortionSuffix,
} from "@/lib/foodNutrients";
import {
  mealIngredientStorageKey,
  planMealRecipeOptions,
} from "@/lib/weeklyMenuMeals";
import type { EnrichedWeeklyMenu } from "@/components/admin/PlanMinutaPatternView";

const MEAL_LABELS: Record<string, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  comida: "Comida",
  merienda: "Merienda",
  cena: "Cena",
};

function mealLabel(type: string) {
  return MEAL_LABELS[type?.toLowerCase()] || type || "Comida";
}

export type PatientPlanPrintProps = {
  planName: string;
  description?: string;
  patientName?: string;
  nutritionistName?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  mealsPerDay?: number;
  tipo?: string;
  fase3?: Record<string, unknown> | null;
  observaciones?: string;
  enrichedMenu: EnrichedWeeklyMenu | null;
  ingredientsGramos?: Record<string, unknown>;
};

export function PatientPlanPrintSheet({
  planName,
  description,
  patientName,
  nutritionistName,
  calories,
  protein,
  carbs,
  fat,
  mealsPerDay,
  fase3,
  observaciones,
  enrichedMenu,
  ingredientsGramos = {},
}: PatientPlanPrintProps) {
  const gruposRows = extractGruposPorciones(fase3 ?? null);
  const days = enrichedMenu?.week ?? [];

  return (
    <div className="patient-plan-print bg-white text-slate-800 p-8 max-w-[210mm] mx-auto">
      <style>{`
        .patient-plan-print h1 { color: #0d9488; }
        .week-block { break-inside: avoid; page-break-inside: avoid; }
        .day-block { break-inside: avoid; margin-bottom: 1rem; }
      `}</style>

      <header className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 text-white p-6 mb-6 shadow-sm">
        <p className="text-xs uppercase tracking-widest opacity-90">NutriData</p>
        <h1 className="text-2xl font-bold mt-1">Tu plan de alimentación</h1>
        <p className="text-sm mt-2 opacity-95">
          {patientName ? `Para ${patientName}` : planName}
        </p>
        <p className="text-xs mt-1 opacity-80">
          {new Date().toLocaleDateString("es-CO", { dateStyle: "long" })}
        </p>
      </header>

      {description ? (
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">{description}</p>
      ) : null}

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {calories ? (
          <div className="rounded-lg bg-teal-50 border border-teal-100 p-3 text-center">
            <p className="text-[10px] uppercase text-teal-700 font-semibold">Energía</p>
            <p className="text-lg font-bold text-teal-900">{calories} kcal</p>
          </div>
        ) : null}
        {protein ? (
          <div className="rounded-lg bg-slate-50 border p-3 text-center">
            <p className="text-[10px] uppercase text-slate-500 font-semibold">Proteína</p>
            <p className="text-lg font-bold">{protein} g</p>
          </div>
        ) : null}
        {carbs ? (
          <div className="rounded-lg bg-slate-50 border p-3 text-center">
            <p className="text-[10px] uppercase text-slate-500 font-semibold">Carbohidratos</p>
            <p className="text-lg font-bold">{carbs} g</p>
          </div>
        ) : null}
        {fat ? (
          <div className="rounded-lg bg-slate-50 border p-3 text-center">
            <p className="text-[10px] uppercase text-slate-500 font-semibold">Grasas</p>
            <p className="text-lg font-bold">{fat} g</p>
          </div>
        ) : null}
        {mealsPerDay ? (
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center col-span-2 sm:col-span-1">
            <p className="text-[10px] uppercase text-amber-800 font-semibold">Comidas/día</p>
            <p className="text-lg font-bold text-amber-900">{mealsPerDay}</p>
          </div>
        ) : null}
      </section>

      {gruposRows.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-teal-800 uppercase tracking-wide mb-3">
            Porciones diarias
          </h2>
          <table className="w-full text-sm border-collapse rounded-lg overflow-hidden border border-teal-100">
            <thead>
              <tr className="bg-teal-600 text-white text-left">
                <th className="p-2 font-medium">Grupo de alimento</th>
                <th className="p-2 font-medium w-24 text-right">Porciones</th>
              </tr>
            </thead>
            <tbody>
              {gruposRows.map((row) => (
                <tr key={row.grupo} className="border-t border-teal-50 even:bg-teal-50/40">
                  <td className="p-2 text-slate-700">{row.grupo}</td>
                  <td className="p-2 text-right font-semibold text-teal-800">{row.porciones}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {observaciones ? (
        <section className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-bold text-amber-900 mb-2">Recomendaciones</h2>
          <p className="text-sm text-amber-950 whitespace-pre-line leading-relaxed">{observaciones}</p>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-bold text-teal-800 uppercase tracking-wide mb-4">
          Menú — 4 semanas, día a día
        </h2>
        {!days.length ? (
          <p className="text-sm text-slate-500 italic">
            El menú semanal no está disponible en este momento.
          </p>
        ) : (
          [1, 2, 3, 4].map((weekNum) => {
            const weekDays = days.filter(
              (d) => d.week === weekNum || (!d.week && weekNum === 1)
            );
            if (!weekDays.length) return null;
            return (
              <div key={weekNum} className="week-block mb-8">
                <h3 className="text-lg font-bold text-teal-700 mb-4 border-b-2 border-teal-200 pb-1">
                  Semana {weekNum}
                </h3>
                <div className="space-y-6">
                  {weekDays.map((day) => {
                    const globalDayIdx = days.findIndex(
                      (d) =>
                        d.day === day.day &&
                        (d.week === weekNum || (!d.week && weekNum === 1))
                    );
                    return (
                      <div key={`${weekNum}-${day.day}`} className="day-block">
                        <div className="bg-teal-600 text-white rounded-t-lg px-3 py-2 font-semibold text-sm">
                          {day.day}
                        </div>
                        <div className="border border-teal-100 rounded-b-lg divide-y divide-teal-50">
                          {(day.meals || []).map((meal, mealIdx) => {
                            const options = planMealRecipeOptions(
                              meal as Parameters<typeof planMealRecipeOptions>[0]
                            );
                            const multi = options.length > 1;
                            const mealType = String(meal.type ?? mealIdx);
                            const dayGrams =
                              (ingredientsGramos[String(globalDayIdx)] as Record<string, unknown>) ??
                              (ingredientsGramos[globalDayIdx] as Record<string, unknown>) ??
                              {};

                            return (
                              <div key={mealIdx} className="p-3 bg-white">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                  <span className="text-xs font-bold uppercase text-teal-700">
                                    {mealLabel(mealType)}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-600 shrink-0">
                                    {String(meal.calories ?? 0)} kcal
                                  </span>
                                </div>
                                {options.length === 0 ? (
                                  <p className="text-sm text-slate-600">
                                    {String(meal.recipe_name || "Sin receta asignada")}
                                  </p>
                                ) : (
                                  options.map((option, optIdx) => {
                                    const ings = normalizeCompositionIngredientList(
                                      option.recipeDetails?.ingredients || []
                                    );
                                    const storageKey = mealIngredientStorageKey(
                                      mealType,
                                      option.recipe_id,
                                      optIdx,
                                      multi
                                    );
                                    const mealGrams =
                                      (dayGrams[storageKey] as Record<string, unknown>) ??
                                      (dayGrams[mealType] as Record<string, unknown>) ??
                                      {};
                                    return (
                                      <div key={optIdx} className="mb-2 last:mb-0">
                                        {multi && (
                                          <p className="text-sm font-semibold text-slate-800 mb-1">
                                            {option.recipe_name}
                                          </p>
                                        )}
                                        <ul className="text-sm text-slate-600 space-y-0.5">
                                          {ings.map((ing) => {
                                            const g = (mealGrams as Record<string, unknown>)[ing];
                                            return (
                                              <li key={ing} className="flex justify-between gap-2">
                                                <span>
                                                  {stripIngredientPortionSuffix(ing) || ing}
                                                </span>
                                                {g != null && g !== "" && g !== "---" ? (
                                                  <span className="font-medium text-teal-800 shrink-0">
                                                    {g} g
                                                  </span>
                                                ) : null}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </section>

      <footer className="mt-10 pt-4 border-t border-slate-200 text-xs text-slate-500">
        {nutritionistName ? (
          <p className="font-medium text-slate-700">Nutricionista: {nutritionistName}</p>
        ) : null}
        <p className="mt-1">
          Guía personalizada. Si tienes dudas sobre porciones o alimentos, consulta a tu profesional.
        </p>
      </footer>
    </div>
  );
}
