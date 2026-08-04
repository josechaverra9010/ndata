import { useState, useEffect } from "react";
import { API_URL } from "@/config/api";
import { MEAL_SCHEDULE } from "@/config/mealSchedule";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Search, Plus, Calendar, ChefHat, Clock, Flame, LayoutGrid,
    Edit, Trash2, Copy, MoreVertical, Apple, Coffee, Sandwich,
    Moon, Filter, Check, Beef, Wheat, Droplets, X, Users, Eye
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BulkAssignMenuDialog } from "@/components/admin/BulkAssignMenuDialog";

// El API_URL se importa desde @/config/api

// Interfaces
interface Recipe {
    id: number;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    prepTime: number;
    image: string;
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
    imagen?: string; // compatibilidad con API
    ingredients?: string[];
    instructions?: string[];
}

interface DayMenu {
    day: string;
    week: number;
    meals: MealSlot[];
}

interface WeeklyMenu {
    id: number;
    name: string;
    description: string;
    category: string;
    week: DayMenu[];
    total_calories: number;
    avg_protein: number;
    avg_carbs: number;
    avg_fat: number;
    assigned_patients: number;
    is_active: boolean;
    created_at: string;
}

interface Stats {
    total_menus: number;
    total_assigned_patients: number;
    avg_calories: number;
    total_recipes_used: number;
}

const daysOfWeek = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const menuCategories = [
    "Pérdida de peso",
    "Ganancia muscular",
    "Mantenimiento",
    "Vegetariano",
    "Vegano",
] as const;

const mealTypeIcons = { desayuno: Coffee, almuerzo: Apple, comida: ChefHat, merienda: Sandwich, cena: Moon };
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

