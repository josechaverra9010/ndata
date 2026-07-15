import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/config/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Flame,
  Clock,
  Edit,
  Copy,
  Save,
  X,
  Apple,
  Calendar,
  Coffee,
  Sun,
  Moon,
  UtensilsCrossed,
  AlertCircle,
  RefreshCw,
  Calculator,
  ClipboardList,
  FileText,
  Utensils
} from "lucide-react";
import { toast } from "sonner";

interface MealPlan {
  id: number;
  name: string;
  description: string;
  calories: number;
  duration: string;
  category: string;
  color: string;
  tipo?: string;
  protein_target?: number;
  carbs_target?: number;
  fat_target?: number;
  meals_per_day: number;
  patients: number;
  is_active: number;
  created_at?: string;
  fase_1?: any;
  fase_2?: any;
  fase_3?: any;
  fase_4?: any;
}

const planTypeLabels: Record<string, string> = {
  adulto: "Adulto",
  pediatria: "Pediatría",
  gestante: "Gestante",
  gestante_adolescente: "Gestante adolescente",
  hospitalizado: "Hospitalizado",
  deportista: "Deportista",
};

interface MealData {
  type: string;
  recipe_name?: string;
  receta?: string;
  calories?: number;
  calorias?: number;
  protein?: number;
  proteina?: number;
  carbs?: number;
  carbohidratos?: number;
  fat?: number;
  grasas?: number;
  time?: string;
  notes?: string;
}

interface WeeklyMenu {
  id: number;
  meal_plan_id: number;
  week_number: number;
  week: Array<{
    day: string;
    meals: MealData[];
  }>;
}

interface PlanDetailsDialogProps {
  plan: MealPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdatePlan?: (planId: number, planData: any) => void;
}

const categoryColors = {
  primary: "bg-primary/10 text-primary border-primary/20",
  accent: "bg-accent/10 text-accent border-accent/20",
  info: "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
};

const mealIcons: Record<string, any> = {
  desayuno: Coffee,
  breakfast: Coffee,
  almuerzo: Apple,
  morning_snack: Apple,
  comida: Sun,
  lunch: Sun,
  merienda: UtensilsCrossed,
  afternoon_snack: UtensilsCrossed,
  cena: Moon,
  dinner: Moon,
  evening_snack: Coffee,
  snack: Apple,
};

const mealLabels: Record<string, string> = {
  desayuno: "Desayuno",
  breakfast: "Desayuno",
  almuerzo: "Snack #1",
  morning_snack: "Snack #1",
  comida: "Almuerzo",
  lunch: "Almuerzo",
  merienda: "Snack #2",
  afternoon_snack: "Snack #2",
  cena: "Cena",
  dinner: "Cena",
  evening_snack: "Snack Noche",
  snack: "Snack",
};

interface WeeklyMenuComplete {
  id: number;
  name: string;
  description: string;
  category: string;
  total_calories: number;
  assigned_patients: number;
}

