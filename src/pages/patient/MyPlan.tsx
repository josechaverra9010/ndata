import { useState, useEffect } from 'react';
import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Apple, Flame, Dumbbell, Clock, Calendar, User, Loader2, Eye, ChefHat, List, Utensils } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ExchangeList } from "@/components/patient/ExchangeList";

interface Meal {
  meal: string;
  food: string;
  calories: number;
  time: string;
  ingredients?: string[];
  instructions?: string[];
  image?: string;
}

interface PlanData {
  has_plan: boolean;
  plan_name?: string;
  doctor?: string;
  start_date?: string;
  duration?: string;
  stats?: {
    calories: { target: number };
    protein: { target: number };
    carbs: { target: number };
    fat: { target: number };
  };
  week_plan?: {
    [key: string]: Meal[];
  };
  all_weeks?: {
    [key: string]: {
      [key: string]: Meal[];
    };
  };
  current_week?: number;
  message?: string;
}

export default function MyPlan() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [currentWeekTab, setCurrentWeekTab] = useState("1");

  const { user, isLoading: isAuthLoading } = useAuth();
  const patientId = user?.id;

  useEffect(() => {
    if (!isAuthLoading) {
      if (patientId) {
        fetchPlanData();
      } else {
        setLoading(false);
      }
    }
  }, [isAuthLoading, patientId]);

  const fetchPlanData = async () => {
    try {
      const response = await fetch(`${API_URL}/patient/${patientId}/plan/weekly`);
      if (!response.ok) throw new Error('Error al cargar el plan');
      const data = await response.json();
      setPlanData(data);
      if (data.current_week) {
        setCurrentWeekTab(data.current_week.toString());
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar tu plan nutricional",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  if (!planData || !planData.has_plan) {
    return (
      <PatientLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Card className="p-8 text-center max-w-md border-border shadow-card">
            <Apple className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-bold">No tienes un plan activo</h2>
            <p className="text-muted-foreground mt-2">
              {planData?.message || "Tu nutricionista aún no te ha asignado un plan de alimentación activo."}
            </p>
          </Card>
        </div>
      </PatientLayout>
    );
  }

  const { plan_name, doctor, start_date, duration, stats, week_plan, all_weeks, message } = planData;

  // Determinar qué datos mostrar según la semana seleccionada
  const activeWeekData = all_weeks ? all_weeks[currentWeekTab] : week_plan;

  const days = [
    { id: "lunes", label: "Lun" },
    { id: "martes", label: "Mar" },
    { id: "miercoles", label: "Mié" },
    { id: "jueves", label: "Jue" },
    { id: "viernes", label: "Vie" },
    { id: "sabado", label: "Sáb" },
    { id: "domingo", label: "Dom" },
  ];

  return (
    <PatientLayout>
      <div className="space-y-4 lg:space-y-6 animate-fade-in">
        {/* Plan Header */}
        <Card className="border-border shadow-card overflow-hidden">
          <div className="gradient-primary p-4 lg:p-6 text-primary-foreground">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <Badge className="bg-white/20 text-white border-0 mb-2 lg:mb-3 text-[10px] lg:text-xs uppercase tracking-wider font-bold">Plan Activo</Badge>
                <h1 className="text-lg lg:text-2xl font-bold">{plan_name}</h1>
                <p className="text-xs lg:text-sm opacity-90 mt-1">Sigue tu guía para alcanzar tus metas</p>
              </div>
              <div className="text-left sm:text-right">
                <div className="flex items-center gap-2 text-xs lg:text-sm opacity-90 sm:justify-end">
                  <User className="h-3 w-3 lg:h-4 lg:w-4" />
                  {doctor || "Tu Nutricionista"}
                </div>
                <div className="flex items-center gap-2 text-xs lg:text-sm opacity-90 mt-1 sm:justify-end">
                  <Calendar className="h-3 w-3 lg:h-4 lg:w-4" />
                  Inicio: {start_date || "Pendiente"}
                </div>
              </div>
            </div>
          </div>
          <CardContent className="p-3 lg:p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
              <div className="text-center p-2 lg:p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] lg:text-sm text-muted-foreground uppercase font-medium">Calorías Meta</p>
                <p className="text-base lg:text-2xl font-bold text-foreground mt-1">
                  {stats?.calories?.target || 0}<span className="text-[10px] lg:text-sm font-normal text-muted-foreground"> kcal</span>
                </p>
              </div>
              <div className="text-center p-2 lg:p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] lg:text-sm text-muted-foreground uppercase font-medium">Proteína</p>
                <p className="text-base lg:text-2xl font-bold text-foreground mt-1">
                  {stats?.protein?.target || 0}g
                </p>
              </div>
              <div className="text-center p-2 lg:p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] lg:text-sm text-muted-foreground uppercase font-medium">Carbos</p>
                <p className="text-base lg:text-2xl font-bold text-foreground mt-1">
                  {stats?.carbs?.target || 0}g
                </p>
              </div>
              <div className="text-center p-2 lg:p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] lg:text-sm text-muted-foreground uppercase font-medium">Grasas</p>
                <p className="text-base lg:text-2xl font-bold text-foreground mt-1">
                  {stats?.fat?.target || 0}g
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Message */}
        {message && (
          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Apple className="h-4 w-4" />
              </div>
              <p className="text-sm text-primary font-medium">{message}</p>
            </CardContent>
          </Card>
        )}

        {/* Weekly Plan & Exchange List Tabs */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-3 lg:pb-6">
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <Apple className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
              Tu Plan Nutricional
            </CardTitle>
            <CardDescription className="text-xs lg:text-sm">Explora tu menú y guías de porciones</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="menu" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 lg:mb-6 h-10 lg:h-12 bg-muted/50 p-1">
                <TabsTrigger value="menu" className="text-xs lg:text-sm font-bold gap-2">
                  <Apple className="h-4 w-4" />
                  Menú Semanal
                </TabsTrigger>
                <TabsTrigger value="intercambios" className="text-xs lg:text-sm font-bold gap-2">
                  <Clock className="h-4 w-4" />
                  Lista de Intercambios
                </TabsTrigger>
              </TabsList>

              <TabsContent value="menu" className="mt-0 space-y-4 lg:space-y-6">

                {/* Week Selector */}
                {all_weeks && Object.keys(all_weeks).length > 1 && (
                  <Tabs value={currentWeekTab} onValueChange={setCurrentWeekTab} className="w-full mb-4">
                    <TabsList className="grid w-full grid-cols-4">
                      {[1, 2, 3, 4].map(num => (
                        <TabsTrigger key={num} value={num.toString()} disabled={!all_weeks[num.toString()]}>
                          Semana {num}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                )}

                <Tabs defaultValue="lunes" className="w-full">
                  <TabsList className="grid w-full grid-cols-7 mb-4 lg:mb-6 h-8 lg:h-10">
                    {days.map(day => (
                      <TabsTrigger key={day.id} value={day.id} className="text-[10px] lg:text-sm px-1 lg:px-3">
                        {day.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {days.map(day => (
                    <TabsContent key={day.id} value={day.id} className="space-y-2 lg:space-y-3">
                      {activeWeekData && activeWeekData[day.id] && activeWeekData[day.id].length > 0 ? (
                        activeWeekData[day.id].map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 lg:p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all duration-200"
                          >
                            <div className="flex items-center gap-2 lg:gap-4 min-w-0">
                              <div className="flex h-8 w-8 lg:h-10 lg:w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Clock className="h-4 w-4 lg:h-5 lg:w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground text-sm lg:text-base">{item.meal}</p>
                                <p className="text-xs lg:text-sm text-muted-foreground line-clamp-2">{item.food}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                              <Badge variant="secondary" className="flex items-center gap-1 text-[10px] lg:text-xs bg-accent/10 text-accent-foreground border-accent/20">
                                <Flame className="h-3 w-3" />
                                {item.calories} kcal
                              </Badge>
                              <span className="text-[10px] text-muted-foreground font-medium">{item.time}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 ml-2 text-muted-foreground hover:text-primary"
                              onClick={() => {
                                setSelectedMeal(item);
                                setIsDetailsOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>

                        ))
                      ) : (
                        <div className="text-center py-8 lg:py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
                          <Apple className="h-10 w-10 lg:h-12 lg:w-12 mx-auto mb-2 lg:mb-3 opacity-30" />
                          <p className="text-xs lg:text-sm font-medium">
                            {message ? "Menú pendiente de carga" : "No hay comidas programadas para este día"}
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </TabsContent>

              <TabsContent value="intercambios" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <ExchangeList />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Objectives */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
          <Card className="border-border shadow-card hover:border-primary/30 transition-colors">
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Flame className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate font-medium">OBJETIVO CALÓRICO</p>
                  <p className="text-base lg:text-xl font-bold text-foreground">{stats?.calories?.target || 0} kcal/día</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-card hover:border-accent/30 transition-colors">
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                  <Dumbbell className="h-5 w-5 lg:h-6 lg:w-6 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate font-medium">ACTIVIDAD FÍSICA</p>
                  <p className="text-base lg:text-xl font-bold text-foreground">Según tu perfil</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-card hover:border-info/30 transition-colors">
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-info/10">
                  <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-info" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate font-medium">DURACIÓN</p>
                  <p className="text-base lg:text-xl font-bold text-foreground">{duration || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Recipe Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md lg:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ChefHat className="h-5 w-5 text-primary" />
              {selectedMeal?.food}
            </DialogTitle>
            <DialogDescription>
              {selectedMeal?.meal} - {selectedMeal?.calories} kcal
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="space-y-6 py-4">
              {selectedMeal?.image && (
                <div className="rounded-xl overflow-hidden border border-border shadow-sm aspect-video w-full">
                  <img
                    src={selectedMeal.image}
                    alt={selectedMeal.food}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Ingredients */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-primary">
                    <List className="h-4 w-4" />
                    Ingredientes
                  </h3>
                  {selectedMeal?.ingredients && selectedMeal.ingredients.length > 0 ? (
                    <ul className="space-y-2">
                      {selectedMeal.ingredients.map((ingredient, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2 text-muted-foreground bg-muted/30 p-2 rounded-lg">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                          {ingredient}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-muted-foreground italic bg-muted/10 p-4 rounded-lg border border-dashed text-center">
                      No hay ingredientes registrados para esta preparación.
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-primary">
                    <Utensils className="h-4 w-4" />
                    Instrucciones
                  </h3>
                  {selectedMeal?.instructions && selectedMeal.instructions.length > 0 ? (
                    <div className="space-y-3">
                      {selectedMeal.instructions.map((step, idx) => (
                        <div key={idx} className="flex gap-3 text-sm group">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            {idx + 1}
                          </span>
                          <p className="text-muted-foreground pt-0.5">{step}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic bg-muted/10 p-4 rounded-lg border border-dashed text-center">
                      No hay instrucciones detalladas disponibles.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </PatientLayout >
  );
}