const AdminWeeklyMenus = () => {
    const [weeklyMenus, setWeeklyMenus] = useState<WeeklyMenu[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [stats, setStats] = useState<Stats>({ total_menus: 0, total_assigned_patients: 0, avg_calories: 0, total_recipes_used: 0 });
    const [error, setError] = useState<string | null>(null);

    // Dialog states
    const [newMenuOpen, setNewMenuOpen] = useState(false);
    const [editMenuOpen, setEditMenuOpen] = useState(false);
    const [viewMenuOpen, setViewMenuOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [addMealDialogOpen, setAddMealDialogOpen] = useState(false);
    const [assignMenuOpen, setAssignMenuOpen] = useState(false);
    const [menuToAssign, setMenuToAssign] = useState<WeeklyMenu | null>(null);

    // Selected data
    const [selectedMenu, setSelectedMenu] = useState<WeeklyMenu | null>(null);
    const [menuToDelete, setMenuToDelete] = useState<WeeklyMenu | null>(null);
    const [currentDay, setCurrentDay] = useState<string>("");
    const [currentMealType, setCurrentMealType] = useState<MealSlot["type"] | null>(null);

    // Form states
    const [menuForm, setMenuForm] = useState({
        name: "",
        description: "",
        category: "Pérdida de peso",
    });

    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [mealNotes, setMealNotes] = useState("");

    const getImageUrl = (imagePath: string | undefined | null) => {
        if (!imagePath || typeof imagePath !== "string") return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
        const trimmed = imagePath.trim();
        if (!trimmed) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
        if (trimmed.startsWith("http")) return trimmed;
        const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
        const baseUrl = API_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");
        return `${baseUrl}${path}`;
    };

    const getMealImageUrl = (meal: MealSlot | undefined) =>
        getImageUrl(meal?.image ?? (meal as MealSlot & { imagen?: string })?.imagen);

    // Initialize empty week (now 4 weeks)
    const createEmptyWeek = (): DayMenu[] => {
        const weeks = [];
        for (let w = 1; w <= 4; w++) {
            weeks.push(...daysOfWeek.map(day => ({
                day,
                week: w,
                meals: mealTypes.map(mt => ({
                    type: mt.type,
                    recipe_name: "",
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fat: 0,
                    time: mt.time,
                    notes: "",
                })),
            })));
        }
        return weeks;
    };

    const [currentWeek, setCurrentWeek] = useState<DayMenu[]>(createEmptyWeek());

    // Load data
    useEffect(() => {
        fetchWeeklyMenus();
        fetchRecipes();
    }, [categoryFilter]);

    // Calculate stats when menus change
    useEffect(() => {
        if (weeklyMenus.length > 0) {
            calculateLocalStats();
        }
    }, [weeklyMenus]);

    const fetchWeeklyMenus = async () => {
        setLoading(true);
        setError(null);
        try {
            let url = `${API_URL}/weekly-menus`;
            const params = new URLSearchParams();
            if (categoryFilter) params.append('category', categoryFilter);
            if (params.toString()) url += `?${params.toString()}`;

            const token = localStorage.getItem("userToken");
            const response = await fetch(url, {
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (Array.isArray(data)) {
                setWeeklyMenus(data);
            } else {
                console.error("La respuesta no es un array:", data);
                setWeeklyMenus([]);
                setError("Formato de datos incorrecto");
            }
        } catch (error) {
            console.error("Error fetching menus:", error);
            setWeeklyMenus([]);
            setError(error instanceof Error ? error.message : "Error al cargar menús");
        } finally {
            setLoading(false);
        }
    };

    const fetchRecipes = async () => {
        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/recipes`, {
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }

            const data = await response.json();

            if (Array.isArray(data)) {
                setRecipes(data);
            } else {
                console.error("Recipes data is not an array:", data);
                setRecipes([]);
            }
        } catch (error) {
            console.error("Error fetching recipes:", error);
            setRecipes([]);
        }
    };

    const calculateLocalStats = () => {
        const total_menus = weeklyMenus.length;
        const total_assigned_patients = weeklyMenus.reduce((sum, m) => sum + (m.assigned_patients || 0), 0);
        const avg_calories = weeklyMenus.length > 0
            ? Math.round(weeklyMenus.reduce((sum, m) => sum + m.total_calories, 0) / weeklyMenus.length)
            : 0;

        const uniqueRecipes = new Set();
        weeklyMenus.forEach(menu => {
            menu.week.forEach(day => {
                day.meals.forEach(meal => {
                    if (meal.recipe_id) {
                        uniqueRecipes.add(meal.recipe_id);
                    }
                });
            });
        });

        setStats({
            total_menus,
            total_assigned_patients,
            avg_calories,
            total_recipes_used: uniqueRecipes.size
        });
    };

    // Calcular totales automáticamente
    const calculateWeekTotals = (week: DayMenu[]) => {
        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let mealCount = 0;

        week.forEach(day => {
            day.meals.forEach(meal => {
                if (meal.recipe_name) {
                    totalCalories += meal.calories;
                    totalProtein += meal.protein;
                    totalCarbs += meal.carbs;
                    totalFat += meal.fat;
                    mealCount++;
                }
            });
        });

        const daysWithMeals = week.filter(day =>
            day.meals.some(meal => meal.recipe_name)
        ).length;

        return {
            total_calories: daysWithMeals > 0 ? Math.round(totalCalories / daysWithMeals) : 0,
            avg_protein: daysWithMeals > 0 ? Math.round(totalProtein / daysWithMeals) : 0,
            avg_carbs: daysWithMeals > 0 ? Math.round(totalCarbs / daysWithMeals) : 0,
            avg_fat: daysWithMeals > 0 ? Math.round(totalFat / daysWithMeals) : 0,
        };
    };

    const handleCreateMenu = async () => {
        if (!menuForm.name.trim()) {
            alert("Por favor ingresa un nombre para el menú");
            return;
        }

        const totals = calculateWeekTotals(currentWeek);

        const menuData = {
            name: menuForm.name,
            description: menuForm.description,
            category: menuForm.category,
            week: currentWeek
        };

        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/weekly-menus`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(menuData)
            });

            const result = await response.json();

            if (result.success) {
                setNewMenuOpen(false);
                resetForm();
                fetchWeeklyMenus();
                alert("Menú creado exitosamente");
            } else {
                alert("Error al crear el menú");
            }
        } catch (error) {
            console.error("Error creating menu:", error);
            alert("Error al crear el menú");
        }
    };

    const handleUpdateMenu = async () => {
        if (!selectedMenu) return;

        const updateData = {
            name: menuForm.name,
            description: menuForm.description,
            category: menuForm.category,
            week: currentWeek
        };

        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/weekly-menus/${selectedMenu.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(updateData)
            });

            const result = await response.json();

            if (result.success) {
                setEditMenuOpen(false);
                resetForm();
                fetchWeeklyMenus();
                alert("Menú actualizado exitosamente");
            }
        } catch (error) {
            console.error("Error updating menu:", error);
            alert("Error al actualizar el menú");
        }
    };

    const handleAddMeal = (day: string, mealType: MealSlot["type"]) => {
        setCurrentDay(day);
        setCurrentMealType(mealType);
        setAddMealDialogOpen(true);
    };

    const [currentWeekTab, setCurrentWeekTab] = useState("1");

    const handleConfirmAddMeal = () => {
        if (!selectedRecipe || !currentDay || !currentMealType) return;

        setCurrentWeek(prev => prev.map(dayMenu => {
            if (dayMenu.day === currentDay && dayMenu.week === parseInt(currentWeekTab)) {
                return {
                    ...dayMenu,
                    meals: dayMenu.meals.map(meal => {
                        if (meal.type === currentMealType) {
                            return {
                                type: meal.type,
                                recipe_id: selectedRecipe.id,
                                recipe_name: selectedRecipe.name,
                                calories: selectedRecipe.calories,
                                protein: selectedRecipe.protein,
                                carbs: selectedRecipe.carbs,
                                fat: selectedRecipe.fat,
                                time: meal.time,
                                notes: mealNotes,
                                image: selectedRecipe.image,
                                ingredients: selectedRecipe.ingredients,
                                instructions: selectedRecipe.instructions
                            };
                        }
                        return meal;
                    }),
                };
            }
            return dayMenu;
        }));

        setAddMealDialogOpen(false);
        setSelectedRecipe(null);
        setMealNotes("");
    };

    const handleRemoveMeal = (day: string, mealType: MealSlot["type"]) => {
        setCurrentWeek(prev => prev.map(dayMenu => {
            if (dayMenu.day === day && dayMenu.week === parseInt(currentWeekTab)) {
                return {
                    ...dayMenu,
                    meals: dayMenu.meals.map(meal => {
                        if (meal.type === mealType) {
                            const mealTypeInfo = mealTypes.find(mt => mt.type === mealType);
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
                        }
                        return meal;
                    }),
                };
            }
            return dayMenu;
        }));
    };

    const handleDuplicateMenu = async (menu: WeeklyMenu) => {
        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/weekly-menus/${menu.id}/duplicate`, {
                method: 'POST',
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                }
            });

            const result = await response.json();

            if (result.success) {
                fetchWeeklyMenus();
                alert("Menú duplicado exitosamente");
            }
        } catch (error) {
            console.error("Error duplicating menu:", error);
            alert("Error al duplicar el menú");
        }
    };

    const handleDeleteMenu = async () => {
        if (!menuToDelete) return;

        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/weekly-menus/${menuToDelete.id}`, {
                method: 'DELETE',
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                }
            });

            const result = await response.json().catch(() => ({}));

            if (response.ok && result.success) {
                fetchWeeklyMenus();
                setDeleteDialogOpen(false);
                setMenuToDelete(null);
                alert("Menú eliminado exitosamente");
            } else {
                alert(result.detail || "No se pudo eliminar el menú");
            }
        } catch (error) {
            console.error("Error deleting menu:", error);
            alert("Error al eliminar el menú");
        }
    };

    const handleEditMenu = (menu: WeeklyMenu) => {
        setSelectedMenu(menu);
        setMenuForm({
            name: menu.name,
            description: menu.description,
            category: menu.category
        });

        // Ensure we have 28 days (4 weeks) of data even for legacy 1-week menus
        const existingData = menu.week;
        const completeData = createEmptyWeek();

        // Merge existing data into complete structure
        const mergedWeek = completeData.map(emptyDay => {
            // Try to find matching day in existing data
            // For legacy menus, they only have week 1 data but we want to preserve it
            // Backend should return week number, but if missing (legacy), we assume week 1
            const foundDay = existingData.find(d =>
                d.day === emptyDay.day &&
                (d.week === emptyDay.week || (!d.week && emptyDay.week === 1))
            );

            if (foundDay) {
                return {
                    ...foundDay,
                    week: emptyDay.week // Ensure week is set correctly
                };
            }
            return emptyDay;
        });

        setCurrentWeek(mergedWeek);
        setEditMenuOpen(true);
    };

    const resetForm = () => {
        setMenuForm({ name: "", description: "", category: "Pérdida de peso" });
        setCurrentWeek(createEmptyWeek());
        setSelectedMenu(null);
    };

    const filteredMenus = Array.isArray(weeklyMenus) ? weeklyMenus.filter(menu => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
            (menu.name || "").toLowerCase().includes(q) ||
            (menu.description || "").toLowerCase().includes(q);
        return matchesSearch;
    }) : [];

    // Calcular totales en tiempo real
    const currentTotals = calculateWeekTotals(currentWeek);

    if (error) {
        return (
            <AdminLayout>
                <LoadingGate loading={loading} message="Cargando menús semanales">
                <Card className="rounded-2xl border-destructive/30 shadow-sm overflow-hidden max-w-lg mx-auto mt-8">
                    <div className="h-1.5 w-full bg-destructive/80" />
                    <CardContent className="p-6 text-center space-y-4">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                            <X className="h-7 w-7" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-1">Error al cargar datos</h3>
                            <p className="text-sm text-muted-foreground mb-3">{error}</p>
                            <div className="text-left text-xs rounded-xl bg-muted/50 border p-3 space-y-1">
                                <p className="font-medium">Verifica que:</p>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    <li>El backend esté corriendo en {API_URL}</li>
                                    <li>La tabla weekly_menus_complete exista</li>
                                    <li>Los endpoints estén configurados</li>
                                </ul>
                            </div>
                        </div>
                        <Button
                            className="rounded-full"
                            onClick={() => {
                                setError(null);
                                fetchWeeklyMenus();
                            }}
                        >
                            Reintentar
                        </Button>
                    </CardContent>
                </Card>
                </LoadingGate>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <LoadingGate loading={loading} message="Cargando menús semanales">
            <div className="space-y-6">
                {/* Header */}
                <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-violet-500/5 p-5 sm:p-6">
                    <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
                    <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl" />
                    <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20">
                                <Calendar className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">Menú semanal</h1>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Planes de 4 semanas para asignar a pacientes
                                    {weeklyMenus.length > 0 && (
                                        <span className="font-medium text-foreground/80"> · {filteredMenus.length} mostrados</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <Button
                            className="rounded-full shadow-md hover:shadow-lg transition-shadow shrink-0 gap-2"
                            onClick={() => setNewMenuOpen(true)}
                        >
                            <Plus className="h-4 w-4" />
                            Nuevo menú
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                {weeklyMenus.length > 0 && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-2xl border bg-card p-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-primary/10 p-2.5">
                                    <Calendar className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Menús</p>
                                    <p className="text-2xl font-bold tracking-tight tabular-nums">{stats.total_menus}</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-2xl border bg-card p-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-amber-500/10 p-2.5">
                                    <Flame className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Kcal promedio</p>
                                    <p className="text-2xl font-bold tracking-tight tabular-nums">{stats.avg_calories}</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-2xl border bg-card p-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-sky-500/10 p-2.5">
                                    <ChefHat className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Recetas usadas</p>
                                    <p className="text-2xl font-bold tracking-tight tabular-nums">{stats.total_recipes_used}</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-2xl border bg-card p-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-violet-500/10 p-2.5">
                                    <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Pacientes asig.</p>
                                    <p className="text-2xl font-bold tracking-tight tabular-nums">{stats.total_assigned_patients}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Search and Filters */}
                <Card className="rounded-2xl border-border/80 shadow-sm">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar por nombre o descripción..."
                                    className="pl-10 h-11 rounded-xl bg-muted/30 border-border focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        onClick={() => setSearchQuery("")}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? null : v)}>
                                <SelectTrigger className="w-full sm:w-[220px] h-11 rounded-xl">
                                    <Filter className="h-4 w-4 mr-2 shrink-0" />
                                    <SelectValue placeholder="Categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las categorías</SelectItem>
                                    {menuCategories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setCategoryFilter(null)}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${
                                    !categoryFilter
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                                }`}
                            >
                                Todas
                            </button>
                            {menuCategories.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${
                                        categoryFilter === cat
                                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                            : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {(searchQuery || categoryFilter) && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground">Filtros activos:</span>
                                {searchQuery && (
                                    <Badge variant="secondary" className="rounded-full gap-1 pl-2.5 pr-1 py-1">
                                        “{searchQuery}”
                                        <button type="button" className="rounded-full p-0.5 hover:bg-muted" onClick={() => setSearchQuery("")}>
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                )}
                                {categoryFilter && (
                                    <Badge variant="secondary" className="rounded-full gap-1 pl-2.5 pr-1 py-1">
                                        {categoryFilter}
                                        <button type="button" className="rounded-full p-0.5 hover:bg-muted" onClick={() => setCategoryFilter(null)}>
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs rounded-full"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setCategoryFilter(null);
                                    }}
                                >
                                    Limpiar todo
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Menus Grid */}
                {filteredMenus.length === 0 ? (
                    <Card className="rounded-2xl border-dashed border-border/80 shadow-sm overflow-hidden">
                        <div className="h-1.5 w-full bg-gradient-to-r from-primary/50 via-violet-500/30 to-transparent" />
                        <CardContent className="text-center py-16 px-6">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                                <Calendar className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                {searchQuery || categoryFilter
                                    ? "No se encontraron menús"
                                    : "Aún no tienes menús semanales"}
                            </h3>
                            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                                {searchQuery || categoryFilter
                                    ? "Prueba otro término o limpia los filtros activos."
                                    : "Crea un plan de 4 semanas con recetas para desayuno, almuerzo, comida, merienda y cena."}
                            </p>
                            {!searchQuery && !categoryFilter ? (
                                <Button className="rounded-full shadow-md" onClick={() => setNewMenuOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Crear menú
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setCategoryFilter(null);
                                    }}
                                >
                                    Limpiar filtros
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredMenus.map((menu) => {
                            const filledMeals = menu.week?.reduce(
                                (sum, day) => sum + (day.meals?.filter((m) => m.recipe_name).length || 0),
                                0
                            ) || 0;
                            const totalSlots = 4 * 7 * 5;
                            const fillPct = Math.min(100, Math.round((filledMeals / totalSlots) * 100));
                            return (
                                <Card
                                    key={menu.id}
                                    className="group relative overflow-hidden rounded-2xl border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/25 cursor-pointer"
                                    onClick={() => {
                                        setSelectedMenu(menu);
                                        setViewMenuOpen(true);
                                    }}
                                >
                                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-violet-500/70 to-accent/60" />
                                    <CardContent className="p-5 pt-6 space-y-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="rounded-full text-[10px] px-2 py-0 border-primary/25 bg-primary/5 text-primary"
                                                    >
                                                        {menu.category}
                                                    </Badge>
                                                    {menu.is_active !== false && (
                                                        <Badge
                                                            variant="outline"
                                                            className="rounded-full text-[10px] px-2 py-0 border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                                        >
                                                            Activo
                                                        </Badge>
                                                    )}
                                                </div>
                                                <h3 className="font-semibold text-base tracking-tight line-clamp-1">{menu.name}</h3>
                                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1 min-h-[2.5rem]">
                                                    {menu.description || "Sin descripción"}
                                                </p>
                                            </div>
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-full opacity-60 group-hover:opacity-100"
                                                        >
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-52 rounded-xl">
                                                        <DropdownMenuItem onClick={() => {
                                                            setSelectedMenu(menu);
                                                            setViewMenuOpen(true);
                                                        }}>
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            Ver menú
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleEditMenu(menu)}>
                                                            <Edit className="h-4 w-4 mr-2" />
                                                            Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDuplicateMenu(menu)}>
                                                            <Copy className="h-4 w-4 mr-2" />
                                                            Duplicar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setMenuToAssign(menu);
                                                                setAssignMenuOpen(true);
                                                            }}
                                                        >
                                                            <Users className="h-4 w-4 mr-2" />
                                                            Asignación masiva (cohorte)
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => {
                                                                setMenuToDelete(menu);
                                                                setDeleteDialogOpen(true);
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="rounded-xl border bg-amber-500/5 border-amber-500/20 px-2 py-2 text-center">
                                                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-0.5">
                                                    <Flame className="h-3 w-3" />
                                                    Kcal
                                                </div>
                                                <p className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                                                    {menu.total_calories}
                                                </p>
                                            </div>
                                            <div className="rounded-xl border bg-primary/5 border-primary/20 px-2 py-2 text-center">
                                                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-primary mb-0.5">
                                                    <Beef className="h-3 w-3" />
                                                    Prot
                                                </div>
                                                <p className="text-sm font-semibold tabular-nums text-primary">{menu.avg_protein}g</p>
                                            </div>
                                            <div className="rounded-xl border bg-violet-500/5 border-violet-500/20 px-2 py-2 text-center">
                                                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-violet-700 dark:text-violet-300 mb-0.5">
                                                    <LayoutGrid className="h-3 w-3" />
                                                    Sem
                                                </div>
                                                <p className="text-sm font-semibold tabular-nums">4</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground rounded-xl bg-muted/40 px-3 py-2 ring-1 ring-border/50">
                                            <span className="font-medium text-sky-700 dark:text-sky-300">CHO {menu.avg_carbs}g</span>
                                            <span className="font-medium text-yellow-700 dark:text-yellow-300">Grasa {menu.avg_fat}g</span>
                                            <span className="inline-flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                {menu.assigned_patients || 0}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Completado</span>
                                                <span className="font-semibold tabular-nums">{fillPct}% · {filledMeals}/{totalSlots}</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-500"
                                                    style={{ width: `${fillPct}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div
                                            className="grid grid-cols-2 gap-2 pt-1"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="rounded-full h-8 text-xs"
                                                onClick={() => {
                                                    setSelectedMenu(menu);
                                                    setViewMenuOpen(true);
                                                }}
                                            >
                                                <Eye className="h-3.5 w-3.5 mr-1" />
                                                Ver
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="rounded-full h-8 text-xs"
                                                onClick={() => handleEditMenu(menu)}
                                            >
                                                <Edit className="h-3.5 w-3.5 mr-1" />
                                                Editar
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* New/Edit Menu Dialog */}
                <Dialog open={newMenuOpen || editMenuOpen} onOpenChange={(open) => {
                    setNewMenuOpen(open);
                    setEditMenuOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogContent className="max-w-6xl w-[calc(100%-2rem)] max-h-[92vh] p-0 gap-0 overflow-hidden !flex !flex-col">
                        <div className="relative shrink-0 border-b bg-gradient-to-br from-primary/10 via-background to-accent/10 px-6 pt-6 pb-4">
                            <DialogHeader className="pr-8 space-y-1">
                                <DialogTitle className="flex items-center gap-2 text-xl">
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm">
                                        <Calendar className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                                    </span>
                                    {editMenuOpen ? "Editar menú semanal" : "Crear menú semanal"}
                                </DialogTitle>
                                <DialogDescription>
                                    Define datos generales y asigna recetas a cada comida de las 4 semanas.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="rounded-xl border bg-background/80 backdrop-blur-sm px-3 py-2.5 shadow-sm">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                                        <Flame className="h-3.5 w-3.5 text-orange-500" />
                                        Energía
                                    </div>
                                    <p className="text-lg font-bold tracking-tight">{currentTotals.total_calories}<span className="text-xs font-medium text-muted-foreground ml-1">kcal/día</span></p>
                                </div>
                                <div className="rounded-xl border bg-background/80 backdrop-blur-sm px-3 py-2.5 shadow-sm">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                                        <Beef className="h-3.5 w-3.5 text-rose-500" />
                                        Proteína
                                    </div>
                                    <p className="text-lg font-bold tracking-tight">{currentTotals.avg_protein}<span className="text-xs font-medium text-muted-foreground ml-1">g</span></p>
                                </div>
                                <div className="rounded-xl border bg-background/80 backdrop-blur-sm px-3 py-2.5 shadow-sm">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                                        <Wheat className="h-3.5 w-3.5 text-amber-500" />
                                        Carbos
                                    </div>
                                    <p className="text-lg font-bold tracking-tight">{currentTotals.avg_carbs}<span className="text-xs font-medium text-muted-foreground ml-1">g</span></p>
                                </div>
                                <div className="rounded-xl border bg-background/80 backdrop-blur-sm px-3 py-2.5 shadow-sm">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                                        <Droplets className="h-3.5 w-3.5 text-sky-500" />
                                        Grasas
                                    </div>
                                    <p className="text-lg font-bold tracking-tight">{currentTotals.avg_fat}<span className="text-xs font-medium text-muted-foreground ml-1">g</span></p>
                                </div>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 max-h-[calc(92vh-14rem)]">
                            <div className="space-y-6">
                                {/* Basic Info */}
                                <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                            <ChefHat className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm">Información general</h3>
                                            <p className="text-xs text-muted-foreground">Nombre, categoría y descripción del menú</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2 sm:col-span-1">
                                            <Label htmlFor="menu-name">Nombre del menú</Label>
                                            <Input
                                                id="menu-name"
                                                placeholder="Ej. Menú hipocalórico 1800 kcal"
                                                value={menuForm.name}
                                                onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                                                className="h-10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Categoría</Label>
                                            <Select value={menuForm.category} onValueChange={(v) => setMenuForm({ ...menuForm, category: v })}>
                                                <SelectTrigger className="h-10">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {menuCategories.map((cat) => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label htmlFor="menu-desc">Descripción</Label>
                                            <Textarea
                                                id="menu-desc"
                                                placeholder="Describe el enfoque del menú, restricciones o notas clínicas..."
                                                value={menuForm.description}
                                                onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                                                rows={2}
                                                className="resize-none"
                                            />
                                        </div>
                                    </div>
                                </section>

                                {/* Weekly Plan */}
                                <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                                            <LayoutGrid className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm">Plan semanal</h3>
                                            <p className="text-xs text-muted-foreground">4 semanas · 7 días · 5 tiempos de comida</p>
                                        </div>
                                    </div>

                                    <Tabs defaultValue="1" value={currentWeekTab} onValueChange={setCurrentWeekTab} className="w-full">
                                        <TabsList className="grid w-full grid-cols-4 h-11 p-1 rounded-xl bg-muted/70">
                                            {[1, 2, 3, 4].map(num => (
                                                <TabsTrigger
                                                    key={num}
                                                    value={num.toString()}
                                                    className="rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                                >
                                                    Semana {num}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>

                                        {[1, 2, 3, 4].map(weekNum => (
                                            <TabsContent key={weekNum} value={weekNum.toString()} className="mt-4 space-y-4">
                                                <Tabs defaultValue="Lunes" className="w-full">
                                                    <TabsList className="flex w-full h-auto flex-wrap gap-1 p-1 rounded-xl bg-muted/50 justify-start">
                                                        {daysOfWeek.map(day => {
                                                            const dayMenu = currentWeek.find(d => d.day === day && d.week === weekNum);
                                                            const filled = dayMenu?.meals.filter(m => m.recipe_name).length || 0;
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
                                                    {daysOfWeek.map(day => {
                                                        const dayMenu = currentWeek.find(d => d.day === day && d.week === weekNum);
                                                        const filledCount = dayMenu?.meals.filter(m => m.recipe_name).length || 0;
                                                        const dayKcal = dayMenu?.meals.reduce((s, m) => s + (m.calories || 0), 0) || 0;
                                                        return (
                                                            <TabsContent key={day} value={day} className="space-y-4 mt-4">
                                                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2.5">
                                                                    <div>
                                                                        <h4 className="font-semibold text-sm">{day} · Semana {weekNum}</h4>
                                                                        <p className="text-xs text-muted-foreground">{dayKcal} kcal totales del día</p>
                                                                    </div>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={`rounded-full px-3 ${filledCount === 5 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : ""}`}
                                                                    >
                                                                        {filledCount}/5 comidas
                                                                    </Badge>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    {mealTypes.map(mealType => {
                                                                        const meal = dayMenu?.meals.find(m => m.type === mealType.type);
                                                                        const MealIcon = mealType.icon;
                                                                        const hasRecipe = !!meal?.recipe_name;
                                                                        return (
                                                                            <div
                                                                                key={mealType.type}
                                                                                className={`group relative overflow-hidden rounded-2xl border transition-all ${
                                                                                    hasRecipe
                                                                                        ? "bg-card shadow-sm hover:shadow-md"
                                                                                        : "bg-muted/20 border-dashed hover:border-primary/40 hover:bg-primary/[0.03]"
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
                                                                                                    {"timeRange" in mealType ? mealType.timeRange : mealType.time}
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
                                                                                                src={getMealImageUrl(meal)}
                                                                                                alt={meal!.recipe_name}
                                                                                                className="w-16 h-16 rounded-xl object-cover bg-muted shadow-sm"
                                                                                                onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"; }}
                                                                                            />
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <p className="font-medium text-sm truncate">{meal!.recipe_name}</p>
                                                                                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                                                                    <Badge variant="secondary" className="rounded-md text-[10px] font-medium px-1.5 py-0">
                                                                                                        {meal!.calories} kcal
                                                                                                    </Badge>
                                                                                                    <Badge variant="secondary" className="rounded-md text-[10px] font-medium px-1.5 py-0">
                                                                                                        P {meal!.protein}g
                                                                                                    </Badge>
                                                                                                    <Badge variant="secondary" className="rounded-md text-[10px] font-medium px-1.5 py-0">
                                                                                                        C {meal!.carbs}g
                                                                                                    </Badge>
                                                                                                    <Badge variant="secondary" className="rounded-md text-[10px] font-medium px-1.5 py-0">
                                                                                                        G {meal!.fat}g
                                                                                                    </Badge>
                                                                                                </div>
                                                                                                {meal!.notes && (
                                                                                                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{meal!.notes}</p>
                                                                                                )}
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
                                                                                            className="w-full rounded-xl border border-dashed border-muted-foreground/25 bg-background/50 py-5 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
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

                        <DialogFooter className="shrink-0 border-t bg-muted/30 px-6 py-4 gap-2 sm:gap-2">
                            <Button
                                variant="outline"
                                className="rounded-full"
                                onClick={() => {
                                    setNewMenuOpen(false);
                                    setEditMenuOpen(false);
                                    resetForm();
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="rounded-full min-w-[140px]"
                                onClick={editMenuOpen ? handleUpdateMenu : handleCreateMenu}
                            >
                                {editMenuOpen ? (
                                    <>
                                        <Check className="h-4 w-4 mr-1.5" />
                                        Guardar cambios
                                    </>
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

                {/* Add Meal Dialog */}
                <Dialog open={addMealDialogOpen} onOpenChange={setAddMealDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden !flex !flex-col">
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
                                />
                            </div>
                            <div className="space-y-2">
                                    {recipes.map(recipe => (
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
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {recipe.prepTime} min
                                                    </span>
                                                </div>
                                                <div className="flex gap-1.5 mt-1.5">
                                                    <Badge variant="secondary" className="text-[10px] rounded-md px-1.5 py-0">P {recipe.protein}g</Badge>
                                                    <Badge variant="secondary" className="text-[10px] rounded-md px-1.5 py-0">C {recipe.carbs}g</Badge>
                                                    <Badge variant="secondary" className="text-[10px] rounded-md px-1.5 py-0">G {recipe.fat}g</Badge>
                                                </div>
                                            </div>
                                            {selectedRecipe?.id === recipe.id && (
                                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0">
                                                    <Check className="h-4 w-4" />
                                                </span>
                                            )}
                                        </div>
                                    ))}
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
                            <Button variant="outline" className="rounded-full" onClick={() => {
                                setAddMealDialogOpen(false);
                                setSelectedRecipe(null);
                                setMealNotes("");
                            }}>
                                Cancelar
                            </Button>
                            <Button className="rounded-full" onClick={handleConfirmAddMeal} disabled={!selectedRecipe}>
                                <Plus className="h-4 w-4 mr-1.5" />
                                Agregar receta
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* View Menu Dialog */}
                <Dialog open={viewMenuOpen} onOpenChange={setViewMenuOpen}>
                    <DialogContent className="max-w-6xl w-[calc(100%-2rem)] max-h-[92vh] p-0 gap-0 overflow-hidden !flex !flex-col">
                        {selectedMenu && (
                            <>
                                <div className="shrink-0 border-b bg-gradient-to-br from-primary/10 via-background to-violet-500/5 px-6 pt-6 pb-4">
                                    <DialogHeader className="pr-8 space-y-2 text-left">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className="rounded-full border-primary/25 bg-primary/5 text-primary"
                                            >
                                                {selectedMenu.category}
                                            </Badge>
                                            {selectedMenu.is_active !== false && (
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-full border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                                >
                                                    Activo
                                                </Badge>
                                            )}
                                        </div>
                                        <DialogTitle className="text-xl tracking-tight">{selectedMenu.name}</DialogTitle>
                                        <DialogDescription className="line-clamp-2">
                                            {selectedMenu.description || "Vista del menú completo (4 semanas)."}
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <div className="rounded-xl border bg-background/80 px-3 py-2.5 shadow-sm">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                                                <Flame className="h-3.5 w-3.5 text-amber-500" />
                                                Energía
                                            </div>
                                            <p className="text-lg font-bold tracking-tight tabular-nums">
                                                {selectedMenu.total_calories}
                                                <span className="text-xs font-medium text-muted-foreground ml-1">kcal/día</span>
                                            </p>
                                        </div>
                                        <div className="rounded-xl border bg-background/80 px-3 py-2.5 shadow-sm">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                                                <Beef className="h-3.5 w-3.5 text-rose-500" />
                                                Proteína
                                            </div>
                                            <p className="text-lg font-bold tracking-tight tabular-nums">
                                                {selectedMenu.avg_protein}
                                                <span className="text-xs font-medium text-muted-foreground ml-1">g</span>
                                            </p>
                                        </div>
                                        <div className="rounded-xl border bg-background/80 px-3 py-2.5 shadow-sm">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                                                <Wheat className="h-3.5 w-3.5 text-amber-500" />
                                                Carbos
                                            </div>
                                            <p className="text-lg font-bold tracking-tight tabular-nums">
                                                {selectedMenu.avg_carbs}
                                                <span className="text-xs font-medium text-muted-foreground ml-1">g</span>
                                            </p>
                                        </div>
                                        <div className="rounded-xl border bg-background/80 px-3 py-2.5 shadow-sm">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                                                <ChefHat className="h-3.5 w-3.5 text-primary" />
                                                Recetas
                                            </div>
                                            <p className="text-lg font-bold tracking-tight tabular-nums">
                                                {selectedMenu.week.reduce(
                                                    (sum, day) => sum + day.meals.filter((m) => m.recipe_name).length,
                                                    0
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 max-h-[calc(92vh-14rem)]">
                                    <Tabs defaultValue="1" className="w-full">
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
                                            <TabsContent key={weekNum} value={weekNum.toString()} className="mt-4">
                                                <Tabs defaultValue="Lunes" className="w-full">
                                                    <TabsList className="flex w-full h-auto flex-wrap gap-1 p-1 rounded-xl bg-muted/50 justify-start">
                                                        {daysOfWeek.map((day) => {
                                                            const dayMenu = selectedMenu.week.find(
                                                                (d) => d.day === day && d.week === weekNum
                                                            );
                                                            const filled =
                                                                dayMenu?.meals.filter((m) => m.recipe_name).length || 0;
                                                            return (
                                                                <TabsTrigger
                                                                    key={day}
                                                                    value={day}
                                                                    className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 min-w-[4.5rem]"
                                                                >
                                                                    <span className="flex flex-col items-center gap-0.5">
                                                                        <span className="font-medium">{day.slice(0, 3)}</span>
                                                                        <span
                                                                            className={`text-[10px] ${
                                                                                filled === 5
                                                                                    ? "text-emerald-600"
                                                                                    : "text-muted-foreground"
                                                                            }`}
                                                                        >
                                                                            {filled}/5
                                                                        </span>
                                                                    </span>
                                                                </TabsTrigger>
                                                            );
                                                        })}
                                                    </TabsList>
                                                    {daysOfWeek.map((day) => {
                                                        const dayMenu = selectedMenu.week.find(
                                                            (d) => d.day === day && d.week === weekNum
                                                        );
                                                        const dayCalories =
                                                            dayMenu?.meals.reduce(
                                                                (sum, meal) => sum + (meal.calories || 0),
                                                                0
                                                            ) || 0;
                                                        const filledCount =
                                                            dayMenu?.meals.filter((m) => m.recipe_name).length || 0;
                                                        return (
                                                            <TabsContent key={day} value={day} className="space-y-4 mt-4">
                                                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2.5">
                                                                    <div>
                                                                        <h4 className="font-semibold text-sm">
                                                                            {day} · Semana {weekNum}
                                                                        </h4>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {dayCalories} kcal totales del día
                                                                        </p>
                                                                    </div>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={`rounded-full px-3 ${
                                                                            filledCount === 5
                                                                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                                                                : ""
                                                                        }`}
                                                                    >
                                                                        {filledCount}/5 comidas
                                                                    </Badge>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    {mealTypes.map((mealType) => {
                                                                        const meal = dayMenu?.meals.find(
                                                                            (m) => m.type === mealType.type
                                                                        );
                                                                        const MealIcon = mealType.icon;
                                                                        const hasRecipe = !!meal?.recipe_name;
                                                                        return (
                                                                            <div
                                                                                key={mealType.type}
                                                                                className={`relative overflow-hidden rounded-2xl border ${
                                                                                    hasRecipe
                                                                                        ? "bg-card shadow-sm"
                                                                                        : "bg-muted/20 border-dashed"
                                                                                }`}
                                                                            >
                                                                                <div
                                                                                    className={`absolute left-0 top-0 bottom-0 w-1 ${mealType.colors.bar}`}
                                                                                />
                                                                                <div className="p-4 pl-5">
                                                                                    <div className="flex items-center gap-3 mb-3">
                                                                                        <div
                                                                                            className={`p-2.5 rounded-xl ring-1 ${mealType.colors.bg} ${mealType.colors.ring}`}
                                                                                        >
                                                                                            <MealIcon
                                                                                                className={`h-4 w-4 ${mealType.colors.text}`}
                                                                                            />
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="font-semibold text-sm">
                                                                                                {mealType.label}
                                                                                            </p>
                                                                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                                                <Clock className="h-3 w-3" />
                                                                                                {"timeRange" in mealType
                                                                                                    ? mealType.timeRange
                                                                                                    : mealType.time}
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                    {hasRecipe ? (
                                                                                        <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-border/60">
                                                                                            <img
                                                                                                src={getMealImageUrl(meal)}
                                                                                                alt={meal!.recipe_name}
                                                                                                className="w-16 h-16 rounded-xl object-cover bg-muted shadow-sm"
                                                                                                onError={(e) => {
                                                                                                    (
                                                                                                        e.target as HTMLImageElement
                                                                                                    ).src =
                                                                                                        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
                                                                                                }}
                                                                                            />
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <p className="font-medium text-sm truncate">
                                                                                                    {meal!.recipe_name}
                                                                                                </p>
                                                                                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                                                                    <Badge
                                                                                                        variant="secondary"
                                                                                                        className="rounded-md text-[10px] font-medium px-1.5 py-0"
                                                                                                    >
                                                                                                        {meal!.calories} kcal
                                                                                                    </Badge>
                                                                                                    <Badge
                                                                                                        variant="secondary"
                                                                                                        className="rounded-md text-[10px] font-medium px-1.5 py-0"
                                                                                                    >
                                                                                                        P {meal!.protein}g
                                                                                                    </Badge>
                                                                                                    <Badge
                                                                                                        variant="secondary"
                                                                                                        className="rounded-md text-[10px] font-medium px-1.5 py-0"
                                                                                                    >
                                                                                                        C {meal!.carbs}g
                                                                                                    </Badge>
                                                                                                    <Badge
                                                                                                        variant="secondary"
                                                                                                        className="rounded-md text-[10px] font-medium px-1.5 py-0"
                                                                                                    >
                                                                                                        G {meal!.fat}g
                                                                                                    </Badge>
                                                                                                </div>
                                                                                                {meal!.notes && (
                                                                                                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                                                                                                        {meal!.notes}
                                                                                                    </p>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <p className="rounded-xl border border-dashed border-muted-foreground/25 py-5 text-center text-sm text-muted-foreground">
                                                                                            Sin receta asignada
                                                                                        </p>
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
                                </div>

                                <DialogFooter className="shrink-0 border-t bg-muted/30 px-6 py-4 gap-2">
                                    <Button
                                        variant="outline"
                                        className="rounded-full"
                                        onClick={() => setViewMenuOpen(false)}
                                    >
                                        Cerrar
                                    </Button>
                                    <Button
                                        className="rounded-full"
                                        onClick={() => {
                                            setViewMenuOpen(false);
                                            handleEditMenu(selectedMenu);
                                        }}
                                    >
                                        <Edit className="h-4 w-4 mr-1.5" />
                                        Editar menú
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar menú?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Vas a eliminar “{menuToDelete?.name}”. Esta acción no se puede deshacer.
                                {menuToDelete && menuToDelete.assigned_patients > 0 && (
                                    <span className="block mt-2 text-destructive font-semibold">
                                        Advertencia: este menú tiene {menuToDelete.assigned_patients} pacientes asignados.
                                    </span>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteMenu}
                                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Eliminar menú
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <BulkAssignMenuDialog
                    open={assignMenuOpen}
                    onOpenChange={(o) => {
                        setAssignMenuOpen(o);
                        if (!o) setMenuToAssign(null);
                    }}
                    preselectedMenuId={menuToAssign?.id ?? null}
                    onSuccess={() => fetchWeeklyMenus()}
                />
            </div>
            </LoadingGate>
        </AdminLayout>
    );
};

export default AdminWeeklyMenus