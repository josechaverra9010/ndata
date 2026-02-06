import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Search, Plus, Calendar, ChefHat, Clock, Flame, LayoutGrid,
    Edit, Trash2, Copy, MoreVertical, Apple, Coffee, Sandwich,
    Moon, Salad, Filter, Loader2, X, Check
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

const mealTypes = [
    { type: "desayuno" as const, label: "Desayuno", icon: Coffee, time: "08:00", color: "bg-orange-500" },
    { type: "almuerzo" as const, label: "Almuerzo", icon: Apple, time: "11:00", color: "bg-green-500" },
    { type: "comida" as const, label: "Comida", icon: ChefHat, time: "14:00", color: "bg-blue-500" },
    { type: "merienda" as const, label: "Merienda", icon: Sandwich, time: "17:00", color: "bg-purple-500" },
    { type: "cena" as const, label: "Cena", icon: Moon, time: "20:00", color: "bg-indigo-500" },
];

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
        if (!imagePath) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
        if (imagePath.startsWith("http")) return imagePath;
        const baseUrl = API_URL.replace("/api", "");
        return `${baseUrl}${imagePath}`;
    };

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

            const result = await response.json();

            if (result.success) {
                fetchWeeklyMenus();
                setDeleteDialogOpen(false);
                setMenuToDelete(null);
                alert("Menú eliminado exitosamente");
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
        const matchesSearch = menu.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            menu.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    }) : [];

    const getMealIcon = (type: MealSlot["type"]) => {
        const mealType = mealTypes.find(mt => mt.type === type);
        return mealType?.icon || ChefHat;
    };

    const getMealColor = (type: MealSlot["type"]) => {
        const mealType = mealTypes.find(mt => mt.type === type);
        return mealType?.color || "bg-gray-500";
    };

    // Calcular totales en tiempo real
    const currentTotals = calculateWeekTotals(currentWeek);

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                    <LoadingScreen message="Cargando" />
                </div>
            </AdminLayout>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center max-w-md">
                    <div className="bg-destructive/10 text-destructive rounded-lg p-6 mb-4">
                        <X className="h-12 w-12 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Error al cargar datos</h3>
                        <p className="text-sm mb-4">{error}</p>
                        <div className="space-y-2 text-xs text-left bg-muted p-3 rounded">
                            <p>Verifica que:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>El backend esté corriendo en {API_URL}</li>
                                <li>La tabla weekly_menus_complete exista</li>
                                <li>Los endpoints estén correctamente configurados</li>
                            </ul>
                        </div>
                    </div>
                    <Button onClick={() => {
                        setError(null);
                        fetchWeeklyMenus();
                    }}>
                        Reintentar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Menús Semanales</h1>
                        <p className="text-muted-foreground">Crea y gestiona menús completos para la semana</p>
                    </div>
                    <Button className="gap-2" onClick={() => setNewMenuOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Nuevo Menú Semanal
                    </Button>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? null : v)}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las categorías</SelectItem>
                            <SelectItem value="Pérdida de peso">Pérdida de peso</SelectItem>
                            <SelectItem value="Ganancia muscular">Ganancia muscular</SelectItem>
                            <SelectItem value="Mantenimiento">Mantenimiento</SelectItem>
                            <SelectItem value="Vegetariano">Vegetariano</SelectItem>
                            <SelectItem value="Vegano">Vegano</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Calendar className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.total_menus}</p>
                                <p className="text-xs text-muted-foreground">Menús activos</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                                <Flame className="h-5 w-5 text-orange-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.avg_calories}</p>
                                <p className="text-xs text-muted-foreground">Calorías promedio</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <ChefHat className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.total_recipes_used}</p>
                                <p className="text-xs text-muted-foreground">Recetas utilizadas</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 bg-violet-500/10 rounded-lg">
                                <LayoutGrid className="h-5 w-5 text-violet-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">4</p>
                                <p className="text-xs text-muted-foreground">Semanas por menú</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Menus Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMenus.map((menu) => (
                        <Card key={menu.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="h-2 bg-gradient-to-r from-primary to-accent" />
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-lg mb-1">{menu.name}</h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2">{menu.description}</p>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => {
                                                setSelectedMenu(menu);
                                                setViewMenuOpen(true);
                                            }}>
                                                <Calendar className="h-4 w-4 mr-2" />
                                                Ver menú completo
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
                                                className="text-destructive"
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

                                <Badge variant="outline" className="mb-4">{menu.category}</Badge>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                                        <Flame className="h-4 w-4 mx-auto mb-1 text-orange-500" />
                                        <p className="text-sm font-semibold">{menu.total_calories}</p>
                                        <p className="text-xs text-muted-foreground">kcal/día</p>
                                    </div>
                                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                                        <Clock className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                                        <p className="text-sm font-semibold">4</p>
                                        <p className="text-xs text-muted-foreground">semanas</p>
                                    </div>
                                </div>

                                <div className="p-3 bg-muted/30 rounded-lg mb-4">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Macros Promedio</p>
                                    <div className="flex gap-3 text-xs">
                                        <div>
                                            <span className="font-semibold">{menu.avg_protein}g</span>
                                            <span className="text-muted-foreground"> Proteína</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold">{menu.avg_carbs}g</span>
                                            <span className="text-muted-foreground"> Carbos</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold">{menu.avg_fat}g</span>
                                            <span className="text-muted-foreground"> Grasas</span>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    variant="outline"
                                    className="w-full text-sm"
                                    onClick={() => {
                                        setSelectedMenu(menu);
                                        setViewMenuOpen(true);
                                    }}
                                >
                                    Ver detalle
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {filteredMenus.length === 0 && (
                    <div className="text-center py-12">
                        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">No se encontraron menús</h3>
                        <p className="text-muted-foreground mb-4">
                            {searchQuery || categoryFilter
                                ? "Intenta ajustar los filtros de búsqueda"
                                : "Comienza creando tu primer menú semanal"}
                        </p>
                        {!searchQuery && !categoryFilter && (
                            <Button onClick={() => setNewMenuOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Crear Primer Menú
                            </Button>
                        )}
                    </div>
                )}

                {/* New/Edit Menu Dialog */}
                <Dialog open={newMenuOpen || editMenuOpen} onOpenChange={(open) => {
                    setNewMenuOpen(open);
                    setEditMenuOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogContent className="max-w-6xl max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-between">
                                <span>{editMenuOpen ? "Editar" : "Crear"} Menú Semanal</span>
                                <div className="text-sm font-normal text-muted-foreground flex gap-4">
                                    <span>📊 {currentTotals.total_calories} kcal/día</span>
                                    <span>💪 {currentTotals.avg_protein}g proteína</span>
                                    <span>🍞 {currentTotals.avg_carbs}g carbos</span>
                                    <span>🥑 {currentTotals.avg_fat}g grasas</span>
                                </div>
                            </DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="max-h-[75vh] pr-4">
                            <div className="space-y-6">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <div>
                                        <Label>Nombre del menú</Label>
                                        <Input
                                            value={menuForm.name}
                                            onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label>Descripción</Label>
                                        <Textarea
                                            value={menuForm.description}
                                            onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                                            rows={3}
                                        />
                                    </div>
                                    <div>
                                        <Label>Categoría</Label>
                                        <Select value={menuForm.category} onValueChange={(v) => setMenuForm({ ...menuForm, category: v })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Pérdida de peso">Pérdida de peso</SelectItem>
                                                <SelectItem value="Ganancia muscular">Ganancia muscular</SelectItem>
                                                <SelectItem value="Mantenimiento">Mantenimiento</SelectItem>
                                                <SelectItem value="Vegetariano">Vegetariano</SelectItem>
                                                <SelectItem value="Vegano">Vegano</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <Separator />

                                {/* Weekly Plan */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4">Plan Semanal</h3>
                                    <Tabs defaultValue="1" value={currentWeekTab} onValueChange={setCurrentWeekTab} className="w-full">
                                        <TabsList className="grid w-full grid-cols-4 mb-4">
                                            {[1, 2, 3, 4].map(num => (
                                                <TabsTrigger key={num} value={num.toString()}>
                                                    Semana {num}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>

                                        {[1, 2, 3, 4].map(weekNum => (
                                            <TabsContent key={weekNum} value={weekNum.toString()}>
                                                <Tabs defaultValue="Lunes" className="w-full">
                                                    <TabsList className="grid w-full grid-cols-7">
                                                        {daysOfWeek.map(day => (
                                                            <TabsTrigger key={day} value={day} className="text-xs">
                                                                {day.slice(0, 3)}
                                                            </TabsTrigger>
                                                        ))}
                                                    </TabsList>
                                                    {daysOfWeek.map(day => {
                                                        const dayMenu = currentWeek.find(d => d.day === day && d.week === weekNum);
                                                        return (
                                                            <TabsContent key={day} value={day} className="space-y-4 mt-4">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <h4 className="font-semibold">{day} - Semana {weekNum}</h4>
                                                                    <Badge variant="outline">
                                                                        {dayMenu?.meals.filter(m => m.recipe_name).length || 0}/5 comidas
                                                                    </Badge>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    {mealTypes.map(mealType => {
                                                                        const meal = dayMenu?.meals.find(m => m.type === mealType.type);
                                                                        const MealIcon = mealType.icon;
                                                                        return (
                                                                            <div key={mealType.type} className="border rounded-lg p-4">
                                                                                <div className="flex items-center justify-between mb-3">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className={`p-2 ${mealType.color} rounded-lg bg-opacity-10`}>
                                                                                            <MealIcon className={`h-4 w-4 ${mealType.color.replace('bg-', 'text-')}`} />
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="font-medium">{mealType.label}</p>
                                                                                            <p className="text-xs text-muted-foreground">{mealType.time}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant={meal?.recipe_name ? "outline" : "default"}
                                                                                        onClick={() => handleAddMeal(day, mealType.type)}
                                                                                    >
                                                                                        {meal?.recipe_name ? "Cambiar" : "Agregar"}
                                                                                    </Button>
                                                                                </div>
                                                                                {meal?.recipe_name && (
                                                                                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                                                                        {meal.image && (
                                                                                            <img
                                                                                                src={getImageUrl(meal.image)}
                                                                                                alt={meal.recipe_name}
                                                                                                className="w-16 h-16 rounded-lg object-cover"
                                                                                            />
                                                                                        )}
                                                                                        <div className="flex-1">
                                                                                            <p className="font-medium text-sm">{meal.recipe_name}</p>
                                                                                            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                                                                                                <span>{meal.calories} kcal</span>
                                                                                                <span>P: {meal.protein}g</span>
                                                                                                <span>C: {meal.carbs}g</span>
                                                                                                <span>G: {meal.fat}g</span>
                                                                                            </div>
                                                                                            {meal.notes && (
                                                                                                <p className="text-xs text-muted-foreground mt-1">{meal.notes}</p>
                                                                                            )}
                                                                                        </div>
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="ghost"
                                                                                            onClick={() => handleRemoveMeal(day, mealType.type)}
                                                                                        >
                                                                                            <Trash2 className="h-4 w-4" />
                                                                                        </Button>
                                                                                    </div>
                                                                                )}
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
                            </div>
                        </ScrollArea>
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="outline" onClick={() => {
                                setNewMenuOpen(false);
                                setEditMenuOpen(false);
                                resetForm();
                            }}>
                                Cancelar
                            </Button>
                            <Button onClick={editMenuOpen ? handleUpdateMenu : handleCreateMenu}>
                                {editMenuOpen ? "Guardar Cambios" : "Crear Menú"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Add Meal Dialog */}
                <Dialog open={addMealDialogOpen} onOpenChange={setAddMealDialogOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Seleccionar Receta</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <Input
                                placeholder="Buscar receta..."
                                className="w-full"
                            />
                            <ScrollArea className="h-[400px]">
                                <div className="space-y-2">
                                    {recipes.map(recipe => (
                                        <div
                                            key={recipe.id}
                                            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedRecipe?.id === recipe.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                                                }`}
                                            onClick={() => setSelectedRecipe(recipe)}
                                        >
                                            <img
                                                src={getImageUrl(recipe.image)}
                                                alt={recipe.name}
                                                className="w-20 h-20 rounded-lg object-cover"
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium">{recipe.name}</p>
                                                <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Flame className="h-3 w-3" />
                                                        {recipe.calories} kcal
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {recipe.prepTime} min
                                                    </span>
                                                </div>
                                                <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                                                    <span>P: {recipe.protein}g</span>
                                                    <span>C: {recipe.carbs}g</span>
                                                    <span>G: {recipe.fat}g</span>
                                                </div>
                                            </div>
                                            {selectedRecipe?.id === recipe.id && (
                                                <Check className="h-5 w-5 text-primary" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div>
                                <Label>Notas (opcional)</Label>
                                <Textarea
                                    value={mealNotes}
                                    onChange={(e) => setMealNotes(e.target.value)}
                                    placeholder="Agregar instrucciones especiales..."
                                    rows={2}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => {
                                setAddMealDialogOpen(false);
                                setSelectedRecipe(null);
                                setMealNotes("");
                            }}>
                                Cancelar
                            </Button>
                            <Button onClick={handleConfirmAddMeal} disabled={!selectedRecipe}>
                                Agregar
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* View Menu Dialog */}
                <Dialog open={viewMenuOpen} onOpenChange={setViewMenuOpen}>
                    <DialogContent className="max-w-6xl max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle>{selectedMenu?.name}</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="max-h-[75vh]">
                            {selectedMenu && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-3 gap-4">
                                        <Card>
                                            <CardContent className="p-4 text-center">
                                                <Flame className="h-6 w-6 mx-auto mb-2 text-orange-500" />
                                                <p className="text-2xl font-bold">{selectedMenu.total_calories}</p>
                                                <p className="text-xs text-muted-foreground">kcal/día promedio</p>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4 text-center">
                                                <ChefHat className="h-6 w-6 mx-auto mb-2 text-primary" />
                                                <p className="text-2xl font-bold">
                                                    {selectedMenu.week.reduce((sum, day) =>
                                                        sum + day.meals.filter(m => m.recipe_name).length, 0
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground">recetas totales</p>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4 text-center">
                                                <LayoutGrid className="h-6 w-6 mx-auto mb-2 text-violet-500" />
                                                <p className="text-2xl font-bold">4</p>
                                                <p className="text-xs text-muted-foreground">semanas</p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <Tabs defaultValue="1" className="w-full">
                                        <TabsList className="grid w-full grid-cols-4 mb-4">
                                            {[1, 2, 3, 4].map(num => (
                                                <TabsTrigger key={num} value={num.toString()}>
                                                    Semana {num}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>

                                        {[1, 2, 3, 4].map(weekNum => (
                                            <TabsContent key={weekNum} value={weekNum.toString()}>
                                                <Tabs defaultValue="Lunes" className="w-full">
                                                    <TabsList className="grid w-full grid-cols-7">
                                                        {daysOfWeek.map(day => (
                                                            <TabsTrigger key={day} value={day}>
                                                                {day.slice(0, 3)}
                                                            </TabsTrigger>
                                                        ))}
                                                    </TabsList>
                                                    {daysOfWeek.map(day => {
                                                        const dayMenu = selectedMenu.week.find(d => d.day === day && d.week === weekNum);
                                                        const dayCalories = dayMenu?.meals.reduce((sum, meal) => sum + (meal.calories || 0), 0) || 0;
                                                        return (
                                                            <TabsContent key={day} value={day} className="space-y-4 mt-4">
                                                                <div className="flex items-center justify-between">
                                                                    <h4 className="font-semibold text-lg">{day} - Semana {weekNum}</h4>
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant="outline">
                                                                            <Flame className="h-3 w-3 mr-1" />
                                                                            {dayCalories} kcal
                                                                        </Badge>
                                                                        <Badge variant="outline">
                                                                            {dayMenu?.meals.filter(m => m.recipe_name).length || 0}/5
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    {mealTypes.map(mealType => {
                                                                        const meal = dayMenu?.meals.find(m => m.type === mealType.type);
                                                                        const MealIcon = mealType.icon;
                                                                        return (
                                                                            <Card key={mealType.type}>
                                                                                <CardContent className="p-4">
                                                                                    <div className="flex items-center gap-3 mb-3">
                                                                                        <div className={`p-2 ${mealType.color} rounded-lg bg-opacity-10`}>
                                                                                            <MealIcon className={`h-5 w-5 ${mealType.color.replace('bg-', 'text-')}`} />
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="font-semibold">{mealType.label}</p>
                                                                                            <p className="text-sm text-muted-foreground">{mealType.time}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    {meal?.recipe_name ? (
                                                                                        <div className="flex items-center gap-4">
                                                                                            {meal.image && (
                                                                                                <img
                                                                                                    src={getImageUrl(meal.image)}
                                                                                                    alt={meal.recipe_name}
                                                                                                    className="w-24 h-24 rounded-lg object-cover"
                                                                                                />
                                                                                            )}
                                                                                            <div className="flex-1">
                                                                                                <p className="font-medium mb-2">{meal.recipe_name}</p>
                                                                                                <div className="grid grid-cols-4 gap-2 text-sm">
                                                                                                    <div>
                                                                                                        <p className="text-muted-foreground text-xs">Calorías</p>
                                                                                                        <p className="font-semibold">{meal.calories}</p>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <p className="text-muted-foreground text-xs">Proteína</p>
                                                                                                        <p className="font-semibold">{meal.protein}g</p>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <p className="text-muted-foreground text-xs">Carbos</p>
                                                                                                        <p className="font-semibold">{meal.carbs}g</p>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <p className="text-muted-foreground text-xs">Grasas</p>
                                                                                                        <p className="font-semibold">{meal.fat}g</p>
                                                                                                    </div>
                                                                                                </div>
                                                                                                {meal.notes && (
                                                                                                    <p className="text-sm text-muted-foreground mt-2 italic">{meal.notes}</p>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <p className="text-sm text-muted-foreground text-center py-4">
                                                                                            No hay receta asignada
                                                                                        </p>
                                                                                    )}
                                                                                </CardContent>
                                                                            </Card>
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
                            )}
                        </ScrollArea>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Estás a punto de eliminar el menú "{menuToDelete?.name}". Esta acción no se puede deshacer.
                                {menuToDelete && menuToDelete.assigned_patients > 0 && (
                                    <span className="block mt-2 text-destructive font-semibold">
                                        Advertencia: Este menú tiene {menuToDelete.assigned_patients} pacientes asignados.
                                    </span>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteMenu}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Eliminar Menú
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </AdminLayout>
    );
};

export default AdminWeeklyMenus