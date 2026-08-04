import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { PatientLayout } from "@/layouts/PatientLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Apple,
  Flame,
  Target,
  Calendar,
  TrendingUp,
  Clock,
  Plus,
  Minus,
  Loader2,
  Activity,
  Sparkles,
  ArrowRight,
  Lightbulb,
  Scale,
  Trophy,
  GraduationCap,
  HeartPulse,
  Building2,
  Camera,
  ArrowRightLeft,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { MealCard } from "@/components/patient/MealCard";
import { MealDetailDialog } from "@/components/patient/MealDetailDialog";
import { todayInColombiaISO, todayLabelColombia } from "@/lib/timezone";

interface DashboardStats {
  calories: {
    consumed: number;
    target: number;
    percentage: number;
  };
  edad_formateada?: string;
  peso_actual?: number;
  altura?: number;
  water: {
    consumed_ml: number;
    consumed_liters: number;
    target_ml: number;
    target_liters: number;
    percentage: number;
  };
  meals: {
    completed: number;
    total: number;
    percentage: number;
  };
  weekly_goal: {
    percentage: number;
    change: number;
    trend: string;
  };
  macronutrients?: {
    protein_percentage: number;
    carbs_percentage: number;
    fat_percentage: number;
    protein_grams: number;
    carbs_grams: number;
    fat_grams: number;
  };
}

interface Meal {
  name: string;
  time: string;
  calories: number;
  completed: boolean;
  description: string;
  protein?: number;
  carbs?: number;
  fat?: number;
  meal_type: string;
  ingredients?: string[];
  instructions?: string[];
  image?: string;
  recipe_id?: number;
  meal?: string;
  receta?: string;
  food?: string;
  calorias?: number;
}

interface WeekDay {
  day: string;
  date: string;
  completed: boolean;
}

interface NextAppointment {
  doctor: string;
  type: string;
  date: string;
  time: string;
  status: string;
}

interface DashboardData {
  stats: DashboardStats;
  today_meals: Meal[];
  week_progress: WeekDay[];
  next_appointment: NextAppointment | null;
  tip_of_day: string;
}

