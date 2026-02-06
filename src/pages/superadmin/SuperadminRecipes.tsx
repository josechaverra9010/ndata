import { useState, useEffect } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import {
  Search,
  Clock,
  Flame,
  Users,
  ChefHat,
  Filter,
  UserCog,
  List,
  Globe,
  Lock,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  created_by_name?: string | null;
}

const categories = ["Todas", "Desayunos", "Ensaladas", "Platos principales", "Bebidas", "Snacks", "Postres"];

export default function SuperadminRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (recipe.created_by_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "Todas" || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const uniqueCreators = new Set(recipes.map((r) => r.created_by_name).filter(Boolean));

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/superadmin/recipes`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRecipes(data);
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.detail || "Error al cargar la biblioteca de recetas");
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

  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
    if (imagePath.startsWith("http")) return imagePath;
    const baseUrl = API_URL.replace("/api", "");
    return `${baseUrl}${imagePath}`;
  };

  const toggleVisibility = async (recipe: Recipe) => {
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/superadmin/recipes/${recipe.id}/visibility`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_public: !recipe.is_public }),
      });
      if (response.ok) {
        setRecipes((prev) =>
          prev.map((r) => (r.id === recipe.id ? { ...r, is_public: !r.is_public } : r))
        );
        if (selectedRecipe?.id === recipe.id) {
          setSelectedRecipe({ ...selectedRecipe, is_public: !recipe.is_public });
        }
        toast.success(recipe.is_public ? "Receta marcada como privada" : "Receta marcada como pública");
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.detail || "Error al cambiar visibilidad");
      }
    } catch {
      toast.error("Error al cambiar visibilidad");
    }
  };

  if (loading) {
    return (
      <SuperadminLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando biblioteca de recetas...</p>
          </div>
        </div>
      </SuperadminLayout>
    );
  }

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Biblioteca de Recetas</h1>
          <p className="text-muted-foreground">
            Todas las recetas creadas por los nutricionistas
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, descripción, etiquetas o nutricionista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
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
              <div className="p-2 bg-destructive/10 rounded-lg">
                <UserCog className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueCreators.size}</p>
                <p className="text-xs text-muted-foreground">Nutricionistas</p>
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
                    ? Math.round(
                        recipes.reduce((acc, r) => acc + (r.servings ?? 0), 0) / recipes.length
                      )
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
                    ? Math.round(
                        recipes.reduce((acc, r) => acc + (r.calories ?? 0), 0) / recipes.length
                      )
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
            <Card
              key={recipe.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => {
                setSelectedRecipe(recipe);
                setIsDetailOpen(true);
              }}
            >
              <div className="relative">
                <img
                  src={getImageUrl(recipe.image)}
                  alt={recipe.name}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <Badge className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm text-foreground">
                  {recipe.category}
                </Badge>
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                  {recipe.created_by_name && (
                    <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                      <UserCog className="h-3.5 w-3.5 mr-1" />
                      {recipe.created_by_name}
                    </Badge>
                  )}
                  <div
                    className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch checked={!!recipe.is_public} onCheckedChange={() => toggleVisibility(recipe)} />
                    <span className="text-xs font-medium">
                      {recipe.is_public ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <Globe className="h-3.5 w-3.5" /> Pública
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Lock className="h-3.5 w-3.5" /> Privada
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <CardContent className="p-4">
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
                  <span className="text-primary font-medium">Prot: {recipe.protein ?? 0} g</span>
                  <span className="text-amber-600 font-medium">Carb: {recipe.carbs ?? 0} g</span>
                  <span className="text-yellow-700 font-medium">Grasas: {recipe.fat ?? 0} g</span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {recipe.tags.slice(0, 3).map((tag) => (
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
                : "Los nutricionistas aún no han creado recetas"}
            </p>
          </div>
        )}

        {/* Recipe Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            {selectedRecipe && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedRecipe.name}</DialogTitle>
                  <div className="flex flex-wrap items-center gap-4 mt-2">
                    {selectedRecipe.created_by_name && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <UserCog className="h-4 w-4" />
                        Creada por: {selectedRecipe.created_by_name}
                      </p>
                    )}
                    <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/50">
                      <Switch
                        checked={!!selectedRecipe.is_public}
                        onCheckedChange={() => toggleVisibility(selectedRecipe)}
                      />
                      <Label className="text-sm cursor-pointer">
                        {selectedRecipe.is_public ? (
                          <span className="flex items-center gap-1.5 text-green-600">
                            <Globe className="h-4 w-4" /> Pública (visible para todos)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-amber-600">
                            <Lock className="h-4 w-4" /> Privada (solo creador y superadmin)
                          </span>
                        )}
                      </Label>
                    </div>
                  </div>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-4">
                    <div className="flex gap-4 flex-wrap">
                      <Badge variant="secondary">{selectedRecipe.category}</Badge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {selectedRecipe.prepTime + selectedRecipe.cookTime} min
                      </span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {selectedRecipe.servings} porciones
                      </span>
                      <span className="text-sm font-medium text-amber-600 flex items-center gap-1">
                        <Flame className="h-4 w-4" />
                        {selectedRecipe.calories} kcal
                      </span>
                    </div>

                    {selectedRecipe.image && (
                      <div className="rounded-lg overflow-hidden border">
                        <img
                          src={getImageUrl(selectedRecipe.image)}
                          alt={selectedRecipe.name}
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    )}

                    {selectedRecipe.description && (
                      <p className="text-muted-foreground">{selectedRecipe.description}</p>
                    )}

                    <div>
                      <h4 className="font-semibold flex items-center gap-2 mb-2">
                        <List className="h-4 w-4" />
                        Ingredientes
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {selectedRecipe.ingredients.map((ing, i) => (
                          <li key={i}>{ing}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold flex items-center gap-2 mb-2">
                        Instrucciones
                      </h4>
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        {selectedRecipe.instructions.map((inst, i) => (
                          <li key={i}>{inst}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="flex gap-2 text-sm pt-2 border-t">
                      <span className="text-primary font-medium">Prot: {selectedRecipe.protein} g</span>
                      <span className="text-amber-600 font-medium">Carb: {selectedRecipe.carbs} g</span>
                      <span className="text-yellow-700 font-medium">Grasas: {selectedRecipe.fat} g</span>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SuperadminLayout>
  );
}
