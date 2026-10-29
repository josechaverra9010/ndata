import React, { useState, useEffect, useMemo } from "react";
import { API_URL } from "@/config/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PatientPlanPrintPreviewDialog } from "@/components/admin/PatientPlanPrintPreviewDialog";
import {
  Calculator,
  ClipboardList,
  FileText,
  Utensils,
  Loader2,
  Printer,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { generatePlanPdf } from "@/lib/planPdf";
import { PatientPlanPrintSheet } from "@/components/admin/PatientPlanPrintSheet";
import { toast } from "sonner";
import { FOOD_NUTRIENTS } from "@/lib/foodNutrients";
import {
  hydrateMealPlanPhases,
  planDiagnosticoResumen,
  planRequerimientoEnergeticoKcal,
  extractGruposPorciones,
  fase3Totales,
  buildFase1SummaryRows,
  fase1PesoKg,
  fase1AlturaCm,
  fase1ImcDisplay,
  fase2Field,
} from "@/lib/planPhases";
import { enrichMealForPlanWizard } from "@/lib/weeklyMenuMeals";
import { PlanMinutaPatternView } from "@/components/admin/PlanMinutaPatternView";

interface PlanPhasesSummaryDialogProps {
  plan: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName?: string;
}

export function PlanPhasesSummaryDialog({ plan, open, onOpenChange, patientName }: PlanPhasesSummaryDialogProps) {
  const [fullPlan, setFullPlan] = useState<any>(null);
  const [enrichedMenu, setEnrichedMenu] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  const fetchPdfSignature = async () => {
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/nutritionist/pdf-signature?doc_type=meal_plan`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) return await res.json();
    } catch {
      /* opcional */
    }
    return {};
  };

  useEffect(() => {
    if (open && plan?.id) {
      setFullPlan(plan.fase_1 || plan.fase_2 ? hydrateMealPlanPhases(plan) : null);
      fetchPlanDetails();
    } else if (!open) {
      setFullPlan(null);
      setEnrichedMenu(null);
    }
  }, [open, plan?.id]);

  const fetchRecipeById = async (recipeId: number) => {
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/recipes/${recipeId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) return await response.json();
    } catch (error) {
      console.error(`Error fetching recipe ${recipeId}:`, error);
    }
    return null;
  };

  const loadWeeklyMenu = async (planId: number) => {
    setLoadingRecipes(true);
    setEnrichedMenu(null);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/weekly-menus/by-plan/${planId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.week?.length) return;
      const enrichedWeek = await Promise.all(
        data.week.map(async (day: any) => {
          const enrichedMeals = await Promise.all(
            (day.meals || []).map((meal: any) => enrichMealForPlanWizard(meal, fetchRecipeById))
          );
          return { ...day, meals: enrichedMeals };
        })
      );
      setEnrichedMenu({ ...data, week: enrichedWeek });
    } catch (e) {
      console.error("Error loading menu for summary:", e);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const fetchPlanDetails = async () => {
    if (!plan?.id) return;
    if (!plan.fase_1 && !plan.fase_2) setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/meal-plans/${plan.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setFullPlan(hydrateMealPlanPhases(data));
        await loadWeeklyMenu(plan.id);
      }
    } catch (error) {
      console.error("Error fetching plan details:", error);
    } finally {
      setLoading(false);
    }
  };

  const displayPlan = fullPlan || (plan ? hydrateMealPlanPhases(plan) : null);

  const f1 = (displayPlan?.fase_1 || {}) as Record<string, unknown>;
  const f2 = (displayPlan?.fase_2 || {}) as Record<string, unknown>;
  const f3 = (displayPlan?.fase_3 || {}) as Record<string, unknown>;
  const f4 = (displayPlan?.fase_4 || {}) as Record<string, unknown>;

  const reKcal = useMemo(
    () => planRequerimientoEnergeticoKcal(f1, displayPlan?.calories),
    [f1, displayPlan?.calories]
  );
  const gruposRows = useMemo(() => extractGruposPorciones(f3), [f3]);
  const f3Totales = useMemo(() => fase3Totales(f3), [f3]);
  const f1Rows = useMemo(() => buildFase1SummaryRows(f1), [f1]);
  const ingredientsGramos = (f4.ingredientes_f4 as Record<string, unknown>) || {};

  const handleDownloadPdf = async () => {
    if (!displayPlan) return;
    if (loadingRecipes) {
      toast.info("Espera a que cargue el menú…");
      return;
    }
    try {
      const sigOpts = await fetchPdfSignature();
      generatePlanPdf(displayPlan, {
        mode: "patient",
        patientName,
        enrichedWeeklyMenu: enrichedMenu ?? undefined,
        ingredientesF4: ingredientsGramos,
        nutritionistName: (sigOpts as { nutritionist_name?: string }).nutritionist_name,
        licenseTo: (sigOpts as { license_to?: string }).license_to,
        specialty: (sigOpts as { specialty?: string }).specialty,
        generatedAt: (sigOpts as { generated_at?: string }).generated_at,
        verificationCode: (sigOpts as { verification_code?: string }).verification_code,
      });
      toast.success("PDF generado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el PDF");
    }
  };

  if (!open) return null;
  if (!displayPlan) return null;

  return (
    <>
    <Dialog open={open && !printOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary shrink-0" />
                Resumen del Plan Nutricional
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Detalle de las 4 fases del plan: {displayPlan.name}
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (loadingRecipes) {
                    toast.info("Espera a que cargue el menú…");
                    return;
                  }
                  setPrintOpen(true);
                }}
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Imprimir
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDownloadPdf}>
                <Download className="h-4 w-4 mr-1.5" />
                PDF paciente
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading && !fullPlan ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="phase1" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 px-1">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="phase1">Fase 1</TabsTrigger>
                <TabsTrigger value="phase2">Fase 2</TabsTrigger>
                <TabsTrigger value="phase3">Fase 3</TabsTrigger>
                <TabsTrigger value="phase4">Fase 4</TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 touch-pan-y">
              <TabsContent value="phase1" className="mt-0 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Diagnóstico</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-line leading-relaxed">
                      {planDiagnosticoResumen(f1, displayPlan)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-primary" />
                      Requerimiento energético y antropometría
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Peso</p>
                        <p className="font-semibold">{fase1PesoKg(f1, displayPlan)} kg</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Altura</p>
                        <p className="font-semibold">{fase1AlturaCm(f1, displayPlan)} cm</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">IMC</p>
                        <p className="font-semibold">{fase1ImcDisplay(f1)}</p>
                      </div>
                      <div className="space-y-1 col-span-2 bg-primary/5 p-3 rounded-lg border border-primary/10">
                        <p className="text-xs text-primary font-bold uppercase">Requerimiento energético total</p>
                        <p className="text-2xl font-bold text-primary">{reKcal != null ? `${reKcal} kcal` : "—"}</p>
                      </div>
                    </div>
                    {f1Rows.length > 0 && (
                      <div className="mt-4 overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <tbody className="divide-y">
                            {f1Rows.map((row) => (
                              <tr key={row.label} className="hover:bg-muted/30">
                                <td className="p-2 font-medium text-muted-foreground w-1/2">{row.label}</td>
                                <td className="p-2">{row.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="phase2" className="mt-0 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Distribución de macronutrientes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-center font-medium">Nutriente</th>
                            <th className="p-2 text-center font-medium">Gramos</th>
                            <th className="p-2 text-center font-medium">Kcal</th>
                            <th className="p-2 text-center font-medium">% AMDR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr>
                            <td className="p-2 font-medium">Proteínas</td>
                            <td className="p-2 text-center">{String(fase2Field(f2, "proteinas_gramos") ?? "—")}</td>
                            <td className="p-2 text-center">{String(fase2Field(f2, "proteinas_calorias") ?? "—")}</td>
                            <td className="p-2 text-center">
                              {fase2Field(f2, "proteinas_amdr") != null
                                ? `${fase2Field(f2, "proteinas_amdr")}%`
                                : "—"}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2 font-medium">Grasas</td>
                            <td className="p-2 text-center">{String(fase2Field(f2, "grasas_gramos") ?? "—")}</td>
                            <td className="p-2 text-center">{String(fase2Field(f2, "grasas_calorias") ?? "—")}</td>
                            <td className="p-2 text-center">
                              {fase2Field(f2, "grasas_amdr") != null ? `${fase2Field(f2, "grasas_amdr")}%` : "—"}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2 font-medium">Carbohidratos</td>
                            <td className="p-2 text-center">{String(fase2Field(f2, "cho_gramos") ?? "—")}</td>
                            <td className="p-2 text-center">{String(fase2Field(f2, "cho_calorias") ?? "—")}</td>
                            <td className="p-2 text-center">
                              {fase2Field(f2, "cho_amdr") != null ? `${fase2Field(f2, "cho_amdr")}%` : "—"}
                            </td>
                          </tr>
                          <tr className="bg-muted/50 font-bold">
                            <td className="p-2">Total</td>
                            <td className="p-2 text-center">—</td>
                            <td className="p-2 text-center">
                              {String(fase2Field(f2, "total_calorias") ?? reKcal ?? "—")}
                            </td>
                            <td className="p-2 text-center">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-teal-200">
                      <table className="w-full text-xs">
                        <thead className="bg-teal-50">
                          <tr>
                            <th className="p-2">GS (g)</th>
                            <th className="p-2">GM (g)</th>
                            <th className="p-2">GP (g)</th>
                            <th className="p-2">COL (mg)</th>
                            <th className="p-2">Fibra (g)</th>
                            <th className="p-2">Peso ref. (kg)</th>
                          </tr>
                        </thead>
                        <tbody className="text-center">
                          <tr>
                            <td className="p-2">{String(fase2Field(f2, "grasas_gs_gramos") ?? "—")}</td>
                            <td className="p-2">{String(fase2Field(f2, "grasas_gm_gramos") ?? "—")}</td>
                            <td className="p-2">{String(fase2Field(f2, "grasas_gp_gramos") ?? "—")}</td>
                            <td className="p-2">{String(fase2Field(f2, "grasas_colesterol") ?? "—")}</td>
                            <td className="p-2">{String(fase2Field(f2, "total_fibra") ?? "—")}</td>
                            <td className="p-2">{String(fase2Field(f2, "peso_referencia") ?? "—")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="phase3" className="mt-0 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Distribución por grupos de alimentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {gruposRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Sin porciones registradas en fase 3.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-2 text-left font-bold">Grupo</th>
                              <th className="p-2 text-center font-bold">Porciones</th>
                              <th className="p-2 text-center font-bold">Kcal</th>
                              <th className="p-2 text-center font-bold">Prot</th>
                              <th className="p-2 text-center font-bold">Grasa</th>
                              <th className="p-2 text-center font-bold">CHOS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {gruposRows.map((row) => {
                              const nutrients = FOOD_NUTRIENTS[row.grupo as keyof typeof FOOD_NUTRIENTS];
                              const kcal = row.kcal ?? (nutrients ? row.porciones * nutrients.energia : 0);
                              const prot = row.prot ?? (nutrients ? row.porciones * nutrients.proteina : 0);
                              const grasa = row.grasa ?? (nutrients ? row.porciones * nutrients.grasa : 0);
                              const chos = row.chos ?? (nutrients ? row.porciones * nutrients.carbohidratos : 0);
                              return (
                                <tr key={row.grupo} className="hover:bg-muted/50">
                                  <td className="p-2 font-medium">{row.grupo}</td>
                                  <td className="p-2 text-center font-bold bg-primary/5">{row.porciones}</td>
                                  <td className="p-2 text-center">{kcal.toFixed(0)}</td>
                                  <td className="p-2 text-center">{prot.toFixed(2)}</td>
                                  <td className="p-2 text-center">{grasa.toFixed(2)}</td>
                                  <td className="p-2 text-center">{chos.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                            {f3Totales && (
                              <tr className="bg-muted/50 font-bold border-t-2">
                                <td className="p-2">Totales</td>
                                <td className="p-2 text-center">—</td>
                                <td className="p-2 text-center">{String(f3Totales.total_calorias ?? f3Totales.kcal ?? "—")}</td>
                                <td className="p-2 text-center">{String(f3Totales.total_proteinas ?? f3Totales.prot ?? "—")}</td>
                                <td className="p-2 text-center">{String(f3Totales.total_grasas ?? f3Totales.grasa ?? "—")}</td>
                                <td className="p-2 text-center">{String(f3Totales.total_chos ?? f3Totales.chos ?? "—")}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="phase4" className="mt-0 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-primary" />
                      Minuta patrón (4 semanas)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <PlanMinutaPatternView
                      enrichedMenu={enrichedMenu}
                      ingredientsGramos={ingredientsGramos}
                      loadingRecipes={loadingRecipes}
                    />
                    {f4.observaciones && (
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <Label className="text-xs font-bold text-yellow-800 uppercase mb-1">Observaciones</Label>
                        <p className="text-sm text-yellow-900 whitespace-pre-line">{String(f4.observaciones)}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>

    <PatientPlanPrintPreviewDialog open={printOpen} onOpenChange={setPrintOpen}>
      <PatientPlanPrintSheet
        planName={displayPlan.name}
        description={displayPlan.description}
        patientName={patientName}
        calories={displayPlan.calories}
        protein={displayPlan.protein_target}
        carbs={displayPlan.carbs_target}
        fat={displayPlan.fat_target}
        mealsPerDay={displayPlan.meals_per_day}
        tipo={displayPlan.tipo}
        fase3={f3}
        observaciones={f4.observaciones ? String(f4.observaciones) : undefined}
        enrichedMenu={enrichedMenu}
        ingredientsGramos={ingredientsGramos}
      />
    </PatientPlanPrintPreviewDialog>
    </>
  );
}
