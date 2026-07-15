import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
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
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  Search, Plus, Clock, Flame, Users, ChefHat, Heart, Filter, MoreVertical,
  Edit, Trash2, Copy, Eye, X, Utensils, Beef
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  FOOD_INGREDIENT_GROUPS,
  getIngredientsByGroup,
  getCompositionRowForIngredient,
  type CompositionTableRow,
} from "@/lib/foodNutrients";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  is_public?: boolean;
  created_by_id?: number | null;
}

const categories = ["Todas", "Desayunos", "Ensaladas", "Platos principales", "Bebidas", "Snacks", "Postres"];

export default function AdminRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientGroupFilter, setIngredientGroupFilter] = useState<string>("Todos");
  const [ingredientSearchTerm, setIngredientSearchTerm] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [formCategory, setFormCategory] = useState("Platos principales");
  const [formPrepTime, setFormPrepTime] = useState(0);
  const [formCookTime, setFormCookTime] = useState(0);

  const currentUserId = (() => {
    try {
      const raw = localStorage.getItem("userData");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.id != null ? Number(parsed.id) : null;
    } catch {
      return null;
    }
  })();
  const currentUserRole = (() => {
    try {
      const raw = localStorage.getItem("userData");
      if (!raw) return null;
      return JSON.parse(raw)?.role ?? null;
    } catch {
      return null;
    }
  })();

  const canModifyRecipe = (recipe: Recipe) => {
    if (currentUserRole === "superadmin") return true;
    if (currentUserId == null) return false;
    return Number(recipe.created_by_id) === Number(currentUserId);
  };

  /** Lista de ingredientes del grupo actual filtrada por búsqueda */
  const filteredIngredientsForRecipe = useMemo(() => {
    const list = getIngredientsByGroup(ingredientGroupFilter);
    const q = ingredientSearchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter((name) => name.toLowerCase().includes(q));
  }, [ingredientGroupFilter, ingredientSearchTerm]);

  /** Nombre base para lookup (quita sufijo " : X g" por si viene del modal) */
  const getRowForIngredient = (name: string) =>
    getCompositionRowForIngredient(name) ?? getCompositionRowForIngredient(name.replace(/\s*:.*$/, "").trim());

  /** Cálculo neto de nutrientes según ingredientes seleccionados */
  const netNutrients = useMemo(() => {
    const rows = selectedIngredients
      .map((name) => getRowForIngredient(name))
      .filter((r): r is CompositionTableRow => r !== null);
    return {
      kcal: rows.reduce((s, r) => s + r.kcal, 0),
      prot: rows.reduce((s, r) => s + r.prot, 0),
      grasa: rows.reduce((s, r) => s + r.grasa, 0),
      gs: rows.reduce((s, r) => s + r.gs, 0),
      gm: rows.reduce((s, r) => s + r.gm, 0),
      gp: rows.reduce((s, r) => s + r.gp, 0),
      col: rows.reduce((s, r) => s + r.col, 0),
      chos: rows.reduce((s, r) => s + r.chos, 0),
      fd: rows.reduce((s, r) => s + r.fd, 0),
      calcio: rows.reduce((s, r) => s + r.calcio, 0),
      p: rows.reduce((s, r) => s + r.p, 0),
      fe: rows.reduce((s, r) => s + r.fe, 0),
    };
  }, [selectedIngredients]);

  const filteredRecipes = recipes.filter(recipe => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (recipe.name || "").toLowerCase().includes(q) ||
      (recipe.description || "").toLowerCase().includes(q) ||
      (recipe.tags || []).some(tag => (tag || "").toLowerCase().includes(q));
    const matchesCategory = selectedCategory === "Todas" || recipe.category === selectedCategory;
    const matchesFavorite = !showFavoritesOnly || recipe.isFavorite;
    return matchesSearch && matchesCategory && matchesFavorite;
  });

  const favoritesCount = recipes.filter((r) => r.isFavorite).length;
  const avgServings = recipes.length
    ? Math.round(recipes.reduce((acc, r) => acc + (r.servings ?? 0), 0) / recipes.length)
    : 0;
  const avgCalories = recipes.length
    ? Math.round(recipes.reduce((acc, r) => acc + (r.calories ?? 0), 0) / recipes.length)
    : 0;

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/recipes`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRecipes(data);
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

  const toggleFavorite = async (recipeId: number) => {
    const target = recipes.find((r) => r.id === recipeId);
    if (target && !canModifyRecipe(target)) {
      toast.error("Solo puedes marcar favoritas tus propias recetas");
      return;
    }
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/recipes/${recipeId}/favorite`, {
        method: 'PATCH',
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecipes(recipes.map(r =>
          r.id === recipeId ? { ...r, isFavorite: data.isFavorite } : r
        ));
        setSelectedRecipe((prev) =>
          prev?.id === recipeId ? { ...prev, isFavorite: data.isFavorite } : prev
        );
        toast.success("Favorito actualizado");
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.detail || "Error al actualizar favorito");
      }
    } catch (error) {
      toast.error("Error al actualizar favorito");
    }
  };

  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
    if (imagePath.startsWith("http")) return imagePath;
    const baseUrl = API_URL.replace("/api", "");
    return `${baseUrl}${imagePath}`;
  };

  const handleSaveRecipe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedIngredients.length === 0) {
      toast.error("Selecciona al menos un ingrediente de la lista");
      return;
    }
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);

    const data = new FormData();
    data.append("name", formData.get("name") as string);
    data.append("description", formData.get("description") as string);
    data.append("category", formCategory || "Platos principales");
    data.append("prepTime", String(formPrepTime || 0));
    data.append("cookTime", String(formCookTime || 0));
    data.append("servings", formData.get("servings") as string);
    data.append("calories", String(Math.round(netNutrients.kcal)));
    data.append("protein", String(Math.round(netNutrients.prot)));
    data.append("carbs", String(Math.round(netNutrients.chos)));
    data.append("fat", String(Math.round(netNutrients.grasa)));

    const ingredientsList = selectedIngredients;
    const instructionsList = (formData.get("instructions") as string).split("\n").filter(i => i.trim());
    const tagsList = (formData.get("tags") as string).split(",").map(t => t.trim()).filter(t => t);

    data.append("ingredients", JSON.stringify(ingredientsList));
    data.append("instructions", JSON.stringify(instructionsList));
    data.append("tags", JSON.stringify(tagsList));
    data.append("isFavorite", String(editingRecipe?.isFavorite || false));

    const imageFile = (formElement.querySelector('input[name="image"]') as HTMLInputElement).files?.[0];
    if (imageFile) {
      data.append("image", imageFile);
    }

    const url = editingRecipe
      ? `${API_URL}/recipes/${editingRecipe.id}`
      : `${API_URL}/recipes`;

    const method = editingRecipe ? 'PUT' : 'POST';

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(url, {
        method: method,
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: data
      });

      if (response.ok) {
        await fetchRecipes();
        setIsFormOpen(false);
        setEditingRecipe(null);
        toast.success(editingRecipe ? "Receta actualizada correctamente" : "Receta creada correctamente");
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.detail || "Error al guardar la receta");
      }
    } catch (error) {
      console.error("Error saving recipe:", error);
      toast.error("No se pudo guardar la receta");
    }
  };

  const handleDelete = async () => {
    if (!recipeToDelete) return;

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/recipes/${recipeToDelete.id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });

      if (response.ok) {
        await fetchRecipes();
        toast.success("Receta eliminada correctamente");
        setDeleteDialogOpen(false);
        setRecipeToDelete(null);
        if (isDetailOpen && selectedRecipe?.id === recipeToDelete.id) {
          setIsDetailOpen(false);
        }
      } else {
        toast.error("Error al eliminar la receta");
      }
    } catch (error) {
      console.error("Error deleting recipe:", error);
      toast.error("No se pudo eliminar la receta");
    }
  };

  const confirmDelete = (recipe: Recipe) => {
    setRecipeToDelete(recipe);
    setDeleteDialogOpen(true);
  };

  const handleDuplicate = async (recipe: Recipe) => {
    const data = new FormData();
    data.append("name", `${recipe.name} (Copia)`);
    data.append("description", recipe.description || "");
    data.append("category", recipe.category);
    data.append("prepTime", String(recipe.prepTime));
    data.append("cookTime", String(recipe.cookTime));
    data.append("servings", String(recipe.servings));
    data.append("calories", String(recipe.calories));
    data.append("protein", String(recipe.protein));
    data.append("carbs", String(recipe.carbs));
    data.append("fat", String(recipe.fat));
    data.append("ingredients", JSON.stringify(recipe.ingredients));
    data.append("instructions", JSON.stringify(recipe.instructions));
    data.append("tags", JSON.stringify(recipe.tags));
    data.append("isFavorite", "false");
    if (recipe.image) {
      data.append("existing_image", recipe.image);
    }

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/recipes`, {
        method: 'POST',
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: data
      });

      if (response.ok) {
        await fetchRecipes();
        toast.success("Receta duplicada correctamente");
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.detail || "Error al duplicar la receta");
      }
    } catch (error) {
      console.error("Error duplicating recipe:", error);
      toast.error("No se pudo duplicar la receta");
    }
  };

  const openNewRecipeForm = () => {
    setEditingRecipe(null);
    setSelectedIngredients([]);
    setIngredientGroupFilter("Todos");
    setFormCategory("Platos principales");
    setFormPrepTime(0);
    setFormCookTime(0);
    setIsFormOpen(true);
  };

  const openEditForm = (recipe: Recipe) => {
    if (!canModifyRecipe(recipe)) {
      toast.error("Solo puedes editar tus propias recetas");
      return;
    }
    setEditingRecipe(recipe);
    setSelectedIngredients(recipe.ingredients || []);
    setIngredientGroupFilter("Todos");
    setFormCategory(recipe.category || "Platos principales");
    setFormPrepTime(recipe.prepTime || 0);
    setFormCookTime(recipe.cookTime || 0);
    setIsFormOpen(true);
  };

  const toggleIngredient = (name: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingScreen message="Cargando recetas" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-amber-500/5 p-5 sm:p-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20">
                <ChefHat className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Recetas</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Biblioteca de recetas para planes y menús semanales
                  {recipes.length > 0 && (
                    <span className="font-medium text-foreground/80"> · {filteredRecipes.length} mostradas</span>
                  )}
                </p>
              </div>
            </div>
            <Button className="rounded-full shadow-md hover:shadow-lg transition-shadow shrink-0 gap-2" onClick={openNewRecipeForm}>
              <Plus className="h-4 w-4" />
              Nueva receta
            </Button>
          </div>
        </div>

        {/* Stats */}
        {recipes.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => {
                setShowFavoritesOnly(false);
                setSelectedCategory("Todas");
              }}
              className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${!showFavoritesOnly && selectedCategory === "Todas" ? "ring-2 ring-primary/30 border-primary/30" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <ChefHat className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{recipes.length}</p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${showFavoritesOnly ? "ring-2 ring-rose-500/30 border-rose-500/30" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-rose-500/10 p-2.5">
                  <Heart className="h-5 w-5 text-rose-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Favoritas</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{favoritesCount}</p>
                </div>
              </div>
            </button>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-sky-500/10 p-2.5">
                  <Users className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Porciones prom.</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{avgServings}</p>
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
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{avgCalories}</p>
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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre, descripción o etiqueta..."
                  className="pl-10 h-11 rounded-xl bg-muted/30 border-border focus-visible:ring-2 focus-visible:ring-primary/20"
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[200px] h-11 rounded-xl">
                  <Filter className="h-4 w-4 mr-2 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {(searchTerm || selectedCategory !== "Todas" || showFavoritesOnly) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Filtros activos:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="rounded-full gap-1 pl-2.5 pr-1 py-1">
                    “{searchTerm}”
                    <button type="button" className="rounded-full p-0.5 hover:bg-muted" onClick={() => setSearchTerm("")}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {selectedCategory !== "Todas" && (
                  <Badge variant="secondary" className="rounded-full gap-1 pl-2.5 pr-1 py-1">
                    {selectedCategory}
                    <button type="button" className="rounded-full p-0.5 hover:bg-muted" onClick={() => setSelectedCategory("Todas")}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {showFavoritesOnly && (
                  <Badge variant="secondary" className="rounded-full gap-1 pl-2.5 pr-1 py-1">
                    Favoritas
                    <button type="button" className="rounded-full p-0.5 hover:bg-muted" onClick={() => setShowFavoritesOnly(false)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs rounded-full"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategory("Todas");
                    setShowFavoritesOnly(false);
                  }}
                >
                  Limpiar todo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recipe Form Dialog */}
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) {
              setEditingRecipe(null);
              setSelectedIngredients([]);
              setIngredientGroupFilter("Todos");
            }
          }}
        >
          <DialogContent className="max-w-[min(92vw,56rem)] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
            <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-br from-background via-background to-primary/[0.04] px-6 pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Utensils className="h-4 w-4" />
                </span>
                {editingRecipe ? "Editar receta" : "Crear nueva receta"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4">
              <form onSubmit={handleSaveRecipe} className="space-y-5 pb-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Nombre de la receta</Label>
                    <Input
                      id="name"
                      name="name"
                      required
                      className="mt-1.5 rounded-xl h-11"
                      defaultValue={editingRecipe?.name}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      name="description"
                      className="mt-1.5 rounded-xl"
                      defaultValue={editingRecipe?.description}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Categoría</Label>
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.filter(c => c !== "Todas").map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="servings">Porciones</Label>
                    <Input
                      id="servings"
                      name="servings"
                      type="number"
                      className="mt-1.5 rounded-xl h-11"
                      defaultValue={editingRecipe?.servings || 2}
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="prepTime">Prep. (min)</Label>
                    <Input
                      id="prepTime"
                      type="number"
                      min="0"
                      className="mt-1.5 rounded-xl h-11"
                      value={formPrepTime}
                      onChange={(e) => setFormPrepTime(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cookTime">Cocción (min)</Label>
                    <Input
                      id="cookTime"
                      type="number"
                      min="0"
                      className="mt-1.5 rounded-xl h-11"
                      value={formCookTime}
                      onChange={(e) => setFormCookTime(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>



                <div className="space-y-2">
                  <Label>Ingredientes (tabla de composición)</Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar ingrediente..."
                        value={ingredientSearchTerm}
                        onChange={(e) => setIngredientSearchTerm(e.target.value)}
                        className="pl-8 rounded-xl"
                      />
                    </div>
                    <Select
                      value={ingredientGroupFilter}
                      onValueChange={(v) => { setIngredientGroupFilter(v); setIngredientSearchTerm(""); }}
                    >
                      <SelectTrigger className="w-full max-w-xs sm:w-[200px] rounded-xl">
                        <SelectValue placeholder="Filtrar por grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        {FOOD_INGREDIENT_GROUPS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedIngredients.length > 0 ? (
                    <div className="border rounded-xl overflow-x-auto mb-2" style={{ maxWidth: "100%" }}>
                      <Table className="min-w-[700px]">
                        <TableHeader>
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableHead className="w-[140px]">Alimento</TableHead>
                            <TableHead className="text-right w-12">g.</TableHead>
                            <TableHead className="min-w-[160px]">Unidad de medida</TableHead>
                            <TableHead className="text-right">Kcal.</TableHead>
                            <TableHead className="text-right">Prot. g</TableHead>
                            <TableHead className="text-right">GT. g</TableHead>
                            <TableHead className="text-right">AGS. g</TableHead>
                            <TableHead className="text-right">AGN. g</TableHead>
                            <TableHead className="text-right">AGP. g</TableHead>
                            <TableHead className="text-right">Col. mg</TableHead>
                            <TableHead className="text-right">CHO. g</TableHead>
                            <TableHead className="text-right">FDI. g</TableHead>
                            <TableHead className="text-right">Ca. mg</TableHead>
                            <TableHead className="text-right">P. mg</TableHead>
                            <TableHead className="text-right">Fe. mg</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedIngredients
                            .map((name) => getCompositionRowForIngredient(name))
                            .filter((r): r is CompositionTableRow => r !== null)
                            .map((row) => (
                              <TableRow
                                key={row.name}
                                className="hover:bg-muted/50"
                              >
                                <TableCell className="font-medium text-sm py-2">{row.name}</TableCell>
                                <TableCell className="text-right tabular-nums text-sm py-2">
                                  {row.portion_grams != null ? row.portion_grams : "—"}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm py-2">
                                  {row.unit_measure ?? "—"}
                                </TableCell>
                                {(["kcal", "prot", "grasa", "gs", "gm", "gp", "col", "chos", "fd", "calcio", "p", "fe"] as const).map((key) => (
                                  <TableCell key={key} className="text-right tabular-nums text-sm py-2">
                                    {row[key] === 0 ? "—" : Number.isInteger(row[key]) ? String(row[key]) : (row[key] as number).toFixed(2).replace(".", ",")}
                                  </TableCell>
                                ))}
                                <TableCell className="py-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => toggleIngredient(row.name)}
                                    aria-label="Quitar ingrediente"
                                  >
                                    ×
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                  {selectedIngredients.some((name) => !getRowForIngredient(name)) && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mb-2 space-y-2">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        Ingredientes sin tabla de composición (puedes quitarlos)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedIngredients
                          .filter((name) => !getRowForIngredient(name))
                          .map((name) => (
                            <Badge key={name} variant="outline" className="gap-1 rounded-full pr-1">
                              <span className="max-w-[200px] truncate">{name}</span>
                              <button
                                type="button"
                                className="rounded-full p-0.5 hover:bg-muted"
                                onClick={() => toggleIngredient(name)}
                                aria-label={`Quitar ${name}`}
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}
                  {selectedIngredients.length > 0 && (
                    <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3.5 mb-2">
                      <p className="text-sm font-semibold mb-2.5 flex items-center gap-2">
                        <Flame className="h-4 w-4 text-amber-500" />
                        Cálculo neto (suma de ingredientes)
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1.5 text-sm">
                        <span className="text-muted-foreground">Kcal</span>
                        <span className="tabular-nums font-medium">{Math.round(netNutrients.kcal)}</span>
                        <span className="text-muted-foreground">Prot. g</span>
                        <span className="tabular-nums font-medium">{netNutrients.prot.toFixed(2).replace(".", ",")}</span>
                        <span className="text-muted-foreground">GT. g</span>
                        <span className="tabular-nums font-medium">{netNutrients.grasa.toFixed(2).replace(".", ",")}</span>
                        <span className="text-muted-foreground">AGS. g</span>
                        <span className="tabular-nums font-medium">{netNutrients.gs.toFixed(2).replace(".", ",")}</span>
                        <span className="text-muted-foreground">AGN. g</span>
                        <span className="tabular-nums font-medium">{netNutrients.gm.toFixed(2).replace(".", ",")}</span>
                        <span className="text-muted-foreground">AGP. g</span>
                        <span className="tabular-nums font-medium">{netNutrients.gp.toFixed(2).replace(".", ",")}</span>
                        <span className="text-muted-foreground">Col. mg</span>
                        <span className="tabular-nums font-medium">{Math.round(netNutrients.col)}</span>
                        <span className="text-muted-foreground">CHO. g</span>
                        <span className="tabular-nums font-medium">{netNutrients.chos.toFixed(2).replace(".", ",")}</span>
                        <span className="text-muted-foreground">FDI. g</span>
                        <span className="tabular-nums font-medium">{netNutrients.fd.toFixed(2).replace(".", ",")}</span>
                        <span className="text-muted-foreground">Ca. mg</span>
                        <span className="tabular-nums font-medium">{Math.round(netNutrients.calcio)}</span>
                        <span className="text-muted-foreground">P. mg</span>
                        <span className="tabular-nums font-medium">{Math.round(netNutrients.p)}</span>
                        <span className="text-muted-foreground">Fe. mg</span>
                        <span className="tabular-nums font-medium">{netNutrients.fe.toFixed(2).replace(".", ",")}</span>
                      </div>
                    </div>
                  )}
                  <ScrollArea className="h-[240px] border rounded-xl p-2 mt-2 bg-muted/20">
                    <div className="space-y-1">
                      {filteredIngredientsForRecipe.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2 px-2">
                          {ingredientSearchTerm.trim() ? "No hay ingredientes que coincidan con la búsqueda." : "No hay ingredientes en este grupo."}
                        </p>
                      ) : (
                        filteredIngredientsForRecipe.map((name) => (
                          <label
                            key={name}
                            className={`flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-1.5 transition-colors ${
                              selectedIngredients.includes(name)
                                ? "bg-primary/10 text-foreground"
                                : "hover:bg-muted/60"
                            }`}
                          >
                            <Checkbox
                              checked={selectedIngredients.includes(name)}
                              onCheckedChange={() => toggleIngredient(name)}
                            />
                            <span className="text-sm">{name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  {selectedIngredients.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selecciona al menos un ingrediente de la lista (tabla de composición).
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="instructions">Instrucciones (una por línea)</Label>
                  <Textarea
                    id="instructions"
                    name="instructions"
                    className="mt-1.5 rounded-xl"
                    rows={5}
                    defaultValue={editingRecipe?.instructions.join("\n")}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="tags">Etiquetas (separadas por coma)</Label>
                  <Input
                    id="tags"
                    name="tags"
                    className="mt-1.5 rounded-xl h-11"
                    defaultValue={editingRecipe?.tags.join(", ")}
                  />
                </div>

                <div>
                  <Label htmlFor="image">Imagen de la receta</Label>
                  <Input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/*"
                    className="mt-1.5 rounded-xl file:mr-3 file:rounded-lg"
                  />
                  {editingRecipe?.image && !editingRecipe.image.startsWith('http') && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Ya tiene una imagen cargada. Sube una nueva para reemplazarla.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background pb-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingRecipe(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="rounded-full shadow-md">
                    {editingRecipe ? "Guardar cambios" : "Crear receta"}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>

        {/* Recipe Grid */}
        {filteredRecipes.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/80 shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-primary/50 via-amber-500/30 to-transparent" />
            <CardContent className="text-center py-16 px-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <ChefHat className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchTerm || selectedCategory !== "Todas" || showFavoritesOnly
                  ? "No se encontraron recetas"
                  : "Aún no tienes recetas"}
              </h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                {searchTerm || selectedCategory !== "Todas" || showFavoritesOnly
                  ? "Prueba otro término o limpia los filtros activos."
                  : "Crea la primera para usarla en planes y menús semanales."}
              </p>
              {!searchTerm && selectedCategory === "Todas" && !showFavoritesOnly ? (
                <Button className="rounded-full shadow-md" onClick={openNewRecipeForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear receta
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategory("Todas");
                    setShowFavoritesOnly(false);
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => (
            <Card
              key={recipe.id}
              className="group relative overflow-hidden rounded-2xl border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/25 cursor-pointer"
              onClick={() => {
                setSelectedRecipe(recipe);
                setIsDetailOpen(true);
              }}
            >
              <div className="relative h-44 overflow-hidden">
                <img
                  src={getImageUrl(recipe.image)}
                  alt={recipe.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute top-2.5 right-2.5 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {canModifyRecipe(recipe) && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 rounded-full bg-background/85 backdrop-blur-sm shadow-sm"
                    onClick={() => toggleFavorite(recipe.id)}
                  >
                    <Heart className={`h-4 w-4 ${recipe.isFavorite ? "fill-rose-500 text-rose-500" : ""}`} />
                  </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full bg-background/85 backdrop-blur-sm shadow-sm"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl">
                      <DropdownMenuItem onClick={() => {
                        setSelectedRecipe(recipe);
                        setIsDetailOpen(true);
                      }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalles
                      </DropdownMenuItem>
                      {canModifyRecipe(recipe) && (
                      <DropdownMenuItem onClick={() => openEditForm(recipe)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDuplicate(recipe)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      {canModifyRecipe(recipe) && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => confirmDelete(recipe)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Badge className="absolute bottom-2.5 left-2.5 rounded-full bg-background/90 text-foreground border-0 shadow-sm backdrop-blur-sm">
                  {recipe.category}
                </Badge>
                {recipe.is_public && Number(recipe.created_by_id) !== Number(currentUserId) && (
                  <Badge className="absolute bottom-2.5 right-2.5 rounded-full bg-sky-500/90 text-white border-0 shadow-sm text-[10px]">
                    Pública
                  </Badge>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-base tracking-tight line-clamp-1">{recipe.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1 min-h-[2.5rem]">
                    {recipe.description || "Sin descripción"}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border bg-muted/30 px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                      <Users className="h-3 w-3" />
                      Porc.
                    </div>
                    <p className="text-sm font-semibold tabular-nums">{recipe.servings ?? 0}</p>
                  </div>
                  <div className="rounded-xl border bg-amber-500/5 border-amber-500/20 px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-0.5">
                      <Flame className="h-3 w-3" />
                      Kcal
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">{recipe.calories ?? 0}</p>
                  </div>
                  <div className="rounded-xl border bg-primary/5 border-primary/20 px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-primary mb-0.5">
                      <Beef className="h-3 w-3" />
                      Prot
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-primary">{recipe.protein ?? 0}g</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground rounded-xl bg-muted/40 px-3 py-2 ring-1 ring-border/50">
                  <span className="font-medium text-sky-700 dark:text-sky-300">CHO {(recipe.carbs ?? 0)} g</span>
                  <span className="font-medium text-yellow-700 dark:text-yellow-300">Grasa {(recipe.fat ?? 0)} g</span>
                  {(recipe.prepTime > 0 || recipe.cookTime > 0) && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {(recipe.prepTime || 0) + (recipe.cookTime || 0)} min
                    </span>
                  )}
                </div>

                {(recipe.tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {recipe.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="rounded-full text-[10px] px-2 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {recipe.tags.length > 3 && (
                      <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                        +{recipe.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        )}

        {/* Recipe Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 gap-0">
            {selectedRecipe && (
              <>
                <div className="relative h-48 sm:h-56 overflow-hidden">
                  <img
                    src={getImageUrl(selectedRecipe.image)}
                    alt={selectedRecipe.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 px-6 pb-4">
                    <DialogHeader className="space-y-2 text-left">
                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <Badge className="rounded-full mb-2 bg-primary/90 hover:bg-primary/90">
                            {selectedRecipe.category}
                          </Badge>
                          <DialogTitle className="text-xl sm:text-2xl tracking-tight">
                            {selectedRecipe.name}
                          </DialogTitle>
                        </div>
                        <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {canModifyRecipe(selectedRecipe) && (
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-full bg-background/90 backdrop-blur-sm"
                            onClick={() => {
                              openEditForm(selectedRecipe);
                              setIsDetailOpen(false);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          )}
                          {canModifyRecipe(selectedRecipe) && (
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-full bg-background/90 backdrop-blur-sm"
                            onClick={() => toggleFavorite(selectedRecipe.id)}
                          >
                            <Heart className={`h-4 w-4 ${selectedRecipe.isFavorite ? "fill-rose-500 text-rose-500" : ""}`} />
                          </Button>
                          )}
                        </div>
                      </div>
                    </DialogHeader>
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[calc(90vh-14rem)] px-6 py-5 space-y-5">
                  {selectedRecipe.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedRecipe.description}</p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-xl border bg-muted/30 p-3 text-center">
                      <Users className="h-4 w-4 mx-auto mb-1 text-sky-500" />
                      <p className="text-sm font-semibold tabular-nums">{selectedRecipe.servings}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Porciones</p>
                    </div>
                    <div className="rounded-xl border bg-amber-500/5 border-amber-500/20 p-3 text-center">
                      <Flame className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                      <p className="text-sm font-semibold tabular-nums">{selectedRecipe.calories ?? 0}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Kcal</p>
                    </div>
                    <div className="rounded-xl border bg-primary/5 border-primary/20 p-3 text-center">
                      <Beef className="h-4 w-4 mx-auto mb-1 text-primary" />
                      <p className="text-sm font-semibold tabular-nums">{selectedRecipe.protein ?? 0} g</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Proteína</p>
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-3 text-center">
                      <Utensils className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                      <p className="text-sm font-semibold tabular-nums">
                        {(selectedRecipe.carbs ?? 0)}/{(selectedRecipe.fat ?? 0)}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">CHO / Grasa</p>
                    </div>
                  </div>

                  <Tabs defaultValue="ingredients">
                    <TabsList className="w-full h-auto p-1 rounded-xl bg-muted/60 grid grid-cols-2">
                      <TabsTrigger value="ingredients" className="rounded-lg data-[state=active]:shadow-sm">Ingredientes</TabsTrigger>
                      <TabsTrigger value="instructions" className="rounded-lg data-[state=active]:shadow-sm">Instrucciones</TabsTrigger>
                    </TabsList>
                    <TabsContent value="ingredients" className="mt-4">
                      <ul className="space-y-2">
                        {selectedRecipe.ingredients.map((ingredient, idx) => {
                          const row = getCompositionRowForIngredient(ingredient);
                          const grams = row?.portion_grams;
                          const label =
                            grams != null && grams !== 0
                              ? `${row!.name}: ${grams} g`
                              : ingredient;
                          return (
                            <li
                              key={idx}
                              className="flex items-center gap-3 rounded-xl border bg-muted/20 px-3 py-2.5 text-sm"
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                {idx + 1}
                              </span>
                              <span>{label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </TabsContent>
                    <TabsContent value="instructions" className="mt-4">
                      <ol className="space-y-3">
                        {selectedRecipe.instructions.map((instruction, idx) => (
                          <li key={idx} className="flex gap-3 rounded-xl border bg-muted/20 p-3">
                            <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center shadow-sm">
                              {idx + 1}
                            </span>
                            <span className="text-sm leading-relaxed pt-0.5">{instruction}</span>
                          </li>
                        ))}
                      </ol>
                    </TabsContent>
                  </Tabs>

                  {(selectedRecipe.tags?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t">
                      {selectedRecipe.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="rounded-full">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar receta?</AlertDialogTitle>
              <AlertDialogDescription>
                Vas a eliminar “{recipeToDelete?.name}”. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full" onClick={() => setRecipeToDelete(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar receta
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}