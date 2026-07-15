import { useState, useEffect } from 'react';
import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Utensils,
  Search,
  Plus,
  Clock,
  Flame,
  Apple,
  Coffee,
  Sun,
  Moon,
  Sandwich,
  Loader2,
  AlertCircle,
  Trash2,
  ChevronRight,
  Check
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { todayInColombiaISO } from "@/lib/timezone";

interface FoodItem {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  checked: boolean;
}

interface Meal {
  id: string;
  name: string;
  icon: string;
  time: string;
  completed: boolean;
  foods: FoodItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

interface Summary {
  calories: { consumed: number; target: number };
  protein: { consumed: number; target: number };
  carbs: { consumed: number; target: number };
  fat: { consumed: number; target: number };
}

interface MealsData {
  meals: Meal[];
  summary: Summary;
  message?: string;
}

const iconMap: Record<string, any> = {
  Coffee,
  Apple,
  Sun,
  Sandwich,
  Moon,
};

export default function PatientMeals() {
  const { user } = useAuth();
  const patientId = user?.id;
  const { toast } = useToast();

  const [mealsData, setMealsData] = useState<MealsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingFood, setUpdatingFood] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [newFood, setNewFood] = useState({
    name: "",
    portion_size: "",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });

  useEffect(() => {
    if (patientId) {
      fetchMealsData();
    }
  }, [patientId]);

