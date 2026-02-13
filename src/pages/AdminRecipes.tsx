import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import {
  Search, Plus, Clock, Flame, Users, ChefHat, Heart, Filter, MoreVertical,
  Edit, Trash2, Copy, Eye
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
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "Todas" || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
        toast.success("Favorito actualizado");
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
    data.append("category", formData.get("category") as string);
    data.append("prepTime", formData.get("prepTime") as string || "0");
    data.append("cookTime", formData.get("cookTime") as string || "0");
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
        toast.error("Error al guardar la receta");
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
    // Note: We can't easily duplicate the file from a URL, so we leave it empty or send the current URL if the backend handles it as a string
    // In this case, our backend expects a File object for 'image'. If none is provided, it stays as is (on PUT) or null (on POST).
    // Let's assume we don't duplicate the image for now if it's a file, or we can add logic later.

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
        toast.error("Error al duplicar la receta");
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
    setIsFormOpen(true);
  };

  const openEditForm = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setSelectedIngredients(recipe.ingredients || []);
    setIngredientGroupFilter("Todos");
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
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando recetas...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Recetas</h1>
            <p className="text-muted-foreground">Gestiona tu biblioteca de recetas saludables</p>
          </div>
          <Button className="gap-2" onClick={openNewRecipeForm}>
            <Plus className="h-4 w-4" />
            Nueva Receta
          </Button>
        </div>

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
          <DialogContent className="max-w-[min(92vw,56rem)] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col gap-4 p-6">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{editingRecipe ? "Editar Receta" : "Crear Nueva Receta"}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 -mr-1">
              <form onSubmit={handleSaveRecipe} className="space-y-4 pb-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Nombre de la receta</Label>
                    <Input
                      id="name"
                      name="name"
                      required
                      defaultValue={editingRecipe?.name}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      name="description"
                      defaultValue={editingRecipe?.description}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Categoría</Label>
                    <Select name="category" defaultValue={editingRecipe?.category || "Platos principales"}>
                      <SelectTrigger>
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
                      defaultValue={editingRecipe?.servings || 2}
                      min="1"
                      required
                    />
                  </div>
                </div>



                <div className="space-y-2">
                  <Label>Ingredientes (del PDF por grupo)</Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar ingrediente..."
                        value={ingredientSearchTerm}
                        onChange={(e) => setIngredientSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Select
                      value={ingredientGroupFilter}
                      onValueChange={(v) => { setIngredientGroupFilter(v); setIngredientSearchTerm(""); }}
                    >
                      <SelectTrigger className="w-full max-w-xs sm:w-[200px]">
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
                    <div className="border rounded-md overflow-x-auto mb-2" style={{ maxWidth: "100%" }}>
                      <Table className="min-w-[700px]">
                        <TableHeader>
                          <TableRow>
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
                  {selectedIngredients.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-3 mb-2">
                      <p className="text-sm font-medium mb-2">Cálculo neto (suma de ingredientes seleccionados)</p>
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
                  <ScrollArea className="h-[240px] border rounded-md p-2 mt-2">
                    <div className="space-y-2">
                      {filteredIngredientsForRecipe.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          {ingredientSearchTerm.trim() ? "No hay ingredientes que coincidan con la búsqueda." : "No hay ingredientes en este grupo."}
                        </p>
                      ) : (
                        filteredIngredientsForRecipe.map((name) => (
                          <label
                            key={name}
                            className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
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
                    defaultValue={editingRecipe?.tags.join(", ")}
                  />
                </div>

                <div>
                  <Label htmlFor="image">Imagen de la Receta</Label>
                  <Input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/*"
                  />
                  {editingRecipe?.image && !editingRecipe.image.startsWith('http') && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Ya tiene una imagen cargada. Suba una nueva para reemplazarla.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingRecipe(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingRecipe ? "Guardar Cambios" : "Crear Receta"}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ChefHat className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recipes.length}</p>
                <p className="text-xs text-muted-foreground">Total recetas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Heart className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recipes.filter(r => r.isFavorite).length}</p>
                <p className="text-xs text-muted-foreground">Favoritas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {recipes.length > 0
                    ? Math.round(recipes.reduce((acc, r) => acc + (r.servings ?? 0), 0) / recipes.length)
                    : 0}
                </p>
                <p className="text-xs text-muted-foreground">Porciones prom.</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Flame className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {recipes.length > 0
                    ? Math.round(recipes.reduce((acc, r) => acc + (r.calories ?? 0), 0) / recipes.length)
                    : 0}
                </p>
                <p className="text-xs text-muted-foreground">Kcal prom. por receta</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recipe Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecipes.map((recipe) => (
            <Card key={recipe.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
              <div className="relative">
                <img
                  src={getImageUrl(recipe.image)}
                  alt={recipe.name}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(recipe.id);
                    }}
                  >
                    <Heart className={`h-4 w-4 ${recipe.isFavorite ? "fill-red-500 text-red-500" : ""}`} />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setSelectedRecipe(recipe);
                        setIsDetailOpen(true);
                      }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalles
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditForm(recipe)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(recipe)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => confirmDelete(recipe)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Badge className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm text-foreground">
                  {recipe.category}
                </Badge>
              </div>
              <CardContent
                className="p-4"
                onClick={() => {
                  setSelectedRecipe(recipe);
                  setIsDetailOpen(true);
                }}
              >
                <h3 className="font-semibold text-lg mb-1">{recipe.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{recipe.description}</p>

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {recipe.servings} porc.
                  </span>
                  <span className="flex items-center gap-1 font-medium text-amber-600">
                    <Flame className="h-3.5 w-3.5" />
                    {recipe.calories ?? 0} kcal
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-3 border-t border-border/50 pt-2">
                  <span className="text-primary font-medium">Prot: {(recipe.protein ?? 0)} g</span>
                  <span className="text-amber-600 font-medium">Carb: {(recipe.carbs ?? 0)} g</span>
                  <span className="text-yellow-700 font-medium">Grasas: {(recipe.fat ?? 0)} g</span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {recipe.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {recipe.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{recipe.tags.length - 3}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredRecipes.length === 0 && (
          <div className="text-center py-12">
            <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No se encontraron recetas</h3>
            <p className="text-muted-foreground">
              {searchTerm || selectedCategory !== "Todas"
                ? "Intenta con otros términos de búsqueda o categoría"
                : "Comienza creando tu primera receta"}
            </p>
            {!searchTerm && selectedCategory === "Todas" && (
              <Button className="mt-4" onClick={openNewRecipeForm}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Receta
              </Button>
            )}
          </div>
        )}

        {/* Recipe Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            {selectedRecipe && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle>{selectedRecipe.name}</DialogTitle>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          openEditForm(selectedRecipe);
                          setIsDetailOpen(false);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => toggleFavorite(selectedRecipe.id)}
                      >
                        <Heart className={`h-4 w-4 ${selectedRecipe.isFavorite ? "fill-red-500 text-red-500" : ""}`} />
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh]">
                  <div className="space-y-6">
                    <div className="relative h-64 sm:h-80">
                      <img
                        src={getImageUrl(selectedRecipe.image)}
                        alt={selectedRecipe.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <p className="text-muted-foreground">{selectedRecipe.description}</p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                        <p className="text-sm font-medium">{selectedRecipe.servings}</p>
                        <p className="text-xs text-muted-foreground">Porciones</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <ChefHat className="h-5 w-5 mx-auto mb-1 text-green-500" />
                        <p className="text-sm font-medium">{selectedRecipe.category}</p>
                        <p className="text-xs text-muted-foreground">Categoría</p>
                      </div>
                    </div>



                    <Tabs defaultValue="ingredients">
                      <TabsList className="w-full">
                        <TabsTrigger value="ingredients" className="flex-1">Ingredientes</TabsTrigger>
                        <TabsTrigger value="instructions" className="flex-1">Instrucciones</TabsTrigger>
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
                              <li key={idx} className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-primary" />
                                <span>{label}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </TabsContent>
                      <TabsContent value="instructions" className="mt-4">
                        <ol className="space-y-3">
                          {selectedRecipe.instructions.map((instruction, idx) => (
                            <li key={idx} className="flex gap-3">
                              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span>{instruction}</span>
                            </li>
                          ))}
                        </ol>
                      </TabsContent>
                    </Tabs>

                    <div className="flex flex-wrap gap-2">
                      {selectedRecipe.tags.map(tag => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Estás a punto de eliminar la receta "{recipeToDelete?.name}". Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRecipeToDelete(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar Receta
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout >
  );
}