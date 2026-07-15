import { useState, useEffect, useMemo } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { API_URL } from "@/config/api";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Apple,
  Flame,
  Dumbbell,
  Clock,
  Calendar,
  User,
  Loader2,
  Eye,
  List,
  Utensils,
  Sparkles,
  Coffee,
  Cookie,
  Salad,
  Moon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ExchangeList } from "@/components/patient/ExchangeList";
import { formatInColombia, getColombiaDayOfWeek } from "@/lib/timezone";

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

const days = [
  { id: "lunes", label: "Lun", full: "Lunes" },
  { id: "martes", label: "Mar", full: "Martes" },
  { id: "miercoles", label: "Mié", full: "Miércoles" },
  { id: "jueves", label: "Jue", full: "Jueves" },
  { id: "viernes", label: "Vie", full: "Viernes" },
  { id: "sabado", label: "Sáb", full: "Sábado" },
  { id: "domingo", label: "Dom", full: "Domingo" },
];

function mealIcon(mealName: string) {
  const n = (mealName || "").toLowerCase();
  if (n.includes("desayuno") || n.includes("break")) return Coffee;
  if (n.includes("colación") || n.includes("snack") || n.includes("media")) return Cookie;
  if (n.includes("cena") || n.includes("dinner")) return Moon;
  if (n.includes("almuerzo") || n.includes("comida") || n.includes("lunch")) return Salad;
  return Utensils;
}

function mealTone(mealName: string) {
  const n = (mealName || "").toLowerCase();
  if (n.includes("desayuno") || n.includes("break")) {
    return "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400";
  }
  if (n.includes("colación") || n.includes("snack") || n.includes("media")) {
    return "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400";
  }
  if (n.includes("cena") || n.includes("dinner")) {
    return "from-indigo-500/15 to-indigo-500/5 text-indigo-600 dark:text-indigo-400";
  }
  if (n.includes("almuerzo") || n.includes("comida") || n.includes("lunch")) {
    return "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400";
  }
  return "from-primary/15 to-primary/5 text-primary";
}

function formatStartDate(value?: string) {
  if (!value) return "Pendiente";
  return formatInColombia(value) || value;
}