function imcCategory(imc: number) {
  if (imc < 18.5) {
    return {
      label: "Bajo peso",
      className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-transparent",
    };
  }
  if (imc < 25) {
    return {
      label: "Peso normal",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
    };
  }
  if (imc < 30) {
    return {
      label: "Sobrepeso",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent",
    };
  }
  return {
    label: "Obesidad",
    className: "bg-destructive/15 text-destructive border-transparent",
  };
}

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingMeal, setUpdatingMeal] = useState<string | null>(null);
  const [addingWater, setAddingWater] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [mealDetailForModal, setMealDetailForModal] = useState<Meal | null>(null);
  const [loadingMealDetail, setLoadingMealDetail] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [nextAction, setNextAction] = useState<{ label: string; path: string } | null>(null);

  const { user, isLoading: isAuthLoading } = useAuth();
  const patientId = user?.id;
  const firstName = (user as { nombres?: string } | null)?.nombres?.split(" ")[0] || "bienvenido/a";

  const todayLabel = useMemo(() => todayLabelColombia(), []);

  useEffect(() => {
    if (!isDetailsOpen || !selectedMeal) {
      setMealDetailForModal(null);
      setLoadingMealDetail(false);
      return;
    }
    const rid = selectedMeal.recipe_id;
    if (!rid) {
      setMealDetailForModal(selectedMeal);
      setLoadingMealDetail(false);
      return;
    }
    setLoadingMealDetail(true);
    setMealDetailForModal(selectedMeal);
    let cancelled = false;
    const token = localStorage.getItem("userToken");
    fetch(`${API_URL}/recipes/${rid}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          recipe: {
            name?: string;
            ingredients?: string[];
            instructions?: string[];
            image?: string;
            Ingredients?: string[];
            Instructions?: string[];
          } | null
        ) => {
          if (cancelled) return;
          setLoadingMealDetail(false);
          if (recipe) {
            const ing = recipe.ingredients ?? recipe.Ingredients;
            const inst = recipe.instructions ?? recipe.Instructions;
            setMealDetailForModal({
              ...selectedMeal,
              receta: recipe.name ?? selectedMeal.receta,
              food: recipe.name ?? selectedMeal.food,
              description: recipe.name ?? selectedMeal.description,
              ingredients: Array.isArray(ing) ? ing : selectedMeal.ingredients ?? [],
              instructions: Array.isArray(inst) ? inst : selectedMeal.instructions ?? [],
              image: recipe.image ?? selectedMeal.image,
            });
          }
        }
      )
      .catch(() => {
        if (!cancelled) setLoadingMealDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDetailsOpen, selectedMeal]);

  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return "";
    if (imagePath.startsWith("http")) return imagePath;
    const base = API_URL.replace("/api", "");
    return `${base}${imagePath}`;
  };

  useEffect(() => {
    if (isDetailsOpen && !selectedMeal) {
      setIsDetailsOpen(false);
    }
  }, [isDetailsOpen, selectedMeal]);

  useEffect(() => {
    if (dashboardData?.today_meals.length === 0 && isDetailsOpen) {
      setIsDetailsOpen(false);
    }
  }, [dashboardData, isDetailsOpen]);

  useEffect(() => {
    if (!isAuthLoading && patientId) {
      fetchDashboardData();
    }
  }, [isAuthLoading, patientId]);

  useEffect(() => {
    if (!isAuthLoading && patientId) {
      const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isAuthLoading, patientId]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("userToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [dashRes, adherenceRes] = await Promise.all([
        fetch(`${API_URL}/patient/${patientId}/dashboard/complete`, { headers }),
        fetch(`${API_URL}/patient/${patientId}/adherence?days=7`, { headers }),
      ]);

      if (!dashRes.ok) throw new Error("Error al cargar datos");

      const data = await dashRes.json();
      setDashboardData(data);

      if (adherenceRes.ok) {
        const adherence = await adherenceRes.json();
        if (adherence?.next_action) {
          setNextAction(adherence.next_action);
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMeal = async (meal: Meal) => {
    setUpdatingMeal(meal.meal_type);

    try {
      const token = localStorage.getItem("userToken");
      const endpoint = meal.completed ? "uncomplete" : "complete";
      const response = await fetch(`${API_URL}/tracking/meal-toggle/${patientId}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          meal_type: meal.meal_type,
          date: todayInColombiaISO(),
        }),
      });

      if (!response.ok) throw new Error("Error al actualizar comida");

      await fetchDashboardData();

      toast({
        title: meal.completed ? "Comida desmarcada" : "¡Comida completada!",
        description: `${meal.name} ${meal.completed ? "desmarcada" : "marcada como completada"}`,
      });
    } catch (error) {
      console.error("Error toggling meal:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la comida",
        variant: "destructive",
      });
    } finally {
      setUpdatingMeal(null);
    }
  };

  const adjustWater = async (glassMl: number) => {
    setAddingWater(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patient/${patientId}/water/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ glass_ml: glassMl }),
      });

      if (!response.ok) throw new Error("Error al actualizar agua");

      const data = await response.json();

      if (dashboardData) {
        setDashboardData({
          ...dashboardData,
          stats: {
            ...dashboardData.stats,
            water: {
              consumed_ml: data.amount_ml,
              consumed_liters: data.amount_liters,
              target_ml: data.target_ml,
              target_liters: dashboardData.stats.water.target_liters,
              percentage: data.percentage,
            },
          },
        });
      }

      toast({
        title: glassMl > 0 ? "¡Agua agregada!" : "Agua actualizada",
        description: `${glassMl > 0 ? "+" : ""}${glassMl}ml • Total: ${data.amount_liters} L`,
      });
    } catch (error) {
      console.error("Error updating water:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el agua",
        variant: "destructive",
      });
    } finally {
      setAddingWater(false);
    }
  };

  const handleUpdateWeight = async () => {
    if (!newWeight || isNaN(parseFloat(newWeight))) {
      return toast({
        title: "Error",
        description: "Ingresa un peso válido",
        variant: "destructive",
      });
    }

    setSavingWeight(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/profile/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email: user?.email, peso_actual: parseFloat(newWeight) }),
      });

      if (response.ok) {
        toast({ title: "¡Éxito!", description: "Peso actualizado correctamente" });
        setIsWeightDialogOpen(false);
        fetchDashboardData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el peso",
        variant: "destructive",
      });
    } finally {
      setSavingWeight(false);
    }
  };

  return (
    <PatientLayout>
      <LoadingGate loading={loading || isAuthLoading} message="Cargando tu dashboard" className="min-h-[60vh]">
        {!dashboardData ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className="max-w-md w-full rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
              <p className="font-semibold text-foreground">No se pudieron cargar los datos</p>
              <p className="text-sm text-muted-foreground mt-2">
                Revisa tu conexión e inténtalo de nuevo.
              </p>
              <Button className="mt-5 rounded-full" onClick={fetchDashboardData}>
                Reintentar
              </Button>
            </div>
          </div>
        ) : (
          <DashboardContent
            dashboardData={dashboardData}
            nextAction={nextAction}
            navigate={navigate}
            firstName={firstName}
            todayLabel={todayLabel}
            patientId={patientId!}
            user={user}
            updatingMeal={updatingMeal}
            addingWater={addingWater}
            selectedMeal={selectedMeal}
            mealDetailForModal={mealDetailForModal}
            loadingMealDetail={loadingMealDetail}
            isDetailsOpen={isDetailsOpen}
            isWeightDialogOpen={isWeightDialogOpen}
            newWeight={newWeight}
            savingWeight={savingWeight}
            setSelectedMeal={setSelectedMeal}
            setIsDetailsOpen={setIsDetailsOpen}
            setIsWeightDialogOpen={setIsWeightDialogOpen}
            setNewWeight={setNewWeight}
            handleToggleMeal={handleToggleMeal}
            handleAddWater={handleAddWater}
            handleUpdateWeight={handleUpdateWeight}
            getImageUrl={getImageUrl}
            toast={toast}
          />
        )}
      </LoadingGate>
    </PatientLayout>
  );
}