  const handleAddFood = async () => {
    if (!patientId || !selectedMealId) return;

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(
        `${API_URL}/patient/${patientId}/meals/food/add`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            meal_type: selectedMealId,
            date: todayInColombiaISO(),
            food: newFood
          })
        }
      );

      if (!response.ok) throw new Error('Error al agregar alimento');

      toast({
        title: "Alimento agregado",
        description: `${newFood.name} se agregó a tu ${selectedMealId}`
      });

      setIsAddModalOpen(false);
      setNewFood({ name: "", portion_size: "", calories: 0, protein: 0, carbs: 0, fat: 0 });
      await fetchMealsData();

    } catch (error) {
      console.error('Error adding food:', error);
      toast({
        title: "Error",
        description: "No se pudo agregar el alimento",
        variant: "destructive"
      });
    }
  };

  const handleRemoveFood = async (mealId: string, foodName: string) => {
    if (!patientId) return;

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(
        `${API_URL}/patient/${patientId}/meals/food/remove?meal_type=${mealId}&food_name=${encodeURIComponent(foodName)}&date=${todayInColombiaISO()}`,
        {
          method: 'DELETE',
          headers: {
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          }
        }
      );

      if (!response.ok) throw new Error('Error al eliminar alimento');

      toast({
        title: "Alimento eliminado",
        description: `${foodName} ha sido eliminado`
      });

      await fetchMealsData();

    } catch (error) {
      console.error('Error removing food:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el alimento",
        variant: "destructive"
      });
    }
  };


  const fetchMealsData = async () => {
    if (!patientId) {
      toast({
        title: "Error",
        description: "ID de usuario no válido",
        variant: "destructive"
      });
      return;
    }

    try {
      const token = localStorage.getItem("userToken");
      console.log(`Fetching meals for patient ID: ${patientId}`);
      const response = await fetch(
        `${API_URL}/patient/${patientId}/meals/today/detailed`,
        {
          headers: {
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          }
        }
      );

      if (!response.ok) throw new Error('Error al cargar comidas');

      const data = await response.json();
      console.log("Meals data received:", data);

      // Establecer los datos sin llamar a initialize automáticamente
      setMealsData(data);

    } catch (error) {
      console.error('Error fetching meals:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las comidas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeMeals = async () => {
    if (!patientId || initializing) return;

    try {
      setInitializing(true);

      const response = await fetch(
        `${API_URL}/patient/${patientId}/meals/initialize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!response.ok) throw new Error('Error al inicializar');

      toast({
        title: "Comidas inicializadas",
        description: "Tus comidas del día están listas"
      });

      // Recargar datos
      await fetchMealsData();

    } catch (error) {
      console.error('Error initializing meals:', error);
      toast({
        title: "Error",
        description: "No se pudieron inicializar las comidas",
        variant: "destructive"
      });
    } finally {
      setInitializing(false);
    }
  };

  const handleToggleFood = async (mealId: string, foodName: string) => {
    if (!patientId) return;

    const toggleKey = `${mealId}-${foodName}`;
    setUpdatingFood(toggleKey);

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(
        `${API_URL}/patient/${patientId}/meals/food/toggle`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            meal_type: mealId,
            food_name: foodName,
            date: todayInColombiaISO()
          })
        }
      );

      if (!response.ok) throw new Error('Error al actualizar');

      const result = await response.json();

      // Actualizar estado local
      if (mealsData) {
        const updatedMeals = mealsData.meals.map(meal => {
          if (meal.id === mealId) {
            const updatedFoods = meal.foods.map(food =>
              food.name === foodName
                ? { ...food, checked: result.checked }
                : food
            );

            return {
              ...meal,
              foods: updatedFoods,
              completed: result.meal_completed
            };
          }
          return meal;
        });

        setMealsData({ ...mealsData, meals: updatedMeals });
      }

      // Recargar para tener datos exactos
      await fetchMealsData();

    } catch (error) {
      console.error('Error toggling food:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el alimento",
        variant: "destructive"
      });
    } finally {
      setUpdatingFood(null);
    }
  };

  const filteredMeals = mealsData?.meals.filter(meal =>
    meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    meal.foods.some(food => food.name.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Cargando tus comidas...</p>
          </div>
        </div>
      </PatientLayout>
    );
  }

  // Si no hay patientId válido
  if (!patientId) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="p-8 text-center max-w-md">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error de autenticación</h3>
            <p className="text-muted-foreground mb-4">
              No se pudo identificar tu cuenta. Por favor, inicia sesión nuevamente.
            </p>
            <Button onClick={() => window.location.href = '/auth'}>
              Ir a inicio de sesión
            </Button>
          </Card>
        </div>
      </PatientLayout>
    );
  }

  if (!mealsData) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="p-8 text-center">
            <Utensils className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No se pudieron cargar las comidas</p>
            <Button onClick={fetchMealsData}>Reintentar</Button>
          </Card>
        </div>
      </PatientLayout>
    );
  }

  const { summary } = mealsData;

  return (
    <PatientLayout>
      <div className="space-y-4 lg:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">Mis Comidas</h1>
            <p className="text-sm lg:text-base text-muted-foreground">
              Registra y sigue tus comidas del día
            </p>
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="relative flex-1 sm:w-48 lg:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button className="gap-2 shrink-0" size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Agregar</span>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {/* Calorías */}
          <Card className="border-border shadow-card">
            <CardContent className="p-3 lg:p-4 flex items-center gap-3 lg:gap-4">
              <div className="h-10 w-10 lg:h-12 lg:w-12 shrink-0 rounded-xl bg-accent/10 flex items-center justify-center">
                <Flame className="h-5 w-5 lg:h-6 lg:w-6 text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-xs lg:text-sm text-muted-foreground truncate">Calorías</p>
                <p className="text-base lg:text-xl font-bold text-foreground">
                  {summary.calories.consumed} / {summary.calories.target}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Proteínas */}
          <Card className="border-border shadow-card">
            <CardContent className="p-3 lg:p-4 flex items-center gap-3 lg:gap-4">
              <div className="h-10 w-10 lg:h-12 lg:w-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="text-base lg:text-lg font-bold text-primary">P</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs lg:text-sm text-muted-foreground truncate">Proteínas</p>
                <p className="text-base lg:text-xl font-bold text-foreground">
                  {summary.protein.consumed}g / {summary.protein.target}g
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Carbohidratos */}
          <Card className="border-border shadow-card">
            <CardContent className="p-3 lg:p-4 flex items-center gap-3 lg:gap-4">
              <div className="h-10 w-10 lg:h-12 lg:w-12 shrink-0 rounded-xl bg-warning/10 flex items-center justify-center">
                <span className="text-base lg:text-lg font-bold text-warning">C</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs lg:text-sm text-muted-foreground truncate">Carbos</p>
                <p className="text-base lg:text-xl font-bold text-foreground">
                  {summary.carbs.consumed}g / {summary.carbs.target}g
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Grasas */}
          <Card className="border-border shadow-card">
            <CardContent className="p-3 lg:p-4 flex items-center gap-3 lg:gap-4">
              <div className="h-10 w-10 lg:h-12 lg:w-12 shrink-0 rounded-xl bg-info/10 flex items-center justify-center">
                <span className="text-base lg:text-lg font-bold text-info">G</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs lg:text-sm text-muted-foreground truncate">Grasas</p>
                <p className="text-base lg:text-xl font-bold text-foreground">
                  {summary.fat.consumed}g / {summary.fat.target}g
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Meals List */}
        {!mealsData || (mealsData.meals.length === 0) ? (
          <Card className="p-8 text-center border-dashed">
            <Utensils className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <div className="max-w-xs mx-auto space-y-2">
              <p className="text-lg font-semibold text-foreground">
                {mealsData?.message || "No hay comidas para hoy"}
              </p>
              <p className="text-sm text-muted-foreground">
                Si tienes un plan activo, tus comidas deberían aparecer aquí automáticamente.
                Si no las ves, intenta sincronizar manualmente.
              </p>
            </div>
            <Button
              onClick={initializeMeals}
              disabled={initializing}
              variant="outline"
              className="mt-6 gap-2"
            >
              {initializing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Sincronizar mi Plan
            </Button>
          </Card>
        ) : filteredMeals.length === 0 ? (
          <Card className="p-8 text-center">
            <Search className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No se encontraron comidas con "{searchQuery}"</p>
          </Card>
        ) : (
          <div className="space-y-3 lg:space-y-4">
            {filteredMeals.map((meal, mealIndex) => {
              const MealIcon = iconMap[meal.icon] || Utensils;

              return (
                <Card
                  key={meal.id}
                  className={`border-border shadow-card transition-all duration-300 ${meal.completed ? "bg-primary/5 border-primary/20" : ""
                    }`}
                  style={{ animationDelay: `${mealIndex * 50}ms` }}
                >
                  <CardHeader className="pb-2 lg:pb-3 px-3 lg:px-6 pt-3 lg:pt-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                        <div className={`h-8 w-8 lg:h-10 lg:w-10 shrink-0 rounded-xl flex items-center justify-center ${meal.completed
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                          }`}>
                          <MealIcon className="h-4 w-4 lg:h-5 lg:w-5" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm lg:text-base flex items-center gap-2 flex-wrap">
                            {meal.name}
                            {meal.completed && (
                              <Badge className="bg-success text-success-foreground text-[10px] lg:text-xs">
                                Completado
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1 text-xs lg:text-sm">
                            <Clock className="h-3 w-3" />
                            {meal.time}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1 text-[10px] lg:text-xs shrink-0">
                        <Flame className="h-3 w-3" />
                        {meal.total_calories} kcal
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 lg:px-6 pb-3 lg:pb-6">
                    <div className="space-y-1.5 lg:space-y-2">
                      {meal.foods.map((food, index) => {
                        const toggleKey = `${meal.id}-${food.name}`;
                        const isUpdating = updatingFood === toggleKey;

                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 lg:p-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors"
                          >
                            <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                              <Checkbox
                                checked={food.checked}
                                disabled={isUpdating}
                                onCheckedChange={() => handleToggleFood(meal.id, food.name)}
                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary h-4 w-4"
                              />
                              <div className="min-w-0">
                                <p className={`text-sm lg:text-base font-medium truncate ${food.checked
                                  ? "text-muted-foreground line-through"
                                  : "text-foreground"
                                  }`}>
                                  {isUpdating && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}
                                  {food.name}
                                </p>
                                <p className="text-[10px] lg:text-xs text-muted-foreground">
                                  {food.portion}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 lg:gap-3 shrink-0 ml-2">
                              <span className="text-xs lg:text-sm text-muted-foreground whitespace-nowrap">
                                {food.calories} kcal
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveFood(meal.id, food.name)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!meal.completed && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 lg:mt-3 gap-2 text-xs lg:text-sm border-dashed hover:border-primary hover:bg-primary/5 transition-all"
                        onClick={() => {
                          setSelectedMealId(meal.id);
                          setIsAddModalOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3 lg:h-4 lg:w-4" />
                        Agregar alimento
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add Food Dialog */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                Agregar Alimento
              </DialogTitle>
              <DialogDescription>
                Añade un alimento personalizado a tu {selectedMealId === 'breakfast' ? 'desayuno' : selectedMealId === 'lunch' ? 'almuerzo' : selectedMealId === 'dinner' ? 'cena' : 'comida'}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre del alimento</Label>
                <Input
                  id="name"
                  value={newFood.name}
                  onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="portion">Porción / Cantidad</Label>
                <Input
                  id="portion"
                  value={newFood.portion_size}
                  onChange={(e) => setNewFood({ ...newFood, portion_size: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="calories">Calorías (kcal)</Label>
                  <Input
                    id="calories"
                    type="number"
                    value={newFood.calories}
                    onChange={(e) => setNewFood({ ...newFood, calories: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="protein">Proteínas (g)</Label>
                  <Input
                    id="protein"
                    type="number"
                    value={newFood.protein}
                    onChange={(e) => setNewFood({ ...newFood, protein: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="carbs">Carbohidratos (g)</Label>
                  <Input
                    id="carbs"
                    type="number"
                    value={newFood.carbs}
                    onChange={(e) => setNewFood({ ...newFood, carbs: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fat">Grasas (g)</Label>
                  <Input
                    id="fat"
                    type="number"
                    value={newFood.fat}
                    onChange={(e) => setNewFood({ ...newFood, fat: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddFood} disabled={!newFood.name}>Guardar Alimento</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PatientLayout>
  );
}