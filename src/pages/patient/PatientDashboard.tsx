import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Apple,
  Flame,
  Droplets,
  Target,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  Plus,
  Loader2,
  ChefHat,
  List,
  Utensils,
  ClipboardList,
  Activity
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { MealCard } from "@/components/patient/MealCard";

interface DashboardStats {
  calories: {
    consumed: number;
    target: number;
    percentage: number;
  };
  edad_formateada?: string;
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
  // Propiedades adicionales usadas en el modal y por compatibilidad
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

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingMeal, setUpdatingMeal] = useState<string | null>(null);
  const [addingWater, setAddingWater] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);

  const { user, isLoading: isAuthLoading } = useAuth();
  const patientId = user?.id;

  useEffect(() => {
    if (isDetailsOpen && !selectedMeal) {
      setIsDetailsOpen(false);
    }
  }, [isDetailsOpen, selectedMeal]);

  useEffect(() => {
    // If the data is empty, ensure the details dialog is closed
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
      // Refrescar datos cada 5 minutos
      const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isAuthLoading, patientId]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(
        `${API_URL}/patient/${patientId}/dashboard/complete`
      );

      if (!response.ok) throw new Error('Error al cargar datos');

      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del dashboard",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMeal = async (meal: Meal) => {
    setUpdatingMeal(meal.meal_type);

    try {
      const endpoint = meal.completed ? 'uncomplete' : 'complete';
      const response = await fetch(
        `${API_URL}/tracking/meal-toggle/${patientId}/${endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meal_type: meal.meal_type,
            date: new Date().toISOString().split('T')[0]
          })
        }
      );

      if (!response.ok) throw new Error('Error al actualizar comida');

      // Refrescar datos
      await fetchDashboardData();

      toast({
        title: meal.completed ? "Comida desmarcada" : "¡Comida completada!",
        description: `${meal.name} ${meal.completed ? 'desmarcada' : 'marcada como completada'} `,
      });
    } catch (error) {
      console.error('Error toggling meal:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la comida",
        variant: "destructive"
      });
    } finally {
      setUpdatingMeal(null);
    }
  };

  const handleAddWater = async () => {
    setAddingWater(true);

    try {
      const response = await fetch(
        `${API_URL}/patient/${patientId}/water/add`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ glass_ml: 250 })
        }
      );

      if (!response.ok) throw new Error('Error al agregar agua');

      const data = await response.json();

      // Actualizar solo el tracking de agua sin recargar todo
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
              percentage: data.percentage
            }
          }
        });
      }

      toast({
        title: "¡Agua agregada!",
        description: `+ 250ml • Total: ${data.amount_liters} L`,
      });
    } catch (error) {
      console.error('Error adding water:', error);
      toast({
        title: "Error",
        description: "No se pudo agregar el agua",
        variant: "destructive"
      });
    } finally {
      setAddingWater(false);
    }
  };

  const handleUpdateWeight = async () => {
    if (!newWeight || isNaN(parseFloat(newWeight))) {
      return toast({ title: "Error", description: "Ingresa un peso válido", variant: "destructive" });
    }

    setSavingWeight(true);
    try {
      const response = await fetch(`${API_URL}/profile/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email, peso_actual: parseFloat(newWeight) }),
      });

      if (response.ok) {
        toast({ title: "¡Éxito!", description: "Peso actualizado correctamente" });
        setIsWeightDialogOpen(false);
        fetchDashboardData();
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar el peso", variant: "destructive" });
    } finally {
      setSavingWeight(false);
    }
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Cargando tu dashboard...</p>
          </div>
        </div>
      </PatientLayout>
    );
  }

  if (!dashboardData) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No se pudieron cargar los datos</p>
            <Button onClick={fetchDashboardData} className="mt-4">
              Reintentar
            </Button>
          </Card>
        </div>
      </PatientLayout>
    );
  }

  const { stats, today_meals, week_progress, next_appointment, tip_of_day } = dashboardData;

  return (
    <PatientLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header con Bienvenida y Edad */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {stats.edad_formateada && (
              <Badge variant="secondary" className="w-fit bg-primary/10 text-primary border-primary/20 py-1.5 px-3">
                <Clock className="h-3.5 w-3.5 mr-2" />
                {stats.edad_formateada}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {/* Calorías */}
          <Card className="border-border shadow-card relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate">Calorías Hoy</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground">
                    {stats.calories.consumed}
                  </p>
                  <p className="text-[10px] lg:text-xs text-muted-foreground">
                    de {stats.calories.target} kcal
                  </p>
                </div>
                <div className="flex h-10 w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 group-hover:scale-110 transition-transform">
                  <Flame className="h-5 w-5 lg:h-6 lg:w-6 text-accent" />
                </div>
              </div>
              <Progress
                value={stats.calories.percentage}
                className="mt-2 lg:mt-3 h-1.5 lg:h-2"
              />
            </CardContent>
          </Card>

          {/* Agua */}
          <Card className="border-border shadow-card relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-info" />
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate">Agua</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground">
                    {stats.water.consumed_liters}L
                  </p>
                  <p className="text-[10px] lg:text-xs text-muted-foreground">
                    Meta: {stats.water.target_liters}L
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      setAddingWater(true);
                      try {
                        const response = await fetch(`${API_URL}/patient/${patientId}/water/add`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ glass_ml: -250 })
                        });
                        if (response.ok) fetchDashboardData();
                      } finally {
                        setAddingWater(false);
                      }
                    }}
                    disabled={addingWater || stats.water.consumed_ml <= 0}
                    className="h-8 w-8 lg:h-9 lg:w-9 shrink-0 rounded-lg bg-destructive/5 hover:bg-destructive/10 text-destructive"
                  >
                    <Plus className="h-4 w-4 rotate-45" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleAddWater}
                    disabled={addingWater}
                    className="h-8 w-8 lg:h-9 lg:w-9 shrink-0 rounded-lg bg-info/10 hover:bg-info/20 text-info shadow-sm"
                  >
                    {addingWater ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Progress
                value={stats.water.percentage}
                className="mt-2 lg:mt-3 h-1.5 lg:h-2"
              />
            </CardContent>
          </Card>

          {/* Comidas */}
          <Card className="border-border shadow-card relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate">Comidas</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground">
                    {stats.meals.completed}/{stats.meals.total}
                  </p>
                  <p className="text-[10px] lg:text-xs text-muted-foreground">completadas hoy</p>
                </div>
                <div className="flex h-10 w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 group-hover:scale-110 transition-transform">
                  <Apple className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                </div>
              </div>
              <Progress
                value={stats.meals.percentage}
                className="mt-2 lg:mt-3 h-1.5 lg:h-2"
              />
            </CardContent>
          </Card>

          {/* Meta Semanal */}
          <Card className="border-border shadow-card relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-success" />
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate">Adherencia</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground">
                    {stats.weekly_goal.percentage}%
                  </p>
                  <p className={`text-[10px] lg:text-xs flex items-center gap-1 ${stats.weekly_goal.change >= 0 ? 'text-success' : 'text-destructive'}`}>
                    <TrendingUp className={`h-3 w-3 ${stats.weekly_goal.change < 0 ? 'rotate-180' : ''}`} />
                    {stats.weekly_goal.change >= 0 ? '+' : ''}{stats.weekly_goal.change}%
                  </p>
                </div>
                <div className="flex h-10 w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-success/10 group-hover:scale-110 transition-transform">
                  <Target className="h-5 w-5 lg:h-6 lg:w-6 text-success" />
                </div>
              </div>
              <Progress
                value={stats.weekly_goal.percentage}
                className="mt-2 lg:mt-3 h-1.5 lg:h-2"
              />
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="h-auto flex-col py-4 gap-2 border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all"
            onClick={() => navigate('/patient/my-plan')}
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <ChefHat className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold">Ver Mi Plan</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col py-4 gap-2 border-accent/20 hover:bg-accent/5 hover:border-accent/40 transition-all"
            onClick={() => navigate('/patient/recipes')}
          >
            <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <Utensils className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold">Mis Recetas</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col py-4 gap-2 border-info/20 hover:bg-info/5 hover:border-info/40 transition-all"
            onClick={() => navigate('/patient/profile?tab=recordatorio')}
          >
            <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center text-info">
              <ClipboardList className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold">Registrar Ingesta</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col py-4 gap-2 border-success/20 hover:bg-success/5 hover:border-success/40 transition-all"
            onClick={() => setIsWeightDialogOpen(true)}
          >
            <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center text-success">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold">Actualizar Peso</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Today's Meals */}
          <Card className="lg:col-span-2 border-border shadow-card">
            <CardHeader className="pb-3 lg:pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-foreground text-base lg:text-lg">
                  <Apple className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                  Comidas de Hoy
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {stats.meals.completed}/{stats.meals.total}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {today_meals.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-4">
                    <Apple className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-base font-medium text-foreground mb-1">No tienes comidas programadas hoy</p>
                  <p className="text-sm text-muted-foreground">
                    Consulta con tu nutricionista para asignar un plan
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {today_meals.map((meal, index) => (
                    <MealCard
                      key={index}
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
          <div className="space-y-4 lg:space-y-6">
            {/* IMC Card */}
            <Card className="border-border shadow-card">
              <CardHeader className="pb-3 lg:pb-6">
                <CardTitle className="flex items-center gap-2 text-foreground text-sm lg:text-base">
                  <Target className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                  IMC (Índice de Masa Corporal)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center p-2">
                  {((dashboardData?.stats as any)?.peso_actual || user?.peso_actual) && ((dashboardData?.stats as any)?.altura || user?.altura) ? (
                    <>
                      <div className="relative h-24 w-48 overflow-hidden mb-2">
                        <div className="absolute inset-0 flex items-end justify-center">
                          <span className="text-3xl font-bold">
                            {(() => {
                              const peso = (dashboardData?.stats as any)?.peso_actual || user?.peso_actual;
                              const altura = (dashboardData?.stats as any)?.altura || user?.altura;
                              const h = altura > 3 ? altura / 100 : altura;
                              return (peso / (h * h)).toFixed(1);
                            })()}
                          </span>
                          <span className="text-sm font-medium text-muted-foreground ml-1 mb-1">kg/m²</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={(() => {
                        const peso = (dashboardData?.stats as any)?.peso_actual || user?.peso_actual;
                        const altura = (dashboardData?.stats as any)?.altura || user?.altura;
                        const h = altura > 3 ? altura / 100 : altura;
                        const imc = peso / (h * h);
                        if (imc < 18.5) return "text-blue-500 border-blue-200 bg-blue-50";
                        if (imc < 25) return "text-green-600 border-green-200 bg-green-50";
                        if (imc < 30) return "text-yellow-600 border-yellow-200 bg-yellow-50";
                        return "text-red-600 border-red-200 bg-red-50";
                      })()}>
                        {(() => {
                          const peso = (dashboardData?.stats as any)?.peso_actual || user?.peso_actual;
                          const altura = (dashboardData?.stats as any)?.altura || user?.altura;
                          const h = altura > 3 ? altura / 100 : altura;
                          const imc = peso / (h * h);
                          if (imc < 18.5) return "Bajo peso";
                          if (imc < 25) return "Peso normal";
                          if (imc < 30) return "Sobrepeso";
                          return "Obesidad";
                        })()}
                      </Badge>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">
                      Completa tu perfil (peso y altura) para ver tu IMC
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Week Progress */}
            <Card className="border-border shadow-card">
              <CardHeader className="pb-3 lg:pb-6">
                <CardTitle className="flex items-center gap-2 text-foreground text-sm lg:text-base">
                  <TrendingUp className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                  Progreso Semanal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between">
                  {week_progress.map((day, index) => (
                    <div key={index} className="flex flex-col items-center gap-1.5 lg:gap-2">
                      <div className={`h-8 w-8 lg:h-10 lg:w-10 rounded-full flex items-center justify-center text-xs lg:text-sm font-medium ${day.completed
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                        }`}>
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
            <Card className="border-border shadow-card">
              <CardHeader className="pb-3 lg:pb-6">
                <CardTitle className="flex items-center gap-2 text-foreground text-sm lg:text-base">
                  <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                  Próxima Cita
                </CardTitle>
              </CardHeader>
              <CardContent>
                {next_appointment ? (
                  <div
                    onClick={() => navigate('/patient/appointments')}
                    className="p-3 lg:p-4 rounded-xl bg-primary/5 border border-primary/20 cursor-pointer hover:bg-primary/10 transition-colors"
                  >
                    <p className="font-semibold text-foreground text-sm lg:text-base">
                      {next_appointment.doctor}
                    </p>
                    <p className="text-xs lg:text-sm text-muted-foreground mt-1">
                      {next_appointment.type}
                    </p>
                    <div className="flex items-center gap-2 mt-2 lg:mt-3">
                      <Badge variant="secondary" className="text-[10px] lg:text-xs">
                        {next_appointment.date}, {next_appointment.time}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 lg:p-4 rounded-xl bg-muted/30 border border-border text-center flex flex-col items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      No tienes citas programadas
                    </p>
                    <Button
                      size="sm"
                      onClick={() => navigate('/patient/appointments')}
                      className="w-full"
                    >
                      Agendar Cita
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tip of the day */}
            <Card className="border-border shadow-card gradient-primary text-primary-foreground">
              <CardContent className="p-4 lg:p-5">
                <p className="text-xs lg:text-sm font-medium opacity-90">💡 Consejo del día</p>
                <p className="text-xs lg:text-sm mt-2 opacity-80">
                  {tip_of_day}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>


      {/* Weight Update Dialog */}
      <Dialog open={isWeightDialogOpen} onOpenChange={setIsWeightDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Actualizar mi Peso</DialogTitle>
            <DialogDescription>
              Registra tu peso actual para seguir tu progreso con precisión.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="weight" className="text-right">Peso (kg)</Label>
              <input
                id="weight"
                type="number"
                step="0.1"
                placeholder="0.0"
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsWeightDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateWeight} disabled={savingWeight} className="gradient-primary">
              {savingWeight ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipe Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md lg:max-w-2xl h-[90vh] sm:h-[85vh] overflow-hidden flex flex-col p-0 border-none sm:rounded-3xl">
          {/* Header with Background Pattern/Color */}
          <div className="relative h-32 shrink-0 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b border-border/50">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    {selectedMeal?.meal || "Comida"}
                  </div>
                  <DialogTitle className="text-2xl font-extrabold tracking-tight text-foreground line-clamp-1">
                    {selectedMeal?.receta || selectedMeal?.food || selectedMeal?.name || "Detalle de Comida"}
                  </DialogTitle>
                </div>
                <Badge variant="secondary" className="mb-1 font-bold bg-primary/10 text-primary border-primary/20 px-3 py-1">
                  {selectedMeal?.calories || selectedMeal?.calorias || 0} kcal
                </Badge>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0 px-6">
            <div className="space-y-8 py-6 pb-10">
              {/* Image Section */}
              {selectedMeal?.image && (
                <div className="group relative rounded-2xl overflow-hidden border border-border/50 shadow-2xl transition-all duration-500 hover:shadow-primary/10">
                  <div className="aspect-video w-full">
                    <img
                      src={selectedMeal.image}
                      alt={selectedMeal.food}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).parentElement?.parentElement?.style.setProperty('display', 'none');
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Ingredients Column */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                    <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                      <List className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-foreground tracking-tight">
                      Ingredientes
                    </h3>
                  </div>

                  {Array.isArray(selectedMeal?.ingredients) && selectedMeal.ingredients.length > 0 ? (
                    <div className="grid gap-2.5">
                      {selectedMeal.ingredients.map((ingredient: any, idx: number) => {
                        // Verificamos si es un objeto con propiedades de ingrediente
                        const isObject = typeof ingredient === 'object' && ingredient !== null;
                        const name = isObject ? ingredient.name : ingredient;

                        // Buscamos la cantidad/porción en diferentes posibles propiedades
                        let amount = null;
                        if (isObject) {
                          amount = ingredient.portion || ingredient.grams || ingredient.cantidad || ingredient.amount || ingredient.quantity;
                        }

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/20 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-1.5 w-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                              <span className="text-sm font-semibold text-foreground/80 group-hover:text-foreground capitalize leading-tight">
                                {name}
                              </span>
                            </div>
                            {amount && (
                              <Badge variant="outline" className="text-[10px] uppercase font-black px-2 py-0 border-primary/20 text-primary bg-primary/10 shadow-sm">
                                {amount}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 bg-muted/20 rounded-2xl border-2 border-dashed border-border/50 text-center px-4">
                      <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                        <List className="h-6 w-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        No hay ingredientes listados.
                      </p>
                    </div>
                  )}
                </div>

                {/* Instructions Column */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                      <Utensils className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-foreground tracking-tight">
                      Preparación
                    </h3>
                  </div>

                  {Array.isArray(selectedMeal?.instructions) && selectedMeal.instructions.length > 0 ? (
                    <div className="space-y-4">
                      {selectedMeal.instructions.map((step: string, idx: number) => (
                        <div key={idx} className="flex gap-4 group">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-black shadow-sm group-hover:bg-primary group-hover:text-white transition-all duration-300">
                            {idx + 1}
                          </span>
                          <p className="text-sm leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors pt-0.5 font-medium">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 bg-muted/20 rounded-2xl border-2 border-dashed border-border/50 text-center px-4">
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
        </DialogContent>
      </Dialog>
    </PatientLayout >
  );
}