function DashboardContent({
  dashboardData,
  nextAction,
  navigate,
  firstName,
  todayLabel,
  patientId,
  user,
  updatingMeal,
  addingWater,
  selectedMeal,
  mealDetailForModal,
  loadingMealDetail,
  isDetailsOpen,
  isWeightDialogOpen,
  newWeight,
  savingWeight,
  setSelectedMeal,
  setIsDetailsOpen,
  setIsWeightDialogOpen,
  setNewWeight,
  handleToggleMeal,
  handleAddWater,
  handleUpdateWeight,
  getImageUrl,
  toast,
}: any) {
  const { stats, today_meals, week_progress, next_appointment, tip_of_day } = dashboardData;
  const peso =
    stats.peso_actual ?? (user as { peso_actual?: number } | null)?.peso_actual ?? null;
  const altura = stats.altura ?? (user as { altura?: number } | null)?.altura ?? null;
  const imcValue =
    peso && altura
      ? (() => {
          const h = altura > 3 ? altura / 100 : altura;
          return peso / (h * h);
        })()
      : null;
  const imcMeta = imcValue != null ? imcCategory(imcValue) : null;
  const weekCompleted = week_progress.filter((d) => d.completed).length;

  const macros = [
    {
      label: "Proteínas",
      pct: stats.macronutrients?.protein_percentage ?? 30,
      grams: stats.macronutrients?.protein_grams ?? 0,
      bar: "bg-gradient-to-r from-sky-500 to-sky-400",
      dot: "bg-sky-500",
    },
    {
      label: "Carbohidratos",
      pct: stats.macronutrients?.carbs_percentage ?? 45,
      grams: stats.macronutrients?.carbs_grams ?? 0,
      bar: "bg-gradient-to-r from-amber-500 to-amber-400",
      dot: "bg-amber-500",
    },
    {
      label: "Grasas",
      pct: stats.macronutrients?.fat_percentage ?? 25,
      grams: stats.macronutrients?.fat_grams ?? 0,
      bar: "bg-gradient-to-r from-emerald-500 to-emerald-400",
      dot: "bg-emerald-500",
    },
  ];

  return (
    <>
      <div className="space-y-5 lg:space-y-7 animate-fade-in">
        {nextAction && (
          <button
            type="button"
            onClick={() => navigate(nextAction.path)}
            className="w-full flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-left hover:bg-primary/10 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Activity className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate">{nextAction.label}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-primary shrink-0" />
          </button>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { icon: Trophy, label: "Retos", path: "/patient/challenges" },
            { icon: GraduationCap, label: "Aprender", path: "/patient/learn" },
            { icon: Camera, label: "Diario", path: "/patient/food-diary" },
            { icon: ArrowRightLeft, label: "Sustituir", path: "/patient/substitutions" },
            { icon: HeartPulse, label: "Bienestar", path: "/patient/habits" },
            { icon: Building2, label: "Mi Programa", path: "/patient/program" },
          ].map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border/70 bg-card p-3 hover:border-primary/30 hover:bg-primary/[0.03] transition-colors"
            >
              <item.icon className="h-5 w-5 text-primary" />
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.08] p-5 sm:p-6 shadow-card">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-14 left-1/4 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Panel del paciente
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground capitalize">
                Hola, {firstName}
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-xl capitalize">
                {todayLabel}. Aquí tienes tu resumen del día.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {stats.edad_formateada && (
                  <Badge className="rounded-full border-0 bg-primary/10 text-primary text-[10px] uppercase font-bold tracking-wide">
                    <Clock className="h-3 w-3 mr-1.5" />
                    {stats.edad_formateada}
                  </Badge>
                )}
                <Badge variant="secondary" className="rounded-full tabular-nums">
                  {stats.meals.completed}/{stats.meals.total} comidas
                </Badge>
                <Badge variant="outline" className="rounded-full tabular-nums">
                  {stats.calories.consumed}/{stats.calories.target} kcal
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-full gap-2"
                onClick={() => {
                  setNewWeight(peso ? String(peso) : "");
                  setIsWeightDialogOpen(true);
                }}
              >
                <Scale className="h-4 w-4" />
                Actualizar peso
              </Button>
              <Button
                className="rounded-full gap-2"
                onClick={() => navigate("/patient/my-plan")}
              >
                Ver mi plan
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card backdrop-blur-sm relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-500 to-amber-400" />
            <div className="pl-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  Calorías hoy
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {stats.calories.consumed}
                </p>
                <p className="text-xs text-muted-foreground">de {stats.calories.target} kcal</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500/15 to-orange-500/5 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <Flame className="h-[18px] w-[18px]" />
              </div>
            </div>
            <Progress value={Math.min(100, stats.calories.percentage)} className="mt-3 h-1.5" />
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card backdrop-blur-sm relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-sky-500 to-cyan-400" />
            <div className="pl-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  Agua
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {stats.water.consumed_liters}
                  <span className="text-sm font-medium text-muted-foreground ml-0.5">L</span>
                </p>
                <p className="text-xs text-muted-foreground">Meta: {stats.water.target_liters}L</p>
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => adjustWater(-250)}
                  disabled={addingWater || stats.water.consumed_ml <= 0}
                  className="h-8 w-8 rounded-lg bg-destructive/5 hover:bg-destructive/10 text-destructive"
                  title="Quitar 250ml"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => adjustWater(250)}
                  disabled={addingWater}
                  className="h-8 w-8 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400"
                  title="Agregar 250ml"
                >
                  {addingWater ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <Progress value={Math.min(100, stats.water.percentage)} className="mt-3 h-1.5" />
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card backdrop-blur-sm relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-emerald-400" />
            <div className="pl-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  Comidas
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {stats.meals.completed}/{stats.meals.total}
                </p>
                <p className="text-xs text-muted-foreground">completadas hoy</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center">
                <Apple className="h-[18px] w-[18px]" />
              </div>
            </div>
            <Progress value={Math.min(100, stats.meals.percentage)} className="mt-3 h-1.5" />
          </div>

          <div
            className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card backdrop-blur-sm relative overflow-hidden cursor-pointer hover:border-emerald-500/30 transition-colors"
            onClick={() => navigate("/patient/adherence")}
            onKeyDown={(e) => e.key === "Enter" && navigate("/patient/adherence")}
            role="button"
            tabIndex={0}
          >
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 to-lime-400" />
            <div className="pl-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  Adherencia
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {stats.weekly_goal.percentage}%
                </p>
                <p
                  className={`text-xs flex items-center gap-1 ${
                    stats.weekly_goal.change >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  }`}
                >
                  <TrendingUp
                    className={`h-3 w-3 ${stats.weekly_goal.change < 0 ? "rotate-180" : ""}`}
                  />
                  {stats.weekly_goal.change >= 0 ? "+" : ""}
                  {stats.weekly_goal.change}%
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Target className="h-[18px] w-[18px]" />
              </div>
            </div>
            <Progress value={Math.min(100, stats.weekly_goal.percentage)} className="mt-3 h-1.5" />
          </div>
        </div>

        {/* Progress + macros */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
          <Card className="border-border/70 shadow-card overflow-hidden rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    Progreso semanal
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {weekCompleted} de {week_progress.length} días completados
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="rounded-full tabular-nums">
                  {week_progress.length
                    ? Math.round((weekCompleted / week_progress.length) * 100)
                    : 0}
                  %
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 lg:p-5 space-y-3.5">
              {week_progress.map((day, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{day.day}</span>
                    <span className="text-xs text-muted-foreground">{day.date}</span>
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        day.completed
                          ? "bg-gradient-to-r from-primary to-emerald-500 w-full"
                          : "bg-muted-foreground/15 w-0"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-card overflow-hidden rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-amber-500/[0.04]">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Activity className="h-4 w-4" />
                </span>
                Macronutrientes
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Distribución de tu meta diaria
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 lg:p-5 space-y-4">
              {macros.map((m) => (
                <div key={m.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
                      <span className="font-medium text-foreground">{m.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-foreground tabular-nums">{m.pct}%</span>
                      <span className="text-muted-foreground tabular-nums">({m.grams}g)</span>
                    </div>
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${m.bar} transition-all duration-700`}
                      style={{ width: `${Math.max(0, Math.min(100, m.pct))}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Meta diaria de calorías</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {stats.calories.target > 0
                    ? `${stats.calories.target} kcal`
                    : "Sin meta asignada"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
          {/* Today's Meals */}
          <Card className="lg:col-span-2 border-border/70 shadow-card overflow-hidden rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Apple className="h-4 w-4" />
                    </span>
                    Comidas de hoy
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Marca lo que ya comiste
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="rounded-full tabular-nums">
                  {stats.meals.completed}/{stats.meals.total}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 lg:p-5 space-y-3">
              {today_meals.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-muted/15">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/70 mx-auto mb-3 ring-1 ring-border/50">
                    <Apple className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-base font-medium text-foreground mb-1">
                    No tienes comidas programadas hoy
                  </p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Consulta con tu nutricionista para asignar un plan
                  </p>
                  <Button
                    className="mt-4 rounded-full"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/patient/my-plan")}
                  >
                    Ir a mi plan
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {today_meals.map((meal, index) => (
                    <MealCard
                      key={`${meal.meal_type}-${index}`}
                      meal={meal}
                      onToggle={() => handleToggleMeal(meal)}
                      onViewDetails={() => {
                        setSelectedMeal(meal);
                        setIsDetailsOpen(true);
                      }}
                      isUpdating={updatingMeal === meal.meal_type}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Side Panel */}
          <div className="space-y-4 lg:space-y-5">
            {/* IMC */}
            <Card className="border-border/70 shadow-card overflow-hidden rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-violet-500/[0.04]">
                <CardTitle className="flex items-center gap-2 text-sm lg:text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Target className="h-4 w-4" />
                  </span>
                  IMC
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {imcValue != null && imcMeta ? (
                  <div className="flex flex-col items-center text-center gap-2">
                    <p className="text-3xl font-bold tabular-nums text-foreground">
                      {imcValue.toFixed(1)}
                      <span className="text-sm font-medium text-muted-foreground ml-1">
                        kg/m²
                      </span>
                    </p>
                    <Badge className={`rounded-full ${imcMeta.className}`}>{imcMeta.label}</Badge>
                    {peso != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Peso actual:{" "}
                        <span className="font-semibold text-foreground">{peso} kg</span>
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 rounded-full text-xs"
                      onClick={() => {
                        setNewWeight(peso ? String(peso) : "");
                        setIsWeightDialogOpen(true);
                      }}
                    >
                      Actualizar peso
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground">
                      Completa tu perfil (peso y altura) para ver tu IMC
                    </p>
                    <Button
                      size="sm"
                      className="mt-3 rounded-full"
                      variant="outline"
                      onClick={() => setIsWeightDialogOpen(true)}
                    >
                      Registrar peso
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Week dots */}
            <Card className="border-border/70 shadow-card overflow-hidden rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="flex items-center gap-2 text-sm lg:text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Calendar className="h-4 w-4" />
                  </span>
                  Esta semana
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex justify-between gap-1">
                  {week_progress.map((day, index) => (
                    <div key={index} className="flex flex-col items-center gap-1.5 flex-1">
                      <div
                        className={`h-9 w-9 lg:h-10 lg:w-10 rounded-xl flex items-center justify-center text-xs lg:text-sm font-semibold transition-colors ${
                          day.completed
                            ? "bg-gradient-to-br from-primary to-emerald-500 text-primary-foreground shadow-sm"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {day.completed ? "✓" : day.day.charAt(0)}
                      </div>
                      <span className="text-[10px] lg:text-xs text-muted-foreground">
                        {day.day}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Next Appointment */}
            <Card className="border-border/70 shadow-card overflow-hidden rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-sky-500/[0.04]">
                <CardTitle className="flex items-center gap-2 text-sm lg:text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <Calendar className="h-4 w-4" />
                  </span>
                  Próxima cita
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {next_appointment ? (
                  <button
                    type="button"
                    onClick={() => navigate("/patient/appointments")}
                    className="w-full text-left p-3.5 rounded-2xl bg-gradient-to-br from-primary/8 to-transparent border border-primary/20 hover:border-primary/40 hover:shadow-sm transition-all"
                  >
                    <p className="font-semibold text-foreground text-sm">{next_appointment.doctor}</p>
                    <p className="text-xs text-muted-foreground mt-1">{next_appointment.type}</p>
                    <Badge
                      variant="secondary"
                      className="mt-3 text-[10px] rounded-full gap-1"
                    >
                      <Clock className="h-3 w-3" />
                      {next_appointment.date}, {next_appointment.time}
                    </Badge>
                  </button>
                ) : (
                  <div className="p-4 rounded-2xl bg-muted/20 border border-dashed border-border text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      No tienes citas programadas
                    </p>
                    <Button
                      size="sm"
                      className="w-full rounded-full"
                      onClick={() => navigate("/patient/appointments")}
                    >
                      Agendar cita
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tip */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary to-emerald-600 p-5 text-primary-foreground shadow-card">
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
              <div className="relative flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Lightbulb className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
                    Consejo del día
                  </p>
                  <p className="text-sm mt-1.5 leading-relaxed opacity-95">{tip_of_day}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isWeightDialogOpen} onOpenChange={setIsWeightDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Actualizar mi peso</DialogTitle>
            <DialogDescription>
              Registra tu peso actual para seguir tu progreso con precisión.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label htmlFor="weight">Peso (kg)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              className="rounded-xl"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              autoFocus
              placeholder="72.5"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setIsWeightDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-full"
              onClick={handleUpdateWeight}
              disabled={savingWeight}
            >
              {savingWeight ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <MealDetailDialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        meal={mealDetailForModal ?? selectedMeal ?? null}
        getImageUrl={getImageUrl}
        loading={loadingMealDetail}
      />
    </>
  );
}
