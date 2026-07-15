import { useState, useEffect, useMemo } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_URL } from "@/config/api";
import { getCompositionRowForIngredient } from "@/lib/foodNutrients";
import { toast } from "sonner";
import {
  Search,
  Clock,
  Flame,
  Users,
  ChefHat,
  Filter,
  Eye,
  Utensils,
  List,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";

interface Recipe {
  id: number;
  name: string;
  description: string;
  category: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  instructions: string[];
  image: string;
  tags: string[];
  isFavorite: boolean;
}

const categories = [
  "Todas",
  "Desayunos",
  "Ensaladas",
  "Platos principales",
  "Bebidas",
  "Snacks",
  "Postres",
];

const categoryTone: Record<string, string> = {
  Desayunos: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Ensaladas: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "Platos principales": "bg-primary/15 text-primary",
  Bebidas: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Snacks: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  Postres: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export default function PatientRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeDetail, setRecipeDetail] = useState<Recipe | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const filteredRecipes = recipes.filter((recipe) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (recipe.name || "").toLowerCase().includes(q) ||
      (recipe.description || "").toLowerCase().includes(q) ||
      (recipe.tags || []).some((tag) => (tag || "").toLowerCase().includes(q));
    const matchesCategory = selectedCategory === "Todas" || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = useMemo(() => {
    const byCategory = new Set(recipes.map((r) => r.category).filter(Boolean));
    const avgCalories =
      recipes.length > 0
        ? Math.round(recipes.reduce((acc, r) => acc + (r.calories || 0), 0) / recipes.length)
        : 0;
    return {
      total: recipes.length,
      categories: byCategory.size,
      avgCalories,
      shown: filteredRecipes.length,
    };
  }, [recipes, filteredRecipes.length]);

  const normalizeList = (raw: unknown, keys: string[]): string[] => {
    if (raw == null) return [];
    if (Array.isArray(raw)) {
      const result: string[] = [];
      for (const item of raw) {
        let text = "";
        if (typeof item === "string") {
          text = item.trim();
        } else if (item != null && typeof item === "object" && !Array.isArray(item)) {
          const obj = item as Record<string, unknown>;
          for (const key of keys) {
            if (key in obj && obj[key] != null) {
              text = String(obj[key]).trim();
              break;
            }
          }
          if (!text && "name" in obj) text = String(obj.name ?? "").trim();
          if (!text && "text" in obj) text = String(obj.text ?? "").trim();
          if (!text) text = String(item).trim();
        } else {
          text = String(item ?? "").trim();
        }
        if (!text) continue;
        if (text.includes("\n")) {
          result.push(...text.split("\n").map((t) => t.trim()).filter(Boolean));
        } else if (text.includes(",") && !text.trim().startsWith("[")) {
          result.push(...text.split(",").map((t) => t.trim()).filter(Boolean));
        } else {
          result.push(text);
        }
      }
      return result;
    }
    if (typeof raw === "string") {
      const s = raw.trim();
      if (!s) return [];
      try {
        const parsed = JSON.parse(s);
        if (parsed !== s) return normalizeList(parsed, keys);
      } catch {
        // no es JSON
      }
      if (s.includes("\n")) return s.split("\n").map((t) => t.trim()).filter(Boolean);
      if (s.includes(",") && !s.includes("[")) return s.split(",").map((t) => t.trim()).filter(Boolean);
      return [s];
    }
    return [];
  };

  const normalizeIngredients = (raw: unknown) => {
    if (Array.isArray(raw)) {
      const result: string[] = [];
      for (const item of raw) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const obj = item as Record<string, unknown>;
          const name = (obj.name ?? obj.ingredient ?? obj.Ingredient) as string | undefined;
          const portion = (obj.portion ?? obj.portion_size) as string | undefined;
          if (name) {
            const nameStr = String(name).trim();
            const portionStr = portion ? String(portion).trim() : "";
            result.push(portionStr ? `${nameStr}: ${portionStr}` : nameStr);
            continue;
          }
        }
        result.push(
          ...normalizeList([item], ["ingredient", "Ingredient", "name", "text", "title", "item"])
        );
      }
      return result;
    }
    return normalizeList(raw, ["ingredient", "Ingredient", "name", "text", "title", "item"]);
  };

  const normalizeInstructions = (raw: unknown) =>
    normalizeList(raw, ["step", "Step", "instruction", "Instruction", "name", "text", "title"]);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/recipes`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        const data = await response.json();
        const normalized = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
          ...r,
          ingredients: normalizeIngredients(r.ingredients ?? (r as Record<string, unknown>).Ingredients),
          instructions: normalizeInstructions(r.instructions ?? (r as Record<string, unknown>).Instructions),
        }));
        setRecipes(normalized as Recipe[]);
      } else {
        toast.error("Error al cargar las recetas");
      }
    } catch (error) {
      console.error("Error fetching recipes:", error);
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  useEffect(() => {
    if (!isDetailOpen || !selectedRecipe?.id) {
      setRecipeDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setRecipeDetail(null);
    const token = localStorage.getItem("userToken");
    fetch(`${API_URL}/recipes/${selectedRecipe.id}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Record<string, unknown> | null) => {
        if (cancelled || !data) return;
        setRecipeDetail({
          ...selectedRecipe,
          ...data,
          id: selectedRecipe.id,
          name: (data.name as string) ?? selectedRecipe.name,
          description: (data.description as string) ?? selectedRecipe.description,
          category: (data.category as string) ?? selectedRecipe.category,
          prepTime: (data.prepTime as number) ?? selectedRecipe.prepTime,
          cookTime: (data.cookTime as number) ?? selectedRecipe.cookTime,
          servings: (data.servings as number) ?? selectedRecipe.servings,
          calories: (data.calories as number) ?? selectedRecipe.calories,
          protein: (data.protein as number) ?? selectedRecipe.protein,
          carbs: (data.carbs as number) ?? selectedRecipe.carbs,
          fat: (data.fat as number) ?? selectedRecipe.fat,
          image: (data.image as string) ?? selectedRecipe.image,
          tags: Array.isArray(data.tags) ? (data.tags as string[]) : selectedRecipe.tags,
          ingredients: normalizeIngredients(data.ingredients ?? data.Ingredients),
          instructions: normalizeInstructions(data.instructions ?? data.Instructions),
        } as Recipe);
      })
      .catch(() => {
        if (!cancelled) setRecipeDetail(selectedRecipe);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDetailOpen, selectedRecipe?.id]);

  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
    if (imagePath.startsWith("http")) return imagePath;
    const baseUrl = API_URL.replace("/api", "");
    return `${baseUrl}${imagePath}`;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("Todas");
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando recetas saludables…</p>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="space-y-5 lg:space-y-7 animate-fade-in">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-orange-500/[0.08] p-5 sm:p-6 shadow-card">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-14 left-1/4 h-36 w-36 rounded-full bg-amber-500/10 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Panel del paciente
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Explorar recetas
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-xl">
                Recetas públicas y las de tu plan nutricional activo, listas para cocinar.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-center backdrop-blur-sm min-w-[76px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="text-lg font-bold tabular-nums text-foreground">{stats.total}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-center backdrop-blur-sm min-w-[76px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Categorías</p>
                <p className="text-lg font-bold tabular-nums text-foreground">{stats.categories}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-center backdrop-blur-sm min-w-[76px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Promedio</p>
                <p className="text-lg font-bold tabular-nums text-foreground">{stats.avgCalories}</p>
                <p className="text-[9px] text-muted-foreground -mt-0.5">kcal</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search + filters */}
        <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, descripción o etiquetas…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-full h-11 bg-background/80"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[200px] rounded-full h-11">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Categoría" />
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

          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/40 text-muted-foreground border-border/70 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Mostrando{" "}
              <span className="font-semibold text-foreground tabular-nums">{stats.shown}</span> de{" "}
              <span className="font-semibold text-foreground tabular-nums">{stats.total}</span> recetas
            </p>
            {(searchTerm || selectedCategory !== "Todas") && (
              <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Recipe Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
          {filteredRecipes.map((recipe) => {
            const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
            const tone = categoryTone[recipe.category] || "bg-background/90 text-foreground";

            return (
              <Card
                key={recipe.id}
                className="overflow-hidden cursor-pointer group border-border/70 shadow-card rounded-2xl transition-all duration-300 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
                onClick={() => {
                  setSelectedRecipe(recipe);
                  setIsDetailOpen(true);
                }}
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={getImageUrl(recipe.image)}
                    alt={recipe.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <Badge
                    className={`absolute bottom-3 left-3 border-0 backdrop-blur-sm shadow-sm ${tone}`}
                  >
                    {recipe.category || "Receta"}
                  </Badge>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-2 bg-background/90 backdrop-blur-sm rounded-full shadow-sm ring-1 ring-border/50">
                      <Eye className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/45 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium text-white">
                    <Flame className="h-3 w-3 text-orange-300" />
                    {recipe.calories ?? 0} kcal
                  </div>
                </div>

                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-base lg:text-lg leading-snug group-hover:text-primary transition-colors line-clamp-1">
                      {recipe.name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1 min-h-[2.5rem]">
                      {recipe.description || "Sin descripción"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      <Clock className="h-3 w-3 text-primary" />
                      {totalTime} min
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      <Users className="h-3 w-3 text-sky-500" />
                      {recipe.servings ?? 1} porciones
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/60">
                    <div className="text-center rounded-xl bg-primary/5 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Prot</p>
                      <p className="text-sm font-bold text-primary tabular-nums">{recipe.protein ?? 0}g</p>
                    </div>
                    <div className="text-center rounded-xl bg-amber-500/5 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Carb</p>
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {recipe.carbs ?? 0}g
                      </p>
                    </div>
                    <div className="text-center rounded-xl bg-yellow-500/5 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Grasa</p>
                      <p className="text-sm font-bold text-yellow-700 dark:text-yellow-400 tabular-nums">
                        {recipe.fat ?? 0}g
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredRecipes.length === 0 && (
          <div className="text-center py-16 px-6 border border-dashed border-border rounded-2xl bg-muted/20">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/80 ring-1 ring-border/50">
              <ChefHat className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No se encontraron recetas</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto text-sm">
              {searchTerm || selectedCategory !== "Todas"
                ? "No hay platos que coincidan con tu búsqueda actual."
                : "Todavía no hay recetas disponibles en esta sección."}
            </p>
            {(searchTerm || selectedCategory !== "Todas") && (
              <Button className="mt-5 rounded-full" variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog
          open={isDetailOpen}
          onOpenChange={(open) => {
            setIsDetailOpen(open);
            if (!open) setRecipeDetail(null);
          }}
        >
          <DialogContent
            className="max-w-3xl max-h-[90vh] p-0 overflow-hidden !flex flex-col gap-0 rounded-2xl"
            aria-describedby={undefined}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{selectedRecipe?.name ?? "Detalle de receta"}</DialogTitle>
              <DialogDescription>
                Ingredientes, instrucciones y datos nutricionales de la receta.
              </DialogDescription>
            </DialogHeader>
            {selectedRecipe &&
              (() => {
                const recipe = recipeDetail ?? selectedRecipe;
                const baseIngredients = normalizeIngredients(
                  recipe.ingredients ?? (recipe as Record<string, unknown>).Ingredients
                );
                const displayIngredients = baseIngredients.map((ing) => {
                  const row = getCompositionRowForIngredient(ing);
                  const grams = row?.portion_grams;
                  if (grams != null && grams !== 0) {
                    return `${row!.name}: ${grams} g`;
                  }
                  return ing;
                });
                const displayInstructions = normalizeInstructions(
                  recipe.instructions ?? (recipe as Record<string, unknown>).Instructions
                );
                const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
                const tone =
                  categoryTone[recipe.category || selectedRecipe.category] ||
                  "bg-primary/90 text-primary-foreground";

                return (
                  <>
                    <ScrollArea className="flex-1 min-h-0 overflow-auto">
                      <div className="relative h-56 sm:h-72">
                        <img
                          src={getImageUrl(recipe.image)}
                          alt={recipe.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        <div className="absolute bottom-5 left-5 right-5">
                          <Badge className={`border-0 mb-2 shadow-sm ${tone}`}>
                            {selectedRecipe.category}
                          </Badge>
                          <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-sm">
                            {selectedRecipe.name}
                          </h2>
                        </div>
                      </div>

                      <div className="p-5 sm:p-6 space-y-7">
                        <p className="text-muted-foreground text-base leading-relaxed">
                          {recipe.description}
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="text-center p-3.5 rounded-2xl border border-primary/15 bg-primary/5">
                            <Clock className="h-5 w-5 mx-auto mb-1.5 text-primary" />
                            <p className="text-base font-bold text-foreground tabular-nums">
                              {totalTime} min
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                              Tiempo
                            </p>
                          </div>
                          <div className="text-center p-3.5 rounded-2xl border border-orange-500/15 bg-orange-500/5">
                            <Flame className="h-5 w-5 mx-auto mb-1.5 text-orange-500" />
                            <p className="text-base font-bold text-foreground tabular-nums">
                              {recipe.calories} kcal
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                              Calorías
                            </p>
                          </div>
                          <div className="text-center p-3.5 rounded-2xl border border-sky-500/15 bg-sky-500/5">
                            <Users className="h-5 w-5 mx-auto mb-1.5 text-sky-500" />
                            <p className="text-base font-bold text-foreground tabular-nums">
                              {recipe.servings}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                              Porciones
                            </p>
                          </div>
                          <div className="text-center p-3.5 rounded-2xl border border-emerald-500/15 bg-emerald-500/5">
                            <ChefHat className="h-5 w-5 mx-auto mb-1.5 text-emerald-500" />
                            <p className="text-base font-bold text-foreground">Saludable</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                              Perfil
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl border border-border/70 bg-muted/30">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">Proteína</p>
                            <p className="text-lg font-bold text-primary tabular-nums">
                              {recipe.protein}g
                            </p>
                          </div>
                          <div className="text-center border-x border-border/50">
                            <p className="text-xs text-muted-foreground mb-1">Carbos</p>
                            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                              {recipe.carbs}g
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">Grasas</p>
                            <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400 tabular-nums">
                              {recipe.fat}g
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <List className="h-4 w-4" />
                            </span>
                            Cómo prepararla
                            {detailLoading && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            )}
                          </h3>
                          <Tabs defaultValue="ingredients" className="w-full">
                            <TabsList className="w-full bg-muted/50 p-1 h-11 rounded-full">
                              <TabsTrigger
                                value="ingredients"
                                className="flex-1 gap-2 rounded-full font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                              >
                                <List className="h-4 w-4" />
                                Ingredientes
                              </TabsTrigger>
                              <TabsTrigger
                                value="instructions"
                                className="flex-1 gap-2 rounded-full font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                              >
                                <Utensils className="h-4 w-4" />
                                Instrucciones
                              </TabsTrigger>
                            </TabsList>
                            <TabsContent value="ingredients" className="mt-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                                {displayIngredients.map((text, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-3 p-3 bg-card border border-border/70 rounded-xl"
                                  >
                                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                                    <span className="text-sm font-medium">{text}</span>
                                  </div>
                                ))}
                                {displayIngredients.length === 0 && (
                                  <p className="text-sm text-muted-foreground col-span-full py-4 text-center">
                                    No hay ingredientes listados para esta receta.
                                  </p>
                                )}
                              </div>
                            </TabsContent>
                            <TabsContent value="instructions" className="mt-4">
                              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                                {displayInstructions.map((text, idx) => (
                                  <div
                                    key={idx}
                                    className="flex gap-3.5 p-3.5 bg-card border border-border/70 rounded-xl group hover:border-primary/30 transition-colors"
                                  >
                                    <span className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                      {idx + 1}
                                    </span>
                                    <p className="text-sm sm:text-base text-foreground leading-relaxed pt-1">
                                      {typeof text === "string" ? text : String(text ?? "")}
                                    </p>
                                  </div>
                                ))}
                                {displayInstructions.length === 0 && (
                                  <p className="text-sm text-muted-foreground py-4 text-center">
                                    No hay instrucciones listadas para esta receta.
                                  </p>
                                )}
                              </div>
                            </TabsContent>
                          </Tabs>
                        </div>

                        {(Array.isArray(recipe.tags) ? recipe.tags : []).length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {(Array.isArray(recipe.tags) ? recipe.tags : []).map((tag, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs rounded-full bg-muted/40 border-border/70"
                              >
                                #{typeof tag === "string" ? tag : String(tag)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                    <div className="shrink-0 p-4 border-t border-border bg-background/95 backdrop-blur-sm flex justify-end">
                      <Button className="rounded-full px-6" onClick={() => setIsDetailOpen(false)}>
                        Cerrar
                      </Button>
                    </div>
                  </>
                );
              })()}
          </DialogContent>
        </Dialog>
      </div>
    </PatientLayout>
  );
}