function AssignMenuSection({ planId, onAssignSuccess }: { planId: number; onAssignSuccess: () => void }) {
  const [menus, setMenus] = useState<WeeklyMenuComplete[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/weekly-menus`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        throw new Error("No se pudieron cargar los menús");
      }
      const data = await response.json();
      setMenus(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching menus:", error);
      toast.error("Error al cargar menús disponibles");
      setMenus([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedMenuId) return;

    setAssigning(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/meal-plans/${planId}/assign-menu`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ weekly_menu_id: parseInt(selectedMenuId) }),
      });

      if (response.ok) {
        toast.success("Menú asignado correctamente (4 semanas vinculadas)");
        onAssignSuccess();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.detail || "Error al asignar el menú");
      }
    } catch (error) {
      console.error("Error assigning menu:", error);
      toast.error("Error de conexión");
    } finally {
      setAssigning(false);
    }
  };

  const selectedMenu = menus.find(m => m.id.toString() === selectedMenuId);

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Cargando menús disponibles...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Asignar Menú Semanal</CardTitle>
        <p className="text-sm text-muted-foreground">
          Selecciona un menú semanal existente para asignarlo a este plan nutricional.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Menú Semanal Disponible</Label>
          <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar menú..." />
            </SelectTrigger>
            <SelectContent>
              {menus.map((menu) => (
                <SelectItem key={menu.id} value={menu.id.toString()}>
                  {menu.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedMenu && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold">{selectedMenu.name}</span>
              <Badge variant="outline">{selectedMenu.category}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{selectedMenu.description}</p>
            <div className="flex gap-4 text-xs text-muted-foreground pt-2">
              <span className="flex items-center gap-1">
                <Flame className="h-3 w-3" /> {selectedMenu.total_calories} kcal
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {selectedMenu.assigned_patients} asignados
              </span>
            </div>
          </div>
        )}

        <Button
          className="w-full"
          disabled={!selectedMenuId || assigning}
          onClick={handleAssign}
        >
          {assigning ? "Asignando..." : "Asignar Menú Seleccionado"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function PlanDetailsDialog({ plan, open, onOpenChange, onUpdatePlan }: PlanDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [weeklyMenu, setWeeklyMenu] = useState<WeeklyMenu | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [enrichedMenu, setEnrichedMenu] = useState<any>(null);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    calories: "",
    duration: "",
    category: "",
    color: "primary",
    tipo: "adulto",
    protein_target: "",
    carbs_target: "",
    fat_target: "",
    meals_per_day: "3",
  });

  useEffect(() => {
    if (plan && open) {
      setFormData({
        name: plan.name,
        description: plan.description,
        calories: plan.calories.toString(),
        duration: plan.duration,
        category: plan.category,
        color: plan.color,
        tipo: plan.tipo || "adulto",
        protein_target: plan.protein_target?.toString() || "",
        carbs_target: plan.carbs_target?.toString() || "",
        fat_target: plan.fat_target?.toString() || "",
        meals_per_day: plan.meals_per_day.toString(),
      });
      setIsEditing(false);

      // Cargar menú semanal
      fetchWeeklyMenu(plan.id);
    }
  }, [plan, open]);

  const fetchRecipeById = async (recipeId: number) => {
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/recipes/${recipeId}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
    } catch (error) {
      console.error(`Error fetching recipe ${recipeId}:`, error);
    }
    return null;
  };

  const fetchWeeklyMenu = async (planId: number) => {
    console.log(`🔍 Buscando menú para plan ${planId}...`);
    setLoadingMenu(true);
    setEnrichedMenu(null);

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/weekly-menus/by-plan/${planId}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Menú base recibido:", data);
        setWeeklyMenu(data);

        if (!data.week || !Array.isArray(data.week)) {
          console.warn("⚠️ El menú recibido no tiene una estructura de semanas válida");
          setLoadingMenu(false);
          return;
        }

        // Enriquecer con recetas para Fase 4
        setLoadingRecipes(true);
        try {
          console.log("🧪 Iniciando enriquecimiento de recetas...");
          const enrichedWeek = await Promise.all(data.week.map(async (day: any) => {
            if (!day.meals || !Array.isArray(day.meals)) {
              console.warn(`⚠️ El día ${day.day} no tiene lista de comidas`);
              return day;
            }

            const enrichedMeals = await Promise.all(day.meals.map(async (meal: any) => {
              const rId = meal.recipe_id || meal.recipeId || meal.id_receta;
              if (rId) {
                console.log(`📡 Cargando receta ${rId} (${meal.type})...`);
                const recipeDetails = await fetchRecipeById(rId);
                // Mismo parseo que en el wizard
                if (recipeDetails && typeof recipeDetails.ingredients === "string") {
                  try { recipeDetails.ingredients = JSON.parse(recipeDetails.ingredients); }
                  catch { recipeDetails.ingredients = []; }
                }
                return { ...meal, recipe_id: rId, recipeDetails };
              }
              return meal;
            }));
            return { ...day, meals: enrichedMeals };
          }));

          const fullEnriched = { ...data, week: enrichedWeek };
          console.log("🎯 Menú enriquecido completo:", fullEnriched);
          setEnrichedMenu(fullEnriched);
        } catch (e) {
          console.error("❌ Error enriqueciendo menú:", e);
        } finally {
          setLoadingRecipes(false);
        }

      } else if (response.status === 404 || response.status === 204) {
        console.log("⚠️ No hay menú asignado");
        setWeeklyMenu(null);
        setEnrichedMenu(null);
      } else {
        console.error("❌ Error en respuesta:", response.status);
        setWeeklyMenu(null);
      }
    } catch (error) {
      console.error("❌ Error fetching weekly menu:", error);
      setWeeklyMenu(null);
    } finally {
      setLoadingMenu(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !onUpdatePlan) return;

    const planData = {
      name: formData.name,
      description: formData.description,
      calories: parseInt(formData.calories),
      duration: formData.duration,
      category: formData.category,
      color: formData.color,
      tipo: formData.tipo || "adulto",
      protein_target: formData.protein_target ? parseInt(formData.protein_target) : 0,
      carbs_target: formData.carbs_target ? parseInt(formData.carbs_target) : 0,
      fat_target: formData.fat_target ? parseInt(formData.fat_target) : 0,
      meals_per_day: parseInt(formData.meals_per_day),
    };

    onUpdatePlan(plan.id, planData);
    setIsEditing(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDuplicatePlan = () => {
    toast.success("Plan duplicado correctamente");
  };

  const calculateMacroPercentages = () => {
    if (!plan) return { protein: 30, carbs: 45, fat: 25 };

    const protein = plan.protein_target || 0;
    const carbs = plan.carbs_target || 0;
    const fat = plan.fat_target || 0;

    const proteinCal = protein * 4;
    const carbsCal = carbs * 4;
    const fatCal = fat * 9;
    const totalCal = proteinCal + carbsCal + fatCal;

    if (totalCal === 0) return { protein: 30, carbs: 45, fat: 25 };

    return {
      protein: Math.round((proteinCal / totalCal) * 100),
      carbs: Math.round((carbsCal / totalCal) * 100),
      fat: Math.round((fatCal / totalCal) * 100),
    };
  };

  const renderMealCard = (meal: MealData, index: number) => {
    const mealType = meal.type?.toLowerCase() || "";
    const Icon = mealIcons[mealType] || UtensilsCrossed;
    const label = mealLabels[mealType] || meal.type || "Comida";

    const recipeName = meal.recipe_name || meal.receta || "Sin receta asignada";
    const calories = meal.calories || meal.calorias || 0;
    const protein = meal.protein || meal.proteina;
    const carbs = meal.carbs || meal.carbohidratos;
    const fat = meal.fat || meal.grasas;

    return (
      <div key={index} className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm text-foreground mb-1">{label}</p>
              <p className="text-sm text-muted-foreground mb-2">{recipeName}</p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  {calories} kcal
                </span>
                {protein && <span>P: {protein}g</span>}
                {carbs && <span>C: {carbs}g</span>}
                {fat && <span>G: {fat}g</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDayMenu = (dayData: { day: string; meals: MealData[] }) => {
    console.log("📅 Renderizando día:", dayData.day, "Comidas:", dayData.meals);

    // Asegurar que meals sea un array
    let mealsList: MealData[] = [];
    if (Array.isArray(dayData.meals)) {
      mealsList = dayData.meals;
    } else if (typeof dayData.meals === 'object' && dayData.meals !== null) {
      // Si es objeto, intentar convertirlo
      if ('meals' in dayData.meals && Array.isArray((dayData.meals as any).meals)) {
        mealsList = (dayData.meals as any).meals;
      } else {
        mealsList = Object.values(dayData.meals);
      }
    }

    if (mealsList.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hay comidas configuradas para {dayData.day}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {mealsList.map((meal, index) => renderMealCard(meal, index))}
      </div>
    );
  };

  if (!plan) return null;

  const macros = calculateMacroPercentages();

  const categories = [
    "Pérdida de peso",
    "Ganancia muscular",
    "Deportivo",
    "Médico",
    "Vegetariano",
    "Vegano",
    "Embarazo",
    "Mantenimiento",
  ];

  const colors = [
    { value: "primary", label: "Azul" },
    { value: "accent", label: "Naranja" },
    { value: "success", label: "Verde" },
    { value: "info", label: "Cyan" },
    { value: "warning", label: "Amarillo" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={categoryColors[plan.color as keyof typeof categoryColors]}>
                  {plan.category}
                </Badge>
                {plan.tipo && (
                  <Badge variant="secondary">{planTypeLabels[plan.tipo] ?? plan.tipo}</Badge>
                )}
              </div>
              <DialogTitle className="text-xl mt-2">{isEditing ? "Editar Plan" : plan.name}</DialogTitle>
              <DialogDescription>
                {isEditing ? "Modifica los detalles del plan nutricional" : plan.description}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <>
                  <Button variant="outline" size="icon" onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleDuplicatePlan}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="icon" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre del Plan</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoría</Label>
                <Select value={formData.category} onValueChange={(value) => handleChange("category", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tipo">Tipo de plan</Label>
                <Select value={formData.tipo} onValueChange={(value) => handleChange("tipo", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(planTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-color">Color</Label>
                <Select value={formData.color} onValueChange={(value) => handleChange("color", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colors.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        {color.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-calories">Calorías Diarias</Label>
                <Input
                  id="edit-calories"
                  type="number"
                  value={formData.calories}
                  onChange={(e) => handleChange("calories", e.target.value)}
                  required
                  min="800"
                  max="5000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-duration">Duración</Label>
                <Input
                  id="edit-duration"
                  value={formData.duration}
                  onChange={(e) => handleChange("duration", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Objetivos de Macronutrientes</Label>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-protein">Proteína (g)</Label>
                <Input
                  id="edit-protein"
                  type="number"
                  value={formData.protein_target}
                  onChange={(e) => handleChange("protein_target", e.target.value)}
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-carbs">Carbohidratos (g)</Label>
                <Input
                  id="edit-carbs"
                  type="number"
                  value={formData.carbs_target}
                  onChange={(e) => handleChange("carbs_target", e.target.value)}
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-fat">Grasas (g)</Label>
                <Input
                  id="edit-fat"
                  type="number"
                  value={formData.fat_target}
                  onChange={(e) => handleChange("fat_target", e.target.value)}
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-meals">Comidas por Día</Label>
              <Select value={formData.meals_per_day} onValueChange={(value) => handleChange("meals_per_day", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 comidas</SelectItem>
                  <SelectItem value="4">4 comidas</SelectItem>
                  <SelectItem value="5">5 comidas</SelectItem>
                  <SelectItem value="6">6 comidas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" />
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <Tabs defaultValue="overview" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="fases">4 Fases</TabsTrigger>
              <TabsTrigger value="menu">
                Menú Semanal
                {weeklyMenu && (
                  <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/20">
                    Asignado
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4 flex flex-col items-center">
                    <Flame className="h-6 w-6 text-accent mb-2" />
                    <p className="text-xl font-bold text-foreground">{plan.calories}</p>
                    <p className="text-xs text-muted-foreground">kcal/día</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 flex flex-col items-center">
                    <Clock className="h-6 w-6 text-info mb-2" />
                    <p className="text-xl font-bold text-foreground">{plan.duration.split(" ")[0]}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan.duration.includes("semanas") ? "semanas" : plan.duration.includes("Continuo") ? "continuo" : ""}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 flex flex-col items-center">
                    <Users className="h-6 w-6 text-primary mb-2" />
                    <p className="text-xl font-bold text-foreground">{plan.patients}</p>
                    <p className="text-xs text-muted-foreground">pacientes</p>
                  </CardContent>
                </Card>
              </div>

              {/* Macros Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribución de Macronutrientes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {plan.protein_target && plan.protein_target > 0 ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-primary" />
                            Proteínas
                          </span>
                          <span className="font-medium">{plan.protein_target}g ({macros.protein}%)</span>
                        </div>
                        <Progress value={macros.protein} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-accent" />
                            Carbohidratos
                          </span>
                          <span className="font-medium">{plan.carbs_target}g ({macros.carbs}%)</span>
                        </div>
                        <Progress value={macros.carbs} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-warning" />
                            Grasas
                          </span>
                          <span className="font-medium">{plan.fat_target}g ({macros.fat}%)</span>
                        </div>
                        <Progress value={macros.fat} className="h-2" />
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No se han definido objetivos de macronutrientes</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setIsEditing(true)}
                      >
                        Configurar Macros
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Additional Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Información del Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Comidas por día</span>
                    <span className="text-sm font-semibold text-foreground">{plan.meals_per_day}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Categoría</span>
                    <Badge variant="outline" className={categoryColors[plan.color as keyof typeof categoryColors]}>
                      {plan.category}
                    </Badge>
                  </div>
                  {plan.tipo && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm font-medium text-muted-foreground">Tipo de plan</span>
                      <span className="text-sm font-semibold text-foreground">{planTypeLabels[plan.tipo] ?? plan.tipo}</span>
                    </div>
                  )}
                  {plan.created_at && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium text-muted-foreground">Fecha de creación</span>
                      <span className="text-sm font-semibold text-foreground">
                        {new Date(plan.created_at).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fases" className="space-y-4">
              <div className="space-y-4">
                {/* Fase 1: Requerimiento Energético y Peso Saludable */}
                {plan.fase_1 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Calculator className="h-5 w-5 text-primary" />
                        {plan.fase_1.tipo_fase === "deportista"
                          ? "Fase 1: Somatotipo y composición corporal"
                          : plan.fase_1.tipo_fase === "pediatria"
                            ? "Fase 1: Evaluación y requerimiento pediátrico"
                          : plan.fase_1.tipo_fase === "gestante_adolescente"
                            ? "Fase 1: Evaluación gestante adolescente"
                          : plan.fase_1.tipo_fase === "gestante"
                            ? "Fase 1: Evaluación y requerimiento gestante"
                          : plan.fase_1.tipo_fase === "hospitalizado"
                            ? "Fase 1: Requerimiento energético hospitalizado"
                          : "Fase 1: Requerimiento Energético y Peso Saludable"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {plan.fase_1.ajuste_calorias_modo && plan.fase_1.ajuste_calorias_modo !== "ninguno" && (
                        <div className="text-sm rounded-md border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 px-3 py-2">
                          Ajuste calórico:{" "}
                          <span className="font-medium">
                            {plan.fase_1.ajuste_calorias_modo === "restriccion" ? "restricción" : "aumento"} de{" "}
                            {plan.fase_1.ajuste_calorias_valor || "—"} kcal
                          </span>
                          {plan.fase_1.requerimiento_base ? (
                            <span className="text-muted-foreground">
                              {" "}· base {plan.fase_1.requerimiento_antes_ajuste || plan.fase_1.requerimiento_base} kcal → total {plan.fase_1.requerimiento_energetico} kcal
                            </span>
                          ) : plan.fase_1.requerimiento_antes_ajuste ? (
                            <span className="text-muted-foreground">
                              {" "}· base {plan.fase_1.requerimiento_antes_ajuste} kcal → total {plan.fase_1.requerimiento_energetico} kcal
                            </span>
                          ) : null}
                        </div>
                      )}
                      {plan.fase_1.formula_requerimiento && (
                        <div className="text-sm rounded-md border bg-muted/40 px-3 py-2">
                          Fórmula:{" "}
                          <span className="font-medium">
                            {plan.fase_1.metodo_energia
                              || (plan.fase_1.formula_requerimiento === "harris_benedict"
                              ? "Harris-Benedict"
                              : plan.fase_1.formula_requerimiento === "mifflin"
                                ? "Mifflin-St Jeor"
                                : plan.fase_1.formula_requerimiento === "ireton_jones"
                                  ? "Ireton-Jones"
                                : plan.fase_1.formula_requerimiento === "rango_calorico"
                                  ? `Rango calórico (${plan.fase_1.rango_kcal_kg || "—"} kcal/kg)`
                                  : plan.fase_1.tipo_fase === "gestante_adolescente"
                                    ? "GET FAO + crecimiento"
                                    : "FAO / Schofield")}
                          </span>
                        </div>
                      )}
                      {plan.fase_1.tipo_fase === "deportista" ? (
                        <div className="grid grid-cols-2 gap-4">
                          {plan.fase_1.deportista_peso && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Peso</Label>
                              <p className="font-medium">{plan.fase_1.deportista_peso} kg</p>
                            </div>
                          )}
                          {plan.fase_1.deportista_estatura && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Estatura</Label>
                              <p className="font-medium">{plan.fase_1.deportista_estatura} cm</p>
                            </div>
                          )}
                          {plan.fase_1.endomorfia != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Endomorfia</Label>
                              <p className="font-medium">{Number(plan.fase_1.endomorfia).toFixed(2)}</p>
                            </div>
                          )}
                          {plan.fase_1.mesomorfia != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Mesomorfia</Label>
                              <p className="font-medium">{Number(plan.fase_1.mesomorfia).toFixed(2)}</p>
                            </div>
                          )}
                          {plan.fase_1.ectomorfia != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Ectomorfia</Label>
                              <p className="font-medium">{Number(plan.fase_1.ectomorfia).toFixed(2)}</p>
                            </div>
                          )}
                          {plan.fase_1.pct_grasa_yuhasz != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">% Grasa Yuhasz</Label>
                              <p className="font-medium">{Number(plan.fase_1.pct_grasa_yuhasz).toFixed(2)}%</p>
                            </div>
                          )}
                          {plan.fase_1.masa_libre_grasa != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Masa libre de grasa</Label>
                              <p className="font-medium">{Number(plan.fase_1.masa_libre_grasa).toFixed(2)} kg</p>
                            </div>
                          )}
                          {plan.fase_1.aks != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Índice AKS</Label>
                              <p className="font-medium">{Number(plan.fase_1.aks).toFixed(3)}</p>
                            </div>
                          )}
                          {plan.fase_1.clasificacion_aks && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Clasificación AKS</Label>
                              <p className="font-medium">{plan.fase_1.clasificacion_aks}</p>
                            </div>
                          )}
                          {plan.fase_1.peso_optimo != null && Number(plan.fase_1.peso_optimo) > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Peso óptimo</Label>
                              <p className="font-medium">{Number(plan.fase_1.peso_optimo).toFixed(2)} kg</p>
                            </div>
                          )}
                          {plan.fase_1.requerimiento_energetico && (
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Calorías del plan</Label>
                              <p className="font-bold text-lg text-primary">{plan.fase_1.requerimiento_energetico} kcal</p>
                            </div>
                          )}
                        </div>
                      ) : plan.fase_1.tipo_fase === "pediatria" ? (
                        <div className="grid grid-cols-2 gap-4">
                          {plan.fase_1.pediatria_peso && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Peso</Label>
                              <p className="font-medium">{plan.fase_1.pediatria_peso} kg</p>
                            </div>
                          )}
                          {plan.fase_1.pediatria_talla_cm && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Talla</Label>
                              <p className="font-medium">{plan.fase_1.pediatria_talla_cm} cm</p>
                            </div>
                          )}
                          {(plan.fase_1.pediatria_edad_anos || plan.fase_1.pediatria_edad_meses) && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Edad</Label>
                              <p className="font-medium">
                                {plan.fase_1.pediatria_edad_anos || 0} a {plan.fase_1.pediatria_edad_meses || 0} m
                              </p>
                            </div>
                          )}
                          {plan.fase_1.pediatria_sexo && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Sexo</Label>
                              <p className="font-medium capitalize">{plan.fase_1.pediatria_sexo}</p>
                            </div>
                          )}
                          {plan.fase_1.imc != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">IMC</Label>
                              <p className="font-medium">{Number(plan.fase_1.imc).toFixed(2)}</p>
                            </div>
                          )}
                          {plan.fase_1.ger_modo && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Modo GER</Label>
                              <p className="font-medium">{plan.fase_1.ger_modo}</p>
                            </div>
                          )}
                          {plan.fase_1.ger_base != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">GER base</Label>
                              <p className="font-medium">{Math.round(Number(plan.fase_1.ger_base))} kcal</p>
                            </div>
                          )}
                          {plan.fase_1.pediatria_actividad && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Actividad</Label>
                              <p className="font-medium">{plan.fase_1.pediatria_actividad}</p>
                            </div>
                          )}
                          {plan.fase_1.rien_band && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Banda RIEN</Label>
                              <p className="font-medium">{plan.fase_1.rien_band}</p>
                            </div>
                          )}
                          {plan.fase_1.requerimiento_energetico && (
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Requerimiento energético</Label>
                              <p className="font-bold text-lg text-primary">{plan.fase_1.requerimiento_energetico} kcal</p>
                            </div>
                          )}
                        </div>
                      ) : plan.fase_1.tipo_fase === "gestante_adolescente" ? (
                        <div className="grid grid-cols-2 gap-4">
                          {plan.fase_1.gestante_edad && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Edad</Label>
                              <p className="font-medium">{plan.fase_1.gestante_edad} años</p>
                            </div>
                          )}
                          {plan.fase_1.gestante_peso_preg && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Peso pregestacional</Label>
                              <p className="font-medium">{plan.fase_1.gestante_peso_preg} kg</p>
                            </div>
                          )}
                          {plan.fase_1.gestante_semana && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Semana gestacional</Label>
                              <p className="font-medium">{plan.fase_1.gestante_semana}</p>
                            </div>
                          )}
                          {plan.fase_1.puntaje_z != null && plan.fase_1.puntaje_z !== "" && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Puntaje Z</Label>
                              <p className="font-medium">{Number(plan.fase_1.puntaje_z).toFixed(2)}</p>
                            </div>
                          )}
                          {plan.fase_1.clasificacion_z && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Clasificación Z</Label>
                              <p className="font-medium">{plan.fase_1.clasificacion_z}</p>
                            </div>
                          )}
                          {plan.fase_1.imc_pregestacional != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">IMC pregestacional</Label>
                              <p className="font-medium">{Number(plan.fase_1.imc_pregestacional).toFixed(2)}</p>
                            </div>
                          )}
                          {plan.fase_1.trimestre && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Trimestre</Label>
                              <p className="font-medium">{plan.fase_1.trimestre}°</p>
                            </div>
                          )}
                          {plan.fase_1.gestante_actividad_adoles && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Actividad</Label>
                              <p className="font-medium">{plan.fase_1.gestante_actividad_adoles}</p>
                            </div>
                          )}
                          {plan.fase_1.get_fao != null && Number(plan.fase_1.get_fao) > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">GET FAO</Label>
                              <p className="font-medium">{Math.round(Number(plan.fase_1.get_fao))} kcal</p>
                            </div>
                          )}
                          {plan.fase_1.tmr != null && Number(plan.fase_1.tmr) > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">TMB</Label>
                              <p className="font-medium">{Math.round(Number(plan.fase_1.tmr))} kcal</p>
                            </div>
                          )}
                          {plan.fase_1.requerimiento_base != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Base (+ crec. × act.)</Label>
                              <p className="font-medium">{Math.round(Number(plan.fase_1.requerimiento_base))} kcal</p>
                            </div>
                          )}
                          {plan.fase_1.calorias_adicionales != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Extras gestación</Label>
                              <p className="font-medium">{plan.fase_1.calorias_adicionales} kcal</p>
                            </div>
                          )}
                          {plan.fase_1.requerimiento_energetico && (
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Requerimiento total</Label>
                              <p className="font-bold text-lg text-primary">{plan.fase_1.requerimiento_energetico} kcal</p>
                            </div>
                          )}
                        </div>
                      ) : plan.fase_1.tipo_fase === "gestante" ? (
                        <div className="grid grid-cols-2 gap-4">
                          {plan.fase_1.gestante_peso_preg && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Peso pregestacional</Label>
                              <p className="font-medium">{plan.fase_1.gestante_peso_preg} kg</p>
                            </div>
                          )}
                          {plan.fase_1.gestante_semana && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Semana gestacional</Label>
                              <p className="font-medium">{plan.fase_1.gestante_semana}</p>
                            </div>
                          )}
                          {plan.fase_1.imc_pregestacional != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">IMC pregestacional</Label>
                              <p className="font-medium">{Number(plan.fase_1.imc_pregestacional).toFixed(2)}</p>
                            </div>
                          )}
                          {plan.fase_1.clasificacion_atalah && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Atalah</Label>
                              <p className="font-medium">{plan.fase_1.clasificacion_atalah}</p>
                            </div>
                          )}
                          {plan.fase_1.trimestre && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Trimestre</Label>
                              <p className="font-medium">{plan.fase_1.trimestre}°</p>
                            </div>
                          )}
                          {plan.fase_1.tmr != null && Number(plan.fase_1.tmr) > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">TMR / TMB</Label>
                              <p className="font-medium">{Math.round(Number(plan.fase_1.tmr))} kcal</p>
                            </div>
                          )}
                          {plan.fase_1.requerimiento_base != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Base (× PAL o kcal/kg)</Label>
                              <p className="font-medium">{Math.round(Number(plan.fase_1.requerimiento_base))} kcal</p>
                            </div>
                          )}
                          {plan.fase_1.calorias_adicionales != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Extras gestación</Label>
                              <p className="font-medium">{plan.fase_1.calorias_adicionales} kcal</p>
                            </div>
                          )}
                          {plan.fase_1.requerimiento_energetico && (
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Requerimiento total</Label>
                              <p className="font-bold text-lg text-primary">{plan.fase_1.requerimiento_energetico} kcal</p>
                            </div>
                          )}
                        </div>
                      ) : plan.fase_1.tipo_fase === "hospitalizado" ? (
                        <div className="grid grid-cols-2 gap-4">
                          {plan.fase_1.peso_actual && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Peso actual</Label>
                              <p className="font-medium">{plan.fase_1.peso_actual} kg</p>
                            </div>
                          )}
                          {plan.fase_1.altura && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Altura</Label>
                              <p className="font-medium">{plan.fase_1.altura} cm</p>
                            </div>
                          )}
                          {plan.fase_1.imc && (
                            <div>
                              <Label className="text-xs text-muted-foreground">IMC</Label>
                              <p className="font-medium">{plan.fase_1.imc}</p>
                            </div>
                          )}
                          {plan.fase_1.peso_referencia && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Peso referencia</Label>
                              <p className="font-medium">{plan.fase_1.peso_referencia} kg</p>
                            </div>
                          )}
                          {plan.fase_1.peso_estimado_chumlea != null && Number(plan.fase_1.peso_estimado_chumlea) > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Peso Chumlea</Label>
                              <p className="font-medium">{Number(plan.fase_1.peso_estimado_chumlea).toFixed(1)} kg</p>
                            </div>
                          )}
                          {plan.fase_1.talla_estimada_chumlea != null && Number(plan.fase_1.talla_estimada_chumlea) > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Talla Chumlea</Label>
                              <p className="font-medium">{Number(plan.fase_1.talla_estimada_chumlea).toFixed(1)} cm</p>
                            </div>
                          )}
                          {plan.fase_1.regla_peso && (
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Regla de peso</Label>
                              <p className="font-medium">{plan.fase_1.regla_peso}</p>
                            </div>
                          )}
                          {plan.fase_1.tmb != null && Number(plan.fase_1.tmb) > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">TMB / EEE</Label>
                              <p className="font-medium">{Math.round(Number(plan.fase_1.tmb))} kcal</p>
                            </div>
                          )}
                          {plan.fase_1.hosp_factor_actividad != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Factor actividad</Label>
                              <p className="font-medium">{plan.fase_1.hosp_factor_actividad}</p>
                            </div>
                          )}
                          {plan.fase_1.hosp_factor_estres != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Factor estrés</Label>
                              <p className="font-medium">{plan.fase_1.hosp_factor_estres}</p>
                            </div>
                          )}
                          {plan.fase_1.requerimiento_base != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Requerimiento base</Label>
                              <p className="font-medium">{Math.round(Number(plan.fase_1.requerimiento_base))} kcal</p>
                            </div>
                          )}
                          {plan.fase_1.liquidos_ml != null && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Líquidos</Label>
                              <p className="font-medium">{plan.fase_1.liquidos_ml} ml/día ({plan.fase_1.hosp_liquidos_cc_kg || "—"} cc/kg)</p>
                            </div>
                          )}
                          {plan.fase_1.hosp_ventilatorio === "si" && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Ireton flags</Label>
                              <p className="font-medium">
                                Ventilatorio
                                {plan.fase_1.hosp_trauma === "si" ? " · Trauma" : ""}
                                {plan.fase_1.hosp_quemadura === "si" ? " · Quemadura" : ""}
                                {plan.fase_1.hosp_obesidad === "si" ? " · Obesidad" : ""}
                              </p>
                            </div>
                          )}
                          {plan.fase_1.nutricion_parenteral && (
                            <div className="col-span-2 rounded-md border bg-muted/30 p-3 space-y-2">
                              <Label className="text-xs text-muted-foreground">Nutrición parenteral</Label>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <p>Prot {Number(plan.fase_1.nutricion_parenteral.prot_g || 0).toFixed(1)} g ({plan.fase_1.nutricion_parenteral.prot_gkg} g/kg)</p>
                                <p>CHO {Number(plan.fase_1.nutricion_parenteral.cho_g || 0).toFixed(1)} g ({plan.fase_1.nutricion_parenteral.cho_gkg} g/kg)</p>
                                <p>Lípidos {Number(plan.fase_1.nutricion_parenteral.lip_g || 0).toFixed(1)} g ({Number(plan.fase_1.nutricion_parenteral.lip_gkg || 0).toFixed(2)} g/kg)</p>
                                <p>Flujo {Number(plan.fase_1.nutricion_parenteral.flujo_mg_kg_min || 0).toFixed(2)} mg/kg/min</p>
                                <p>Na {Number(plan.fase_1.nutricion_parenteral.na_total_meq || 0).toFixed(0)} mEq</p>
                                <p>K {Number(plan.fase_1.nutricion_parenteral.k_total_meq || 0).toFixed(0)} mEq</p>
                                <p>Ca {plan.fase_1.nutricion_parenteral.ca_meq_dia || "—"} mEq/día</p>
                                <p>P {plan.fase_1.nutricion_parenteral.p_mmol_dia || "—"} mMol/día</p>
                              </div>
                            </div>
                          )}
                          {plan.fase_1.requerimiento_energetico && (
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Requerimiento total</Label>
                              <p className="font-bold text-lg text-primary">{plan.fase_1.requerimiento_energetico} kcal</p>
                            </div>
                          )}
                        </div>
                      ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {plan.fase_1.peso_actual && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Peso Actual</Label>
                            <p className="font-medium">{plan.fase_1.peso_actual} kg</p>
                          </div>
                        )}
                        {plan.fase_1.altura && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Altura</Label>
                            <p className="font-medium">{plan.fase_1.altura} cm</p>
                          </div>
                        )}
                        {plan.fase_1.edad && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Edad</Label>
                            <p className="font-medium">{plan.fase_1.edad} años</p>
                          </div>
                        )}
                        {plan.fase_1.genero && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Género</Label>
                            <p className="font-medium capitalize">{plan.fase_1.genero}</p>
                          </div>
                        )}
                        {plan.fase_1.imc && (
                          <div>
                            <Label className="text-xs text-muted-foreground">IMC</Label>
                            <p className="font-medium">{plan.fase_1.imc}</p>
                          </div>
                        )}
                        {plan.fase_1.tmb && (
                          <div>
                            <Label className="text-xs text-muted-foreground">TMB (kcal)</Label>
                            <p className="font-medium">{plan.fase_1.tmb}</p>
                          </div>
                        )}
                        {plan.fase_1.requerimiento_energetico && (
                          <div className="col-span-2">
                            <Label className="text-xs text-muted-foreground">Requerimiento Energético</Label>
                            <p className="font-bold text-lg text-primary">{plan.fase_1.requerimiento_energetico} kcal</p>
                          </div>
                        )}
                      </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Fase 2: Fórmula Sintética de Consumo y Planeada */}
                {plan.fase_2 && (
                  (() => {
                    const f2Raw = plan.fase_2;
                    let f2: any = f2Raw;
                    if (typeof f2Raw === "string") {
                      try { f2 = JSON.parse(f2Raw); } catch { f2 = null; }
                    }
                    if (!f2) return null;

                    return (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            Fase 2: Fórmula Sintética de Consumo y Planeada
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="overflow-x-auto rounded-lg border border-teal-200">
                            <table className="w-full text-xs">
                              <thead className="bg-teal-50">
                                <tr>
                                  <th className="p-2 border-b border-teal-200">Kcal</th>
                                  <th className="p-2 border-b border-teal-200">Prot (g)</th>
                                  <th className="p-2 border-b border-teal-200">Grasa (g)</th>
                                  <th className="p-2 border-b border-teal-200">GS (g)</th>
                                  <th className="p-2 border-b border-teal-200">GM (g)</th>
                                  <th className="p-2 border-b border-teal-200">GP (g)</th>
                                  <th className="p-2 border-b border-teal-200">COL (mg)</th>
                                  <th className="p-2 border-b border-teal-200">CHOS (g)</th>
                                  <th className="p-2 border-b border-teal-200">Fibra (g)</th>
                                </tr>
                              </thead>
                              <tbody className="text-center">
                                <tr>
                                  <td className="p-2 font-bold">{f2.total_calorias || "---"}</td>
                                  <td className="p-2">{f2.proteinas_gramos || "---"}</td>
                                  <td className="p-2">{f2.grasas_gramos || "---"}</td>
                                  <td className="p-2">{f2.grasas_gs_gramos || "---"}</td>
                                  <td className="p-2">{f2.grasas_gm_gramos || "---"}</td>
                                  <td className="p-2">{f2.grasas_gp_gramos || "---"}</td>
                                  <td className="p-2">{f2.grasas_colesterol || "---"}</td>
                                  <td className="p-2">{f2.cho_gramos || "---"}</td>
                                  <td className="p-2">{f2.total_fibra || "---"}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                            <div className="p-2 bg-muted/20 rounded flex justify-between">
                              <span className="text-muted-foreground uppercase">Peso de Referencia:</span>
                              <span className="font-bold">{f2.peso_referencia} kg</span>
                            </div>
                            <div className="p-2 bg-muted/20 rounded flex justify-between">
                              <span className="text-muted-foreground uppercase">CHO Concentración:</span>
                              <span className="font-bold">{f2.cho_concent_gramos} g ({f2.cho_concent_amdr}%)</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()
                )}

                {/* Fase 3: Fórmula Sintética Desarrollada */}
                {plan.fase_3 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-5 w-5 text-primary" />
                        Fase 3: Fórmula Sintética Desarrollada
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {plan.fase_3.grupos_alimentos && (
                        (() => {
                          const gruposAlimentosRaw = plan.fase_3.grupos_alimentos;
                          let gruposAlimentos: any = gruposAlimentosRaw;

                          if (typeof gruposAlimentosRaw === "string") {
                            try {
                              gruposAlimentos = JSON.parse(gruposAlimentosRaw);
                            } catch {
                              gruposAlimentos = null;
                            }
                          }

                          if (!gruposAlimentos || typeof gruposAlimentos !== "object") {
                            return null;
                          }

                          const entries = Object.entries(gruposAlimentos);
                          if (entries.length === 0) return null;

                          return (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Grupos de alimentos (porciones)</Label>
                              <div className="overflow-x-auto rounded-lg border border-border">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      <th className="p-2 text-left font-medium">Grupo</th>
                                      <th className="p-2 text-right font-medium">Porciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {entries.map(([grupo, data]) => {
                                      const porciones = (data as any)?.porciones;
                                      return (
                                        <tr key={grupo} className="border-t border-border">
                                          <td className="p-2">{grupo}</td>
                                          <td className="p-2 text-right font-medium">{porciones ?? ""}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()
                      )}
                      {plan.fase_3.formula_desarrollada && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Fórmula Desarrollada</Label>
                          <p className="text-sm mt-1 whitespace-pre-line">{plan.fase_3.formula_desarrollada}</p>
                        </div>
                      )}
                      {plan.fase_3.distribucion_macronutrientes && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Distribución de Macronutrientes</Label>
                          <p className="text-sm mt-1 whitespace-pre-line">{plan.fase_3.distribucion_macronutrientes}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-4">
                        {plan.fase_3.proteinas_gramos && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Proteínas</Label>
                            <p className="font-medium">{plan.fase_3.proteinas_gramos} g</p>
                          </div>
                        )}
                        {plan.fase_3.carbohidratos_gramos && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Carbohidratos</Label>
                            <p className="font-medium">{plan.fase_3.carbohidratos_gramos} g</p>
                          </div>
                        )}
                        {plan.fase_3.grasas_gramos && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Grasas</Label>
                            <p className="font-medium">{plan.fase_3.grasas_gramos} g</p>
                          </div>
                        )}
                      </div>
                      {(plan.fase_3.fibra || plan.fase_3.vitaminas || plan.fase_3.minerales) && (
                        <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                          {plan.fase_3.fibra && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Fibra</Label>
                              <p className="text-sm">{plan.fase_3.fibra} g</p>
                            </div>
                          )}
                          {plan.fase_3.vitaminas && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Vitaminas</Label>
                              <p className="text-sm">{plan.fase_3.vitaminas}</p>
                            </div>
                          )}
                          {plan.fase_3.minerales && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Minerales</Label>
                              <p className="text-sm">{plan.fase_3.minerales}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Fase 4: Minuta Patrón e Ingredientes */}
                {plan.fase_4 && (
                  (() => {
                    const f4Raw = plan.fase_4;
                    let f4: any = f4Raw;
                    if (typeof f4Raw === "string") {
                      try { f4 = JSON.parse(f4Raw); } catch { f4 = null; }
                    }
                    if (!f4) return null;

                    const ingredientsGramos = f4.ingredientes_f4 || {};

                    return (
                      <Card className="border-teal-100 shadow-sm">
                        <CardHeader className="bg-teal-50/50 border-b border-teal-100">
                          <CardTitle className="flex items-center gap-2 text-base text-teal-800">
                            <Utensils className="h-5 w-5" />
                            Fase 4: Minuta Patrón y Detalle de Ingredientes (4 Semanas)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                          {loadingRecipes ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                              <RefreshCw className="h-8 w-8 animate-spin mb-4 opacity-20 text-teal-600" />
                              <p className="animate-pulse">Cargando detalles de ingredientes...</p>
                            </div>
                          ) : enrichedMenu ? (
                            <Tabs defaultValue="1" className="w-full">
                              <TabsList className="flex w-full mb-6 bg-teal-50/50 p-1">
                                {[1, 2, 3, 4].map((w) => (
                                  <TabsTrigger key={w} value={w.toString()} className="flex-1 data-[state=active]:bg-teal-600 data-[state=active]:text-white">
                                    Semana {w}
                                  </TabsTrigger>
                                ))}
                              </TabsList>

                              {[1, 2, 3, 4].map((w) => (
                                <TabsContent key={w} value={w.toString()} className="mt-0">
                                  {(() => {
                                    const weekDays = enrichedMenu.week.filter((d: any) => d.week === w || (!d.week && w === 1));
                                    if (weekDays.length === 0) return <p className="text-center py-8 text-muted-foreground">No hay datos para la semana {w}</p>;

                                    return (
                                      <Tabs defaultValue={weekDays[0]?.day} className="w-full">
                                        <TabsList className="grid w-full grid-cols-7 mb-6">
                                          {weekDays.map((day: any) => (
                                            <TabsTrigger key={day.day} value={day.day} className="text-[10px] md:text-xs">
                                              {day.day.substring(0, 3)}
                                            </TabsTrigger>
                                          ))}
                                        </TabsList>

                                        {weekDays.map((day: any) => (
                                          <TabsContent key={day.day} value={day.day} className="space-y-4 mt-0">
                                            <div className="flex items-center justify-between mb-2">
                                              <h4 className="font-bold text-teal-700">{day.day}</h4>
                                              <Badge variant="outline" className="text-[10px] uppercase bg-teal-50">
                                                {day.meals.length} Comidas
                                              </Badge>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                              {day.meals.map((meal: any, mealIdx: number) => (
                                                <Card key={`${day.day}-${mealIdx}`} className="border-teal-50 shadow-none bg-teal-50/20">
                                                  <CardHeader className="py-2 px-3 border-b border-teal-100 flex flex-row items-center justify-between space-y-0">
                                                    <div>
                                                      <span className="text-[10px] font-bold uppercase text-teal-600 block leading-tight">
                                                        {meal.type}
                                                      </span>
                                                      <span className="text-xs font-semibold text-teal-900">{meal.recipe_name}</span>
                                                    </div>
                                                    <Badge variant="secondary" className="text-[9px] bg-teal-100/50 text-teal-700">
                                                      {meal.calories} kcal
                                                    </Badge>
                                                  </CardHeader>
                                                  <CardContent className="py-3 px-3">
                                                    {meal.recipeDetails?.ingredients && meal.recipeDetails.ingredients.length > 0 ? (
                                                      <div className="space-y-2">
                                                        {meal.recipeDetails.ingredients.map((ing: string, ingIdx: number) => {
                                                          const grams = ingredientsGramos[day.day]?.[mealIdx]?.[ing] || "---";
                                                          return (
                                                            <div key={ingIdx} className="flex items-center justify-between text-xs py-1 border-b border-teal-50/50 last:border-0">
                                                              <span className="text-muted-foreground">{ing}</span>
                                                              <span className="font-bold text-teal-700">{grams} g</span>
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    ) : (
                                                      <p className="text-[10px] text-center text-muted-foreground italic">
                                                        Sin detalles de ingredientes
                                                      </p>
                                                    )}
                                                  </CardContent>
                                                </Card>
                                              ))}
                                            </div>
                                          </TabsContent>
                                        ))}
                                      </Tabs>
                                    );
                                  })()}
                                </TabsContent>
                              ))}
                            </Tabs>
                          ) : (
                            <div className="bg-teal-50 border border-teal-100 p-4 rounded-lg flex items-center gap-3">
                              <AlertCircle className="h-5 w-5 text-teal-500" />
                              <div className="text-sm">
                                <p className="font-bold text-teal-800">Visualización no disponible</p>
                                <p className="text-teal-700">No se pudo cargar el desglose de ingredientes para este plan.</p>
                              </div>
                            </div>
                          )}

                          {f4.observaciones && (
                            <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border">
                              <Label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">
                                Observaciones y Recomendaciones
                              </Label>
                              <p className="text-sm italic text-foreground whitespace-pre-line leading-relaxed">
                                {f4.observaciones}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()
                )}
              </div>
            </TabsContent>

            <TabsContent value="menu" className="space-y-4">
              {loadingMenu ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin mb-4 opacity-20" />
                  <p>Cargando información del menú...</p>
                </div>
              ) : weeklyMenu ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Menú Semanal (4 Semanas)
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Consulte la programación para cada semana
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => plan && fetchWeeklyMenu(plan.id)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Recargar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="1" className="w-full">
                      <TabsList className="flex w-full mb-6 bg-muted/50 p-1">
                        {[1, 2, 3, 4].map((w) => (
                          <TabsTrigger key={w} value={w.toString()} className="flex-1">
                            Semana {w}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {[1, 2, 3, 4].map((w) => (
                        <TabsContent key={w} value={w.toString()} className="mt-0 space-y-4">
                          {(() => {
                            const weekDays = weeklyMenu.week.filter(d => (d as any).week === w || (!(d as any).week && w === 1));
                            if (weekDays.length === 0) return <p className="text-center py-8 text-muted-foreground">No hay datos para la semana {w}</p>;

                            return (
                              <Tabs defaultValue={weekDays[0]?.day} className="w-full">
                                <TabsList className="grid w-full grid-cols-7 mb-4">
                                  {weekDays.map((day) => (
                                    <TabsTrigger key={day.day} value={day.day} className="text-[10px] md:text-xs">
                                      {day.day.substring(0, 3)}
                                    </TabsTrigger>
                                  ))}
                                </TabsList>
                                {weekDays.map((day: { day: string; meals: MealData[] }) => (
                                  <TabsContent key={day.day} value={day.day} className="mt-0">
                                    <div className="mb-3">
                                      <h4 className="font-semibold text-foreground">{day.day}</h4>
                                      <p className="text-xs text-muted-foreground">
                                        {day.meals.length} comida{day.meals.length !== 1 ? 's' : ''} configurada{day.meals.length !== 1 ? 's' : ''}
                                      </p>
                                    </div>
                                    {renderDayMenu(day)}
                                  </TabsContent>
                                ))}
                              </Tabs>
                            );
                          })()}
                        </TabsContent>
                      ))}
                    </Tabs>
                  </CardContent>
                </Card>
              ) : (
                <AssignMenuSection planId={plan.id} onAssignSuccess={() => fetchWeeklyMenu(plan.id)} />
              )}
            </TabsContent>
          </Tabs>
        )}

        {!isEditing && (
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
