import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Calendar,
  ChefHat,
  Clock,
  Flame,
  LayoutGrid,
  Edit,
  Trash2,
  Check,
  Beef,
  Wheat,
  Droplets,
  Apple,
  Coffee,
  Sandwich,
  Moon,
} from "lucide-react";
import { API_URL } from "@/config/api";
import { MEAL_SCHEDULE } from "@/config/mealSchedule";
import { useToast } from "@/hooks/use-toast";

export interface CreatedWeeklyMenu {
  id: number;
  name: string;
  description?: string;
  category?: string;
  total_calories?: number;
  assigned_patients?: number;
  week?: DayMenu[];
}

interface Recipe {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTime?: number;
  image?: string;
  ingredients?: string[];
  instructions?: string[];
}

interface MealSlot {
  type: "desayuno" | "almuerzo" | "comida" | "merienda" | "cena";
  recipe_id?: number;
  recipe_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  notes?: string;
  image?: string;
  ingredients?: string[];
  instructions?: string[];
}

interface DayMenu {
  day: string;
  week: number;
  meals: MealSlot[];
}

interface CreateWeeklyMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (menu: CreatedWeeklyMenu) => void;
}

const daysOfWeek = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const menuCategories = [
  "Pérdida de peso",
  "Ganancia muscular",
  "Mantenimiento",
  "Vegetariano",
  "Vegano",
] as const;

const mealTypeIcons = {
  desayuno: Coffee,
  almuerzo: Apple,
  comida: ChefHat,
  merienda: Sandwich,
  cena: Moon,
};