export default function MyPlan() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [currentWeekTab, setCurrentWeekTab] = useState("1");
  const [currentDay, setCurrentDay] = useState("lunes");

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

  useEffect(() => {
    const map = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    setCurrentDay(map[getColombiaDayOfWeek()]);
  }, []);

  const fetchPlanData = async () => {
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patient/${patientId}/plan/weekly`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error("Error al cargar el plan");
      const data = await response.json();
      setPlanData(data);
      if (data.current_week) {
        setCurrentWeekTab(data.current_week.toString());
      }
    } catch (error) {
      console.error("Error fetching plan:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar tu plan nutricional",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const dayMealCount = useMemo(() => {
    if (!planData?.has_plan) return 0;
    const active = planData.all_weeks
      ? planData.all_weeks[currentWeekTab]
      : planData.week_plan;
    if (!active) return 0;
    return Object.values(active).reduce((acc, meals) => acc + (meals?.length || 0), 0);
  }, [planData, currentWeekTab]);

  if (loading || isAuthLoading) {
    return (
      <PatientLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando tu plan nutricional…</p>
        </div>
      </PatientLayout>
    );
  }

  if (!planData || !planData.has_plan) {
    return (
      <PatientLayout>
        <div className="space-y-5 lg:space-y-7 animate-fade-in">
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.08] p-5 sm:p-6 shadow-card">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Panel del paciente
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Mi plan nutricional
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-xl">
                Aquí verás tu menú semanal, macros objetivo y lista de intercambios.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-16 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-4">
              <Apple className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">No tienes un plan activo</h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm">
              {planData?.message ||
                "Tu nutricionista aún no te ha asignado un plan de alimentación activo."}
            </p>
          </div>
        </div>
      </PatientLayout>
    );
  }

  const { plan_name, doctor, start_date, duration, stats, week_plan, all_weeks, message } = planData;
  const activeWeekData = all_weeks ? all_weeks[currentWeekTab] : week_plan;
  const availableWeeks = all_weeks
    ? Object.keys(all_weeks)
        .map(Number)
        .sort((a, b) => a - b)
    : [];

  const macros = [
    {
      label: "Calorías",
      value: stats?.calories?.target ?? 0,
      unit: "kcal",
      icon: Flame,
      tone: "from-orange-500/15 to-orange-500/5 text-orange-600 dark:text-orange-400",
    },
    {
      label: "Proteína",
      value: stats?.protein?.target ?? 0,
      unit: "g",
      icon: Dumbbell,
      tone: "from-primary/15 to-primary/5 text-primary",
    },
    {
      label: "Carbos",
      value: stats?.carbs?.target ?? 0,
      unit: "g",
      icon: Apple,
      tone: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Grasas",
      value: stats?.fat?.target ?? 0,
      unit: "g",
      icon: Salad,
      tone: "from-yellow-500/15 to-yellow-500/5 text-yellow-700 dark:text-yellow-400",
    },
  ];

  return (
    <PatientLayout>
      <div className="space-y-5 lg:space-y-7 animate-fade-in">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-emerald-500/[0.09] p-5 sm:p-6 shadow-card">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-14 left-1/4 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Panel del paciente
                </p>
                <Badge className="rounded-full border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] uppercase font-bold tracking-wide">
                  Plan activo
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {plan_name || "Mi plan nutricional"}
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-xl">
                Sigue tu menú semanal y guías de porciones para alcanzar tus metas.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
                  <User className="h-3.5 w-3.5 text-primary/70" />
                  {doctor || "Tu nutricionista"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
                  <Calendar className="h-3.5 w-3.5 text-primary/70" />
                  Inicio: {formatStartDate(start_date)}
                </span>
                {duration && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
                    <Clock className="h-3.5 w-3.5 text-primary/70" />
                    {duration}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-center backdrop-blur-sm min-w-[84px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Semana</p>
                <p className="text-lg font-bold tabular-nums text-foreground">{currentWeekTab}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-center backdrop-blur-sm min-w-[84px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Comidas</p>
                <p className="text-lg font-bold tabular-nums text-foreground">{dayMealCount}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-center backdrop-blur-sm min-w-[84px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Meta</p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {stats?.calories?.target ?? 0}
                </p>
                <p className="text-[9px] text-muted-foreground -mt-0.5">kcal</p>
              </div>
            </div>
          </div>
        </div>

        {/* Macro cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {macros.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card backdrop-blur-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {item.value}
                    <span className="text-sm font-medium text-muted-foreground ml-1">{item.unit}</span>
                  </p>
                </div>
                <div
                  className={`h-10 w-10 rounded-xl bg-gradient-to-br ${item.tone} flex items-center justify-center`}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {message && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3.5 flex items-start gap-3 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Apple className="h-4 w-4" />
            </div>
            <p className="text-sm text-primary font-medium pt-1.5">{message}</p>
          </div>
        )}

        {/* Main content */}
        <Card className="border-border/70 shadow-card overflow-hidden rounded-2xl">
          <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04]">
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Apple className="h-4 w-4" />
              </span>
              Tu plan nutricional
            </CardTitle>
            <CardDescription className="text-xs lg:text-sm mt-1">
              Explora tu menú semanal y la lista de intercambios
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 lg:p-5">
            <Tabs defaultValue="menu" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-5 h-11 bg-muted/50 p-1 rounded-full">
                <TabsTrigger
                  value="menu"
                  className="text-xs lg:text-sm font-semibold gap-2 rounded-full data-[state=active]:shadow-sm"
                >
                  <Utensils className="h-4 w-4" />
                  Menú semanal
                </TabsTrigger>
                <TabsTrigger
                  value="intercambios"
                  className="text-xs lg:text-sm font-semibold gap-2 rounded-full data-[state=active]:shadow-sm"
                >
                  <List className="h-4 w-4" />
                  Intercambios
                </TabsTrigger>
              </TabsList>

              <TabsContent value="menu" className="mt-0 space-y-5">
                {availableWeeks.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {availableWeeks.map((num) => {
                      const active = currentWeekTab === String(num);
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setCurrentWeekTab(String(num))}
                          className={`rounded-full px-4 py-2 text-xs font-semibold transition-all border ${
                            active
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted/40 text-muted-foreground border-border/70 hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          Semana {num}
                          {String(planData.current_week) === String(num) && (
                            <span className={`ml-1.5 ${active ? "opacity-80" : "text-primary"}`}>
                              · actual
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <Tabs value={currentDay} onValueChange={setCurrentDay} className="w-full">
                  <TabsList className="grid w-full grid-cols-7 mb-4 h-10 bg-muted/40 p-1 rounded-xl">
                    {days.map((day) => (
                      <TabsTrigger
                        key={day.id}
                        value={day.id}
                        className="text-[10px] lg:text-sm px-1 lg:px-3 rounded-lg data-[state=active]:shadow-sm"
                      >
                        {day.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {days.map((day) => {
                    const meals = activeWeekData?.[day.id] || [];
                    const dayCalories = meals.reduce((acc, m) => acc + (m.calories || 0), 0);

                    return (
                      <TabsContent key={day.id} value={day.id} className="space-y-3 mt-0">
                        <div className="flex items-center justify-between gap-2 px-1">
                          <p className="text-sm font-semibold text-foreground">{day.full}</p>
                          <span className="text-xs text-muted-foreground">
                            {meals.length} comida{meals.length === 1 ? "" : "s"} ·{" "}
                            <span className="font-semibold text-foreground tabular-nums">
                              {dayCalories} kcal
                            </span>
                          </span>
                        </div>

                        {meals.length > 0 ? (
                          meals.map((item, index) => {
                            const Icon = mealIcon(item.meal);
                            const tone = mealTone(item.meal);
                            return (
                              <div
                                key={`${day.id}-${index}`}
                                className="group flex items-center gap-3 p-3.5 lg:p-4 rounded-2xl border border-border/70 bg-gradient-to-br from-card to-muted/20 hover:border-primary/30 hover:shadow-md transition-all duration-200"
                              >
                                <div
                                  className={`flex h-11 w-11 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tone}`}
                                >
                                  <Icon className="h-5 w-5" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-foreground text-sm lg:text-base">
                                      {item.meal}
                                    </p>
                                    {item.time && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {item.time}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs lg:text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                    {item.food}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge
                                    variant="secondary"
                                    className="flex items-center gap-1 text-[10px] lg:text-xs rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-300 border-0"
                                  >
                                    <Flame className="h-3 w-3" />
                                    {item.calories} kcal
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={() => {
                                      setSelectedMeal(item);
                                      setIsDetailsOpen(true);
                                    }}
                                    title="Ver detalle"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-10 lg:py-12 text-muted-foreground rounded-2xl border border-dashed border-border bg-muted/15">
                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/70">
                              <Apple className="h-6 w-6 opacity-50" />
                            </div>
                            <p className="text-sm font-medium text-foreground">
                              {message
                                ? "Menú pendiente de carga"
                                : "No hay comidas programadas para este día"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Prueba otro día o semana del plan
                            </p>
                          </div>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </TabsContent>

              <TabsContent
                value="intercambios"
                className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <ExchangeList />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Objectives */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/15 to-orange-500/5 text-orange-600 dark:text-orange-400">
              <Flame className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Objetivo calórico
              </p>
              <p className="text-lg font-bold text-foreground tabular-nums">
                {stats?.calories?.target || 0}{" "}
                <span className="text-sm font-medium text-muted-foreground">kcal/día</span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Actividad física
              </p>
              <p className="text-lg font-bold text-foreground">Según tu perfil</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Duración
              </p>
              <p className="text-lg font-bold text-foreground">{duration || "N/A"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recipe Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md lg:max-w-2xl h-[90vh] sm:h-[85vh] overflow-hidden flex flex-col p-0 border-border/70 sm:rounded-2xl">
          <div className="relative h-32 shrink-0 bg-gradient-to-br from-primary/15 via-primary/5 to-background border-b border-border/50">
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
            <div className="absolute bottom-5 left-5 right-5">
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-primary font-bold text-[11px] uppercase tracking-wider mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    {selectedMeal?.meal}
                  </div>
                  <DialogTitle className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground line-clamp-2">
                    {selectedMeal?.food}
                  </DialogTitle>
                </div>
                <Badge className="mb-1 font-bold rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 border-0 px-3 py-1 shrink-0">
                  <Flame className="h-3 w-3 mr-1 inline" />
                  {selectedMeal?.calories} kcal
                </Badge>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0 px-5 sm:px-6">
            <div className="space-y-7 py-5 pb-10">
              {selectedMeal?.image && (
                <div className="group relative rounded-2xl overflow-hidden border border-border/60 shadow-md">
                  <div className="aspect-video w-full">
                    <img
                      src={selectedMeal.image}
                      alt={selectedMeal.food}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).parentElement?.parentElement?.style.setProperty(
                          "display",
                          "none"
                        );
                      }}
                    />
                  </div>
                </div>
              )}

              {selectedMeal?.time && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Horario sugerido: {selectedMeal.time}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                    <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                      <List className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-foreground tracking-tight">Ingredientes</h3>
                  </div>

                  {selectedMeal?.ingredients && selectedMeal.ingredients.length > 0 ? (
                    <div className="grid gap-2.5">
                      {selectedMeal.ingredients.map((ingredient, idx) => {
                        const isObject = typeof ingredient === "object" && ingredient !== null;
                        const name = isObject
                          ? (ingredient as { name?: string }).name
                          : ingredient;

                        let amount: string | number | null = null;
                        if (isObject) {
                          const ing = ingredient as Record<string, unknown>;
                          amount = (ing.portion ||
                            ing.grams ||
                            ing.cantidad ||
                            ing.amount ||
                            ing.quantity) as string | number | null;
                        }

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-1.5 w-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors shrink-0" />
                              <span className="text-sm font-semibold text-foreground/80 group-hover:text-foreground capitalize leading-tight truncate">
                                {String(name ?? "")}
                              </span>
                            </div>
                            {amount != null && amount !== "" && (
                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase font-bold px-2 py-0 border-primary/20 text-primary bg-primary/10 shrink-0 ml-2"
                              >
                                {String(amount)}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 bg-muted/20 rounded-2xl border border-dashed border-border/50 text-center px-4">
                      <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                        <List className="h-6 w-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        No hay ingredientes listados.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Utensils className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-foreground tracking-tight">Preparación</h3>
                  </div>

                  {selectedMeal?.instructions && selectedMeal.instructions.length > 0 ? (
                    <div className="space-y-3.5">
                      {selectedMeal.instructions.map((step, idx) => (
                        <div key={idx} className="flex gap-3.5 group">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-bold shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
                            {idx + 1}
                          </span>
                          <p className="text-sm leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors pt-0.5 font-medium">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 bg-muted/20 rounded-2xl border border-dashed border-border/50 text-center px-4">
                      <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                        <Utensils className="h-6 w-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        No hay pasos disponibles.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="shrink-0 p-4 border-t border-border bg-background/95 flex justify-end">
            <Button className="rounded-full px-6" onClick={() => setIsDetailsOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
}
