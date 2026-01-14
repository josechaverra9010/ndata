import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Loader2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MealCard } from "@/components/patient/MealCard";

interface DashboardStats {
  calories: {
    consumed: number;
    target: number;
    percentage: number;
  };
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

  const { user, isLoading: isAuthLoading } = useAuth();
  const patientId = user?.id;

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
        `${API_URL}/patient/${patientId}/meal-log/${endpoint}`,
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
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {/* Calorías */}
          <Card className="border-border shadow-card">
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
                <div className="flex h-9 w-9 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                  <Flame className="h-4 w-4 lg:h-6 lg:w-6 text-accent" />
                </div>
              </div>
              <Progress
                value={stats.calories.percentage}
                className="mt-2 lg:mt-3 h-1.5 lg:h-2"
              />
            </CardContent>
          </Card>

          {/* Agua */}
          <Card className="border-border shadow-card">
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate">Agua</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground">
                    {stats.water.consumed_liters}L
                  </p>
                  <p className="text-[10px] lg:text-xs text-muted-foreground">
                    de {stats.water.target_liters}L objetivo
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
                    className="h-9 w-9 lg:h-12 lg:w-12 shrink-0 rounded-xl bg-destructive/10 hover:bg-destructive/20"
                  >
                    <Plus className="h-4 w-4 lg:h-6 lg:w-6 text-destructive rotate-45" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleAddWater}
                    disabled={addingWater}
                    className="h-9 w-9 lg:h-12 lg:w-12 shrink-0 rounded-xl bg-info/10 hover:bg-info/20 shadow-sm transition-all hover:scale-105"
                  >
                    {addingWater ? (
                      <Loader2 className="h-4 w-4 lg:h-6 lg:w-6 text-info animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 lg:h-6 lg:w-6 text-info" />
                    )}
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
          <Card className="border-border shadow-card">
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate">Comidas</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground">
                    {stats.meals.completed}/{stats.meals.total}
                  </p>
                  <p className="text-[10px] lg:text-xs text-muted-foreground">completadas</p>
                </div>
                <div className="flex h-9 w-9 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Apple className="h-4 w-4 lg:h-6 lg:w-6 text-primary" />
                </div>
              </div>
              <Progress
                value={stats.meals.percentage}
                className="mt-2 lg:mt-3 h-1.5 lg:h-2"
              />
            </CardContent>
          </Card>

          {/* Meta Semanal */}
          <Card className="border-border shadow-card">
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate">Meta Semanal</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground">
                    {stats.weekly_goal.percentage}%
                  </p>
                  <p className={`text - [10px] lg: text - xs ${stats.weekly_goal.change >= 0 ? 'text-success' : 'text-destructive'
                    } `}>
                    {stats.weekly_goal.change >= 0 ? '+' : ''}{stats.weekly_goal.change}% vs anterior
                  </p>
                </div>
                <div className="flex h-9 w-9 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-success/10">
                  <Target className="h-4 w-4 lg:h-6 lg:w-6 text-success" />
                </div>
              </div>
              <Progress
                value={stats.weekly_goal.percentage}
                className="mt-2 lg:mt-3 h-1.5 lg:h-2"
              />
            </CardContent>
          </Card>
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
                      isUpdating={updatingMeal === meal.meal_type}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Side Panel */}
          <div className="space-y-4 lg:space-y-6">
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
                      <div className={`h - 8 w - 8 lg: h - 10 lg: w - 10 rounded - full flex items - center justify - center text - xs lg: text - sm font - medium ${day.completed
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                        } `}>
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
    </PatientLayout>
  );
}