const mealTypeColors = {
  desayuno: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", ring: "ring-orange-500/20", bar: "bg-orange-500" },
  almuerzo: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20", bar: "bg-emerald-500" },
  comida: { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", ring: "ring-sky-500/20", bar: "bg-sky-500" },
  merienda: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/20", bar: "bg-violet-500" },
  cena: { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", ring: "ring-indigo-500/20", bar: "bg-indigo-500" },
};

const mealTypes = MEAL_SCHEDULE.map((m) => ({
  type: m.type,
  label: m.label,
  icon: mealTypeIcons[m.type],
  time: m.time,
  timeRange: m.timeRange,
  colors: mealTypeColors[m.type],
}));

const createEmptyWeek = (): DayMenu[] => {
  const weeks: DayMenu[] = [];
  for (let w = 1; w <= 4; w++) {
    weeks.push(
      ...daysOfWeek.map((day) => ({
        day,
        week: w,
        meals: mealTypes.map((mt) => ({
          type: mt.type,
          recipe_name: "",
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          time: mt.time,
          notes: "",
        })),
      }))
    );
  }
  return weeks;
};

const getImageUrl = (imagePath: string | undefined | null) => {
  if (!imagePath || typeof imagePath !== "string") {
    return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
  }
  const trimmed = imagePath.trim();
  if (!trimmed) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
  if (trimmed.startsWith("http")) return trimmed;
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const baseUrl = API_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");
  return `${baseUrl}${path}`;
};

export function CreateWeeklyMenuDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateWeeklyMenuDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [menuForm, setMenuForm] = useState({
    name: "",
    description: "",
    category: "Pérdida de peso",
  });
  const [currentWeek, setCurrentWeek] = useState<DayMenu[]>(createEmptyWeek());
  const [currentWeekTab, setCurrentWeekTab] = useState("1");
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [currentDay, setCurrentDay] = useState("");
  const [currentMealType, setCurrentMealType] = useState<MealSlot["type"] | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [mealNotes, setMealNotes] = useState("");

  const resetForm = () => {
    setMenuForm({ name: "", description: "", category: "Pérdida de peso" });
    setCurrentWeek(createEmptyWeek());
    setCurrentWeekTab("1");
    setRecipeSearch("");
    setSelectedRecipe(null);
    setMealNotes("");
    setAddMealOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
    const token = localStorage.getItem("userToken");
    fetch(`${API_URL}/recipes`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => setRecipes(Array.isArray(data) ? data : []))
      .catch(() => setRecipes([]));
  }, [open]);

  const currentTotals = useMemo(() => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    currentWeek.forEach((day) => {
      day.meals.forEach((meal) => {
        if (meal.recipe_name) {
          totalCalories += meal.calories;
          totalProtein += meal.protein;
          totalCarbs += meal.carbs;
          totalFat += meal.fat;
        }
      });
    });
    const daysWithMeals = currentWeek.filter((day) =>
      day.meals.some((meal) => meal.recipe_name)
    ).length;
    return {
      total_calories: daysWithMeals > 0 ? Math.round(totalCalories / daysWithMeals) : 0,
      avg_protein: daysWithMeals > 0 ? Math.round(totalProtein / daysWithMeals) : 0,
      avg_carbs: daysWithMeals > 0 ? Math.round(totalCarbs / daysWithMeals) : 0,
      avg_fat: daysWithMeals > 0 ? Math.round(totalFat / daysWithMeals) : 0,
    };
  }, [currentWeek]);

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name?.toLowerCase().includes(q));
  }, [recipes, recipeSearch]);

  const handleAddMeal = (day: string, mealType: MealSlot["type"]) => {
    setCurrentDay(day);
    setCurrentMealType(mealType);
    setSelectedRecipe(null);
    setMealNotes("");
    setRecipeSearch("");
    setAddMealOpen(true);
  };

  const handleConfirmAddMeal = () => {
    if (!selectedRecipe || !currentDay || !currentMealType) return;
    const weekNum = parseInt(currentWeekTab);
    setCurrentWeek((prev) =>
      prev.map((dayMenu) => {
        if (dayMenu.day !== currentDay || dayMenu.week !== weekNum) return dayMenu;
        return {
          ...dayMenu,
          meals: dayMenu.meals.map((meal) =>
            meal.type === currentMealType
              ? {
                  type: meal.type,
                  recipe_id: selectedRecipe.id,
                  recipe_name: selectedRecipe.name,
                  calories: selectedRecipe.calories || 0,
                  protein: selectedRecipe.protein || 0,
                  carbs: selectedRecipe.carbs || 0,
                  fat: selectedRecipe.fat || 0,
                  time: meal.time,
                  notes: mealNotes,
                  image: selectedRecipe.image,
                  ingredients: selectedRecipe.ingredients,
                  instructions: selectedRecipe.instructions,
                }
              : meal
          ),
        };
      })
    );
    setAddMealOpen(false);
    setSelectedRecipe(null);
    setMealNotes("");
  };

  const handleRemoveMeal = (day: string, mealType: MealSlot["type"]) => {
    const weekNum = parseInt(currentWeekTab);
    setCurrentWeek((prev) =>
      prev.map((dayMenu) => {
        if (dayMenu.day !== day || dayMenu.week !== weekNum) return dayMenu;
        return {
          ...dayMenu,
          meals: dayMenu.meals.map((meal) => {
            if (meal.type !== mealType) return meal;
            const mealTypeInfo = mealTypes.find((mt) => mt.type === mealType);
            return {
              type: meal.type,
              recipe_name: "",
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              time: mealTypeInfo?.time || meal.time,
              notes: "",
            };
          }),
        };
      })
    );
  };

  const handleCreate = async () => {
    if (!menuForm.name.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Ingresa un nombre para el menú",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/weekly-menus`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: menuForm.name.trim(),
          description: menuForm.description.trim(),
          category: menuForm.category,
          week: currentWeek,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.detail || result.message || "No se pudo crear el menú");
      }

      const created: CreatedWeeklyMenu = result.menu || {
        id: result.id,
        name: menuForm.name.trim(),
        description: menuForm.description.trim(),
        category: menuForm.category,
        total_calories: currentTotals.total_calories,
        assigned_patients: 0,
      };

      toast({
        title: "Menú creado",
        description: `"${created.name}" está listo para asignar`,
      });
      onCreated(created);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error creating menu:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al crear el menú",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent className="max-w-6xl w-[calc(100%-2rem)] max-h-[92vh] p-0 gap-0 overflow-hidden !flex !flex-col z-[60]">
          <div className="relative shrink-0 border-b bg-gradient-to-br from-primary/10 via-background to-accent/10 px-6 pt-6 pb-4">
            <DialogHeader className="pr-8 space-y-1">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm">
                  <Calendar className="h-[18px] w-[18px]" />
                </span>
                Crear menú semanal
              </DialogTitle>
              <DialogDescription>
                Define los datos del menú y asigna recetas. Luego podrás usarlo en la asignación del plan.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl border bg-background/80 backdrop-blur-sm px-3 py-2.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  Energía
                </div>
                <p className="text-lg font-bold tracking-tight">
                  {currentTotals.total_calories}
                  <span className="text-xs font-medium text-muted-foreground ml-1">kcal/día</span>
                </p>
              </div>
              <div className="rounded-xl border bg-background/80 backdrop-blur-sm px-3 py-2.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <Beef className="h-3.5 w-3.5 text-rose-500" />
                  Proteína
                </div>
                <p className="text-lg font-bold tracking-tight">
                  {currentTotals.avg_protein}
                  <span className="text-xs font-medium text-muted-foreground ml-1">g</span>
                </p>
              </div>
              <div className="rounded-xl border bg-background/80 backdrop-blur-sm px-3 py-2.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <Wheat className="h-3.5 w-3.5 text-amber-500" />
                  Carbos
                </div>
                <p className="text-lg font-bold tracking-tight">
                  {currentTotals.avg_carbs}
                  <span className="text-xs font-medium text-muted-foreground ml-1">g</span>
                </p>
              </div>
              <div className="rounded-xl border bg-background/80 backdrop-blur-sm px-3 py-2.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <Droplets className="h-3.5 w-3.5 text-sky-500" />
                  Grasas
                </div>
                <p className="text-lg font-bold tracking-tight">
                  {currentTotals.avg_fat}
                  <span className="text-xs font-medium text-muted-foreground ml-1">g</span>
                </p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 max-h-[calc(92vh-14rem)]">
            <div className="space-y-6">
              <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <ChefHat className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Información general</h3>
                    <p className="text-xs text-muted-foreground">Nombre, categoría y descripción</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-menu-name">Nombre del menú</Label>
                    <Input
                      id="create-menu-name"
                      placeholder="Ej. Menú hipocalórico 1800 kcal"
                      value={menuForm.name}
                      onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select
                      value={menuForm.category}
                      onValueChange={(v) => setMenuForm({ ...menuForm, category: v })}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        {menuCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="create-menu-desc">Descripción</Label>
                    <Textarea
                      id="create-menu-desc"
                      placeholder="Enfoque del menú, restricciones o notas clínicas..."
                      value={menuForm.description}
                      onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                    <LayoutGrid className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Plan semanal</h3>
                    <p className="text-xs text-muted-foreground">
                      Opcional: puedes crear el menú vacío y completar recetas después
                    </p>
                  </div>
                </div>

                <Tabs value={currentWeekTab} onValueChange={setCurrentWeekTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-4 h-11 p-1 rounded-xl bg-muted/70">
                    {[1, 2, 3, 4].map((num) => (
                      <TabsTrigger
                        key={num}
                        value={num.toString()}
                        className="rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                      >
                        Semana {num}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {[1, 2, 3, 4].map((weekNum) => (
                    <TabsContent key={weekNum} value={weekNum.toString()} className="mt-4 space-y-4">
                      <Tabs defaultValue="Lunes" className="w-full">
                        <TabsList className="flex w-full h-auto flex-wrap gap-1 p-1 rounded-xl bg-muted/50 justify-start">
                          {daysOfWeek.map((day) => {
                            const dayMenu = currentWeek.find((d) => d.day === day && d.week === weekNum);
                            const filled = dayMenu?.meals.filter((m) => m.recipe_name).length || 0;
                            return (
                              <TabsTrigger
                                key={day}
                                value={day}
                                className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 min-w-[4.5rem]"
                              >
                                <span className="flex flex-col items-center gap-0.5">
                                  <span className="font-medium">{day.slice(0, 3)}</span>
                                  <span className={`text-[10px] ${filled === 5 ? "text-emerald-600" : "text-muted-foreground"}`}>
                                    {filled}/5
                                  </span>
                                </span>
                              </TabsTrigger>
                            );
                          })}
                        </TabsList>

                        {daysOfWeek.map((day) => {
                          const dayMenu = currentWeek.find((d) => d.day === day && d.week === weekNum);
                          const filledCount = dayMenu?.meals.filter((m) => m.recipe_name).length || 0;
                          const dayKcal = dayMenu?.meals.reduce((s, m) => s + (m.calories || 0), 0) || 0;
                          return (
                            <TabsContent key={day} value={day} className="space-y-4 mt-4">
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2.5">
                                <div>
                                  <h4 className="font-semibold text-sm">
                                    {day} · Semana {weekNum}
                                  </h4>
                                  <p className="text-xs text-muted-foreground">{dayKcal} kcal del día</p>
                                </div>
                                <Badge variant="outline" className="rounded-full px-3">
                                  {filledCount}/5 comidas
                                </Badge>
                              </div>

                              <div className="space-y-3">
                                {mealTypes.map((mealType) => {
                                  const meal = dayMenu?.meals.find((m) => m.type === mealType.type);
                                  const MealIcon = mealType.icon;
                                  const hasRecipe = !!meal?.recipe_name;
                                  return (
                                    <div
                                      key={mealType.type}
                                      className={`relative overflow-hidden rounded-2xl border transition-all ${
                                        hasRecipe
                                          ? "bg-card shadow-sm"
                                          : "bg-muted/20 border-dashed hover:border-primary/40"
                                      }`}
                                    >
                                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${mealType.colors.bar}`} />
                                      <div className="p-4 pl-5">
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                          <div className="flex items-center gap-3 min-w-0">
                                            <div className={`p-2.5 rounded-xl ring-1 ${mealType.colors.bg} ${mealType.colors.ring}`}>
                                              <MealIcon className={`h-4 w-4 ${mealType.colors.text}`} />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="font-semibold text-sm">{mealType.label}</p>
                                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {mealType.timeRange}
                                              </p>
                                            </div>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant={hasRecipe ? "outline" : "default"}
                                            className="shrink-0 rounded-full"
                                            onClick={() => handleAddMeal(day, mealType.type)}
                                          >
                                            {hasRecipe ? (
                                              <>
                                                <Edit className="h-3.5 w-3.5 mr-1.5" />
                                                Cambiar
                                              </>
                                            ) : (
                                              <>
                                                <Plus className="h-3.5 w-3.5 mr-1.5" />
                                                Agregar
                                              </>
                                            )}
                                          </Button>
                                        </div>

                                        {hasRecipe ? (
                                          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-border/60">
                                            <img
                                              src={getImageUrl(meal?.image)}
                                              alt={meal?.recipe_name}
                                              className="w-16 h-16 rounded-xl object-cover bg-muted shadow-sm"
                                              onError={(e) => {
                                                (e.target as HTMLImageElement).src =
                                                  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
                                              }}
                                            />
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium text-sm truncate">{meal!.recipe_name}</p>
                                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                <Badge variant="secondary" className="rounded-md text-[10px] px-1.5 py-0">
                                                  {meal!.calories} kcal
                                                </Badge>
                                                <Badge variant="secondary" className="rounded-md text-[10px] px-1.5 py-0">
                                                  P {meal!.protein}g
                                                </Badge>
                                                <Badge variant="secondary" className="rounded-md text-[10px] px-1.5 py-0">
                                                  C {meal!.carbs}g
                                                </Badge>
                                                <Badge variant="secondary" className="rounded-md text-[10px] px-1.5 py-0">
                                                  G {meal!.fat}g
                                                </Badge>
                                              </div>
                                            </div>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                              onClick={() => handleRemoveMeal(day, mealType.type)}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleAddMeal(day, mealType.type)}
                                            className="w-full rounded-xl border border-dashed border-muted-foreground/25 bg-background/50 py-5 text-center text-sm text-muted-foreground hover:border-primary/40 hover:text-primary"
                                          >
                                            Sin receta · clic para agregar
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </TabsContent>
                  ))}
                </Tabs>
              </section>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t bg-muted/30 px-6 py-4 gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button className="rounded-full min-w-[140px]" disabled={saving} onClick={handleCreate}>
              {saving ? (
                "Creando..."
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Crear menú
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addMealOpen} onOpenChange={setAddMealOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden !flex !flex-col z-[80]">
          <div className="shrink-0 border-b bg-gradient-to-br from-primary/10 via-background to-background px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <ChefHat className="h-4 w-4" />
                </span>
                Seleccionar receta
              </DialogTitle>
              <DialogDescription>
                Elige una receta para {currentMealType || "esta comida"}
                {currentDay ? ` · ${currentDay}` : ""}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-4 max-h-[calc(90vh-11rem)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar receta..."
                className="pl-9 h-10 rounded-xl"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              {filteredRecipes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay recetas disponibles. Crea recetas primero en el módulo de Recetas.
                </p>
              ) : (
                filteredRecipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                      selectedRecipe?.id === recipe.id
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "hover:bg-muted/50 hover:border-muted-foreground/20"
                    }`}
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    <img
                      src={getImageUrl(recipe.image)}
                      alt={recipe.name}
                      className="w-16 h-16 rounded-xl object-cover shadow-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{recipe.name}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                        <span className="inline-flex items-center gap-1">
                          <Flame className="h-3 w-3 text-orange-500" />
                          {recipe.calories} kcal
                        </span>
                        {recipe.prepTime != null && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {recipe.prepTime} min
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedRecipe?.id === recipe.id && (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={mealNotes}
                onChange={(e) => setMealNotes(e.target.value)}
                placeholder="Instrucciones especiales, porciones, sustituciones..."
                rows={2}
                className="resize-none rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-muted/30 px-6 py-4">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setAddMealOpen(false);
                setSelectedRecipe(null);
                setMealNotes("");
              }}
            >
              Cancelar
            </Button>
            <Button className="rounded-full" onClick={handleConfirmAddMeal} disabled={!selectedRecipe}>
              <Plus className="h-4 w-4 mr-1.5" />
              Agregar receta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
