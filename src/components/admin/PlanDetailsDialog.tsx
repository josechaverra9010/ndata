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
  almuerzo: "Snack AM",
  morning_snack: "Snack AM",
  comida: "Almuerzo",
  lunch: "Almuerzo",
  merienda: "Snack PM",
  afternoon_snack: "Snack PM",
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
      const response = await fetch(`${API_URL}/weekly-menus-complete`);
      if (response.ok) {
        const data = await response.json();
        setMenus(data);
      }
    } catch (error) {
      console.error("Error fetching menus:", error);
      toast.error("Error al cargar menús disponibles");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedMenuId) return;

    setAssigning(true);
    try {
      const response = await fetch(`${API_URL}/meal-plans/${planId}/assign-menu`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekly_menu_id: parseInt(selectedMenuId) }),
      });

      if (response.ok) {
        toast.success("Menú asignado correctamente");
        onAssignSuccess();
      } else {
        toast.error("Error al asignar el menú");
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
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    calories: "",
    duration: "",
    category: "",
    color: "primary",
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

  const fetchWeeklyMenu = async (planId: number) => {
    console.log(`🔍 Buscando menú para plan ${planId}...`);
    setLoadingMenu(true);
    try {
      const response = await fetch(`${API_URL}/weekly-menus/by-plan/${planId}`);

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Menú recibido:", data);
        setWeeklyMenu(data);
      } else if (response.status === 404 || response.status === 204) {
        console.log("⚠️ No hay menú asignado");
        setWeeklyMenu(null);
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
              <Badge variant="outline" className={categoryColors[plan.color as keyof typeof categoryColors]}>
                {plan.category}
              </Badge>
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
            {/* ... (mantén todo el formulario igual) ... */}
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
              <TabsTrigger value="example">Ejemplo</TabsTrigger>
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
                        Fase 1: Requerimiento Energético y Peso Saludable
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
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
                    </CardContent>
                  </Card>
                )}

                {/* Fase 2: Fórmula Sintética de Consumo y Planeada */}
                {plan.fase_2 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ClipboardList className="h-5 w-5 text-primary" />
                        Fase 2: Fórmula Sintética de Consumo y Planeada
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {plan.fase_2.formula_consumo_actual && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Fórmula de Consumo Actual</Label>
                          <p className="text-sm mt-1">{plan.fase_2.formula_consumo_actual}</p>
                        </div>
                      )}
                      {plan.fase_2.formula_planeada && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Fórmula Planeada</Label>
                          <p className="text-sm mt-1">{plan.fase_2.formula_planeada}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        {plan.fase_2.distribucion_calorica_actual && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Distribución Calórica Actual</Label>
                            <p className="text-sm mt-1 whitespace-pre-line">{plan.fase_2.distribucion_calorica_actual}</p>
                          </div>
                        )}
                        {plan.fase_2.distribucion_calorica_planeada && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Distribución Calórica Planeada</Label>
                            <p className="text-sm mt-1 whitespace-pre-line">{plan.fase_2.distribucion_calorica_planeada}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
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

                {/* Fase 4: Minuta Patrón */}
                {plan.fase_4 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Utensils className="h-5 w-5 text-primary" />
                        Fase 4: Minuta Patrón
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 gap-3">
                        {plan.fase_4.desayuno && (
                          <div className="p-3 rounded-lg bg-muted/30">
                            <Label className="text-xs text-muted-foreground flex items-center gap-2">
                              <Sun className="h-4 w-4" />
                              Desayuno
                            </Label>
                            <p className="text-sm mt-1 whitespace-pre-line">{plan.fase_4.desayuno}</p>
                          </div>
                        )}
                        {plan.fase_4.media_manana && (
                          <div className="p-3 rounded-lg bg-muted/30">
                            <Label className="text-xs text-muted-foreground flex items-center gap-2">
                              <Coffee className="h-4 w-4" />
                              Media Mañana
                            </Label>
                            <p className="text-sm mt-1 whitespace-pre-line">{plan.fase_4.media_manana}</p>
                          </div>
                        )}
                        {plan.fase_4.almuerzo && (
                          <div className="p-3 rounded-lg bg-muted/30">
                            <Label className="text-xs text-muted-foreground flex items-center gap-2">
                              <UtensilsCrossed className="h-4 w-4" />
                              Almuerzo
                            </Label>
                            <p className="text-sm mt-1 whitespace-pre-line">{plan.fase_4.almuerzo}</p>
                          </div>
                        )}
                        {plan.fase_4.media_tarde && (
                          <div className="p-3 rounded-lg bg-muted/30">
                            <Label className="text-xs text-muted-foreground flex items-center gap-2">
                              <Coffee className="h-4 w-4" />
                              Media Tarde
                            </Label>
                            <p className="text-sm mt-1 whitespace-pre-line">{plan.fase_4.media_tarde}</p>
                          </div>
                        )}
                        {plan.fase_4.cena && (
                          <div className="p-3 rounded-lg bg-muted/30">
                            <Label className="text-xs text-muted-foreground flex items-center gap-2">
                              <Moon className="h-4 w-4" />
                              Cena
                            </Label>
                            <p className="text-sm mt-1 whitespace-pre-line">{plan.fase_4.cena}</p>
                          </div>
                        )}
                        {plan.fase_4.snack_nocturno && (
                          <div className="p-3 rounded-lg bg-muted/30">
                            <Label className="text-xs text-muted-foreground flex items-center gap-2">
                              <Moon className="h-4 w-4" />
                              Snack Nocturno
                            </Label>
                            <p className="text-sm mt-1 whitespace-pre-line">{plan.fase_4.snack_nocturno}</p>
                          </div>
                        )}
                        {plan.fase_4.observaciones && (
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <Label className="text-xs text-muted-foreground">Observaciones</Label>
                            <p className="text-sm mt-1 whitespace-pre-line">{plan.fase_4.observaciones}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!plan.fase_1 && !plan.fase_2 && !plan.fase_3 && !plan.fase_4 && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        Este plan no tiene información de las 4 fases registrada.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Los planes creados con el nuevo sistema incluirán esta información.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="menu" className="space-y-4">
              {loadingMenu ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-sm text-muted-foreground">Cargando menú semanal...</p>
                </div>
              ) : weeklyMenu ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Menú Semanal Asignado
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Semana {weeklyMenu.week_number}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          Activo
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWeeklyMenu(null)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Cambiar Menú
                        </Button>
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
                    <Tabs defaultValue={weeklyMenu.week[0]?.day} className="w-full">
                      <TabsList className="grid w-full grid-cols-7 mb-4">
                        {weeklyMenu.week.map((day) => (
                          <TabsTrigger key={day.day} value={day.day} className="text-xs">
                            {day.day.substring(0, 3)}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {weeklyMenu.week.map((day) => (
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
                  </CardContent>
                </Card>
              ) : (
                <AssignMenuSection planId={plan.id} onAssignSuccess={() => fetchWeeklyMenu(plan.id)} />
              )}
            </TabsContent>

            <TabsContent value="example" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Comidas del Día (Ejemplo)</CardTitle>
                  <p className="text-sm text-muted-foreground">Estructura sugerida de comidas diarias</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { meal: "Desayuno", time: "08:00", desc: "Avena con frutas y nueces", cal: 350 },
                      { meal: "Media Mañana", time: "11:00", desc: "Yogur griego con almendras", cal: 200 },
                      { meal: "Almuerzo", time: "14:00", desc: "Pollo a la plancha con verduras", cal: 500 },
                      { meal: "Merienda", time: "17:00", desc: "Tostada integral con aguacate", cal: 250 },
                      { meal: "Cena", time: "20:00", desc: "Salmón con ensalada", cal: 400 },
                    ].slice(0, plan.meals_per_day).map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Apple className="h-4 w-4 text-primary" />
                          <div>
                            <p className="font-medium text-foreground text-sm">{item.meal}</p>
                            <p className="text-xs text-muted-foreground">{item.desc}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">{item.cal} kcal</p>
                          <p className="text-xs text-muted-foreground">{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 rounded-lg bg-info/10 border border-info/20">
                    <p className="text-xs text-muted-foreground">
                      Este es un ejemplo de estructura. Puedes personalizar las comidas específicas en la sección de menús semanales.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {!isEditing && (
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}