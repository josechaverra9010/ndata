import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calculator, 
  ClipboardList, 
  FileText, 
  Utensils, 
  Flame, 
  Users, 
  Clock, 
  AlertCircle 
} from "lucide-react";
import { FOOD_NUTRIENTS } from "@/lib/foodNutrients";

interface PlanPhasesSummaryDialogProps {
  plan: any; // Using any for flexibility with the plan structure
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GRUPOS_ALIMENTOS = Object.keys(FOOD_NUTRIENTS);

export function PlanPhasesSummaryDialog({ plan, open, onOpenChange }: PlanPhasesSummaryDialogProps) {
  if (!plan) return null;

  // Helper to safely access nested properties
  const getPhaseData = (phase: string, field: string) => {
    if (plan[phase] && plan[phase][field] !== undefined) {
      return plan[phase][field];
    }
    // Fallback for flat structure if applicable or alternative naming
    return plan[field] || "---";
  };

  const parsePhaseData = (data: any) => {
    if (!data) return {};
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error("Error parsing phase data", e);
        return {};
      }
    }
    return data;
  };

  const f1 = parsePhaseData(plan.fase_1);
  const f2 = parsePhaseData(plan.fase_2);
  const f3 = parsePhaseData(plan.fase_3);
  const f4 = parsePhaseData(plan.fase_4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Resumen del Plan Nutricional
          </DialogTitle>
          <DialogDescription>
            Detalle de las 4 fases del plan: {plan.name}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="phase1" className="flex-1 overflow-hidden flex flex-col">
          <div className="px-1">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="phase1">Fase 1: Diagnóstico</TabsTrigger>
              <TabsTrigger value="phase2">Fase 2: Requerimientos</TabsTrigger>
              <TabsTrigger value="phase3">Fase 3: Distribución</TabsTrigger>
              <TabsTrigger value="phase4">Fase 4: Minuta</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 pr-4">
            {/* FASE 1 */}
            <TabsContent value="phase1" className="mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    Requerimiento Energético y Peso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Peso Actual</p>
                      <p className="font-semibold">{f1.peso_actual || plan.patient_weight || "---"} kg</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Altura</p>
                      <p className="font-semibold">{f1.altura || plan.patient_height || "---"} cm</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">IMC</p>
                      <p className="font-semibold">{f1.imc || "---"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">TMB</p>
                      <p className="font-semibold">{f1.tmb || "---"} kcal</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Factor Actividad</p>
                      <p className="font-semibold">{f1.factor_actividad || "---"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Peso Saludable</p>
                      <p className="font-semibold">{f1.peso_saludable || "---"} kg</p>
                    </div>
                    <div className="space-y-1 col-span-2 bg-primary/5 p-2 rounded-lg border border-primary/10">
                      <p className="text-xs text-primary font-bold uppercase">Requerimiento Energético Total</p>
                      <p className="text-xl font-bold text-primary">{f1.requerimiento_energetico || plan.calories || "---"} kcal</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* FASE 2 */}
            <TabsContent value="phase2" className="mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Fórmula Sintética (Distribución de Macros)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Resumen Tabla */}
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
                          <td className="p-2 text-center">{f2.proteinas_gramos_f2 || "---"}</td>
                          <td className="p-2 text-center">{f2.proteinas_calorias_f2 || "---"}</td>
                          <td className="p-2 text-center">{f2.proteinas_amdr_f2 || "---"}%</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-medium">Grasas</td>
                          <td className="p-2 text-center">{f2.grasas_gramos_f2 || "---"}</td>
                          <td className="p-2 text-center">{f2.grasas_calorias_f2 || "---"}</td>
                          <td className="p-2 text-center">{f2.grasas_amdr_f2 || "---"}%</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-medium">Carbohidratos</td>
                          <td className="p-2 text-center">{f2.cho_gramos_f2 || "---"}</td>
                          <td className="p-2 text-center">{f2.cho_calorias_f2 || "---"}</td>
                          <td className="p-2 text-center">{f2.cho_amdr_f2 || "---"}%</td>
                        </tr>
                        <tr className="bg-muted/50 font-bold">
                          <td className="p-2">Total</td>
                          <td className="p-2 text-center">---</td>
                          <td className="p-2 text-center">{f2.total_calorias_f2 || f1.requerimiento_energetico || "---"}</td>
                          <td className="p-2 text-center">100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <p className="text-xs text-blue-600 font-bold mb-1">Proteínas AVB</p>
                      <div className="flex justify-between text-sm">
                        <span>{f2.proteinas_avb_gramos || "0"} g</span>
                        <span className="font-bold">{f2.proteinas_avb_porcentaje || "0"}%</span>
                      </div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                      <p className="text-xs text-green-600 font-bold mb-1">Colesterol</p>
                      <div className="flex justify-between text-sm">
                        <span>{f2.grasas_colesterol || "0"} mg</span>
                      </div>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                      <p className="text-xs text-amber-600 font-bold mb-1">Fibra Total</p>
                      <div className="flex justify-between text-sm">
                        <span>{f2.total_fibra || "0"} g</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* FASE 3 */}
            <TabsContent value="phase3" className="mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Distribución por Grupos de Alimentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left font-bold min-w-[150px]">Grupo</th>
                          <th className="p-2 text-center font-bold">Porciones</th>
                          <th className="p-2 text-center font-bold">Kcal</th>
                          <th className="p-2 text-center font-bold">Prot</th>
                          <th className="p-2 text-center font-bold">Grasa</th>
                          <th className="p-2 text-center font-bold">CHOS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {GRUPOS_ALIMENTOS.map((grupo, idx) => {
                          const portions = f3.porciones_f3?.[grupo] || 0;
                          if (portions <= 0) return null; // Hide if 0 portions
                          
                          const nutrients = FOOD_NUTRIENTS[grupo as keyof typeof FOOD_NUTRIENTS];
                          return (
                            <tr key={idx} className="hover:bg-muted/50">
                              <td className="p-2 font-medium">{grupo}</td>
                              <td className="p-2 text-center font-bold bg-primary/5">{portions}</td>
                              <td className="p-2 text-center">{(portions * nutrients.energia).toFixed(0)}</td>
                              <td className="p-2 text-center">{(portions * nutrients.proteina).toFixed(1)}</td>
                              <td className="p-2 text-center">{(portions * nutrients.grasa).toFixed(1)}</td>
                              <td className="p-2 text-center">{(portions * nutrients.carbohidratos).toFixed(1)}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-muted/50 font-bold border-t-2 border-primary/20">
                          <td className="p-2">Totales Calculados</td>
                          <td className="p-2 text-center">---</td>
                          <td className="p-2 text-center">{f3.total_calorias_f3 || "---"}</td>
                          <td className="p-2 text-center">{f3.total_proteinas_f3 || "---"}</td>
                          <td className="p-2 text-center">{f3.total_grasas_f3 || "---"}</td>
                          <td className="p-2 text-center">{f3.total_chos_f3 || "---"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* FASE 4 */}
            <TabsContent value="phase4" className="mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-primary" />
                    Minuta Patrón y Detalles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                     {f4.observaciones && (
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <p className="text-xs font-bold text-yellow-800 uppercase mb-1">Observaciones Generales</p>
                        <p className="text-sm text-yellow-900">{f4.observaciones}</p>
                      </div>
                    )}

                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
                      <Utensils className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">
                        La visualización detallada de la minuta patrón se encuentra disponible en la vista de impresión o detalle del menú.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
