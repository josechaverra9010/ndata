import { useState, useEffect } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    Search, Clock, Flame, Users, ChefHat, Heart, Filter, Eye, Utensils, List
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

const categories = ["Todas", "Desayunos", "Ensaladas", "Platos principales", "Bebidas", "Snacks", "Postres"];

export default function PatientRecipes() {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("Todas");
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [recipeDetail, setRecipeDetail] = useState<Recipe | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const filteredRecipes = recipes.filter(recipe => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
            (recipe.name || "").toLowerCase().includes(q) ||
            (recipe.description || "").toLowerCase().includes(q) ||
            (recipe.tags || []).some(tag => (tag || "").toLowerCase().includes(q));
        const matchesCategory = selectedCategory === "Todas" || recipe.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

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
                    result.push(...text.split("\n").map(t => t.trim()).filter(Boolean));
                } else if (text.includes(",") && !text.trim().startsWith("[")) {
                    result.push(...text.split(",").map(t => t.trim()).filter(Boolean));
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
            if (s.includes("\n")) return s.split("\n").map(t => t.trim()).filter(Boolean);
            if (s.includes(",") && !s.includes("[")) return s.split(",").map(t => t.trim()).filter(Boolean);
            return [s];
        }
        return [];
    };

    const normalizeIngredients = (raw: unknown) => {
        // Caso especial: si vienen objetos { name, portion } o { name, portion_size }
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
                // Fallback al normalizador genérico
                result.push(
                    ...normalizeList([item], ["ingredient", "Ingredient", "name", "text", "title", "item"]),
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
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                }
            });
            if (response.ok) {
                const data = await response.json();
                const normalized = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
                    ...r,
                    ingredients: normalizeIngredients(r.ingredients ?? (r as Record<string, unknown>).Ingredients),
                    instructions: normalizeInstructions(r.instructions ?? (r as Record<string, unknown>).Instructions),
                }));
                setRecipes(normalized);
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

    // Al abrir el modal, cargar la receta completa por ID para tener ingredientes e instrucciones
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
                    tags: Array.isArray(data.tags) ? data.tags : selectedRecipe.tags,
                    ingredients: normalizeIngredients(data.ingredients ?? data.Ingredients),
                    instructions: normalizeInstructions(data.instructions ?? data.Instructions),
                } as Recipe);
            })
            .catch(() => { if (!cancelled) setRecipeDetail(selectedRecipe); })
            .finally(() => { if (!cancelled) setDetailLoading(false); });
        return () => { cancelled = true; };
    }, [isDetailOpen, selectedRecipe?.id]);

    const getImageUrl = (imagePath: string | undefined) => {
        if (!imagePath) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
        if (imagePath.startsWith("http")) return imagePath;
        const baseUrl = API_URL.replace("/api", "");
        return `${baseUrl}${imagePath}`;
    };

    if (loading) {
        return (
            <PatientLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Cargando recetas saludables...</p>
                    </div>
                </div>
            </PatientLayout>
        );
    }

    return (
        <PatientLayout>
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Explorar Recetas</h1>
                    <p className="text-muted-foreground">Recetas públicas y las de tu plan nutricional activo</p>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre, descripción o etiquetas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Recipe Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRecipes.map((recipe) => (
                        <Card
                            key={recipe.id}
                            className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group border-border shadow-card"
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
                                <Badge className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm text-foreground border-border shadow-sm">
                                    {recipe.category}
                                </Badge>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="p-2 bg-background/90 backdrop-blur-sm rounded-full shadow-sm">
                                        <Eye className="h-4 w-4 text-primary" />
                                    </div>
                                </div>
                            </div>
                            <CardContent className="p-4">
                                <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                                    {recipe.name}
                                </h3>
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                                    {recipe.description}
                                </p>

                                <div className="border-t border-border/50 pt-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <Clock className="h-3.5 w-3.5 text-primary" />
                                            {(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)} min
                                        </span>
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <Users className="h-3.5 w-3.5 text-blue-500" />
                                            {recipe.servings} porciones
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                        <span className="font-semibold flex items-center gap-1">
                                            <Flame className="h-3.5 w-3.5 text-orange-500" />
                                            {(recipe.calories ?? 0)} kcal
                                        </span>
                                        <span className="flex flex-col items-end sm:flex-row sm:items-center sm:gap-3">
                                            <span className="font-medium text-primary">
                                                Prot: {(recipe.protein ?? 0)} g
                                            </span>
                                            <span className="font-medium text-amber-600">
                                                Carb: {(recipe.carbs ?? 0)} g
                                            </span>
                                            <span className="font-medium text-yellow-700">
                                                Grasas: {(recipe.fat ?? 0)} g
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {filteredRecipes.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl bg-muted/5">
                        <ChefHat className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-xl font-bold">No se encontraron recetas</h3>
                        <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
                            {searchTerm || selectedCategory !== "Todas"
                                ? "No hay platos que coincidan con tu búsqueda actual."
                                : "Todavía no hay recetas disponibles en esta sección."}
                        </p>
                    </div>
                )}

                {/* Recipe Detail Dialog */}
                <Dialog open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) setRecipeDetail(null); }}>
                    <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden !flex flex-col gap-0" aria-describedby={undefined}>
                        <DialogHeader className="sr-only">
                            <DialogTitle>{selectedRecipe?.name ?? "Detalle de receta"}</DialogTitle>
                            <DialogDescription>Ingredientes, instrucciones y datos nutricionales de la receta.</DialogDescription>
                        </DialogHeader>
                        {selectedRecipe && (() => {
                            const recipe = recipeDetail ?? selectedRecipe;
                            const baseIngredients = normalizeIngredients(recipe.ingredients ?? (recipe as Record<string, unknown>).Ingredients);
                            const displayIngredients = baseIngredients.map((ing) => {
                                const row = getCompositionRowForIngredient(ing);
                                const grams = row?.portion_grams;
                                if (grams != null && grams !== 0) {
                                    return `${row!.name}: ${grams} g`;
                                }
                                return ing;
                            });
                            const displayInstructions = normalizeInstructions(recipe.instructions ?? (recipe as Record<string, unknown>).Instructions);
                            return (
                                <>
                                    <ScrollArea className="flex-1 min-h-0 overflow-auto">
                                        <div className="relative h-64 sm:h-80">
                                            <img
                                                src={getImageUrl(recipe.image)}
                                                alt={recipe.name}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                            <div className="absolute bottom-6 left-6 right-6">
                                                <Badge className="bg-primary/90 text-primary-foreground border-0 mb-2">
                                                    {selectedRecipe.category}
                                                </Badge>
                                                <h2 className="text-2xl sm:text-3xl font-bold text-white">{selectedRecipe.name}</h2>
                                            </div>
                                        </div>

                                        <div className="p-6 space-y-8">
                                            <p className="text-muted-foreground text-lg leading-relaxed">{recipe.description}</p>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                <div className="text-center p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                                    <Clock className="h-5 w-5 mx-auto mb-2 text-primary" />
                                                    <p className="text-base font-bold text-foreground">{(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)} min</p>
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Tiempo total</p>
                                                </div>
                                                <div className="text-center p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                                    <Flame className="h-5 w-5 mx-auto mb-2 text-orange-500" />
                                                    <p className="text-base font-bold text-foreground">{recipe.calories} kcal</p>
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Calorías</p>
                                                </div>
                                                <div className="text-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                                    <Users className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                                                    <p className="text-base font-bold text-foreground">{recipe.servings}</p>
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Porciones</p>
                                                </div>
                                                <div className="text-center p-4 bg-green-50 rounded-2xl border border-green-100">
                                                    <ChefHat className="h-5 w-5 mx-auto mb-2 text-green-500" />
                                                    <p className="text-base font-bold text-foreground">Saludable</p>
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Perfil</p>
                                                </div>
                                            </div>

                                            {/* Ingredientes e instrucciones — visibles justo debajo de las tarjetas */}
                                            <div className="space-y-4">
                                                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                                    <List className="h-5 w-5 text-primary" />
                                                    Ingredientes e instrucciones
                                                    {detailLoading && <span className="text-xs font-normal text-muted-foreground">(cargando…)</span>}
                                                </h3>
                                                <Tabs defaultValue="ingredients" className="w-full">
                                                    <TabsList className="w-full bg-muted/50 p-1 h-12">
                                                        <TabsTrigger value="ingredients" className="flex-1 gap-2 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                                            <List className="h-4 w-4" />
                                                            Ingredientes
                                                        </TabsTrigger>
                                                        <TabsTrigger value="instructions" className="flex-1 gap-2 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                                            <Utensils className="h-4 w-4" />
                                                            Instrucciones
                                                        </TabsTrigger>
                                                    </TabsList>
                                                    <TabsContent value="ingredients" className="mt-4">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2">
                                                            {displayIngredients.map((text, idx) => (
                                                                <div key={idx} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                                                                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                                                                    <span className="text-sm font-medium">{text}</span>
                                                                </div>
                                                            ))}
                                                            {displayIngredients.length === 0 && (
                                                                <p className="text-sm text-muted-foreground col-span-full">No hay ingredientes listados para esta receta.</p>
                                                            )}
                                                        </div>
                                                    </TabsContent>
                                                    <TabsContent value="instructions" className="mt-4">
                                                        <div className="space-y-4 max-h-[280px] overflow-y-auto pr-2">
                                                            {displayInstructions.map((text, idx) => (
                                                                <div key={idx} className="flex gap-4 p-4 bg-card border border-border rounded-xl group hover:border-primary/30 transition-colors">
                                                                    <span className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                                                        {idx + 1}
                                                                    </span>
                                                                    <p className="text-sm sm:text-base text-foreground leading-relaxed pt-1">{typeof text === "string" ? text : String(text ?? "")}</p>
                                                                </div>
                                                            ))}
                                                            {displayInstructions.length === 0 && (
                                                                <p className="text-sm text-muted-foreground">No hay instrucciones listadas para esta receta.</p>
                                                            )}
                                                        </div>
                                                    </TabsContent>
                                                </Tabs>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3 p-4 bg-muted/30 rounded-2xl border border-border">
                                                <div className="text-center">
                                                    <p className="text-sm text-muted-foreground mb-1">Proteína</p>
                                                    <p className="text-lg font-bold text-primary">{recipe.protein}g</p>
                                                </div>
                                                <div className="text-center border-x border-border/50">
                                                    <p className="text-sm text-muted-foreground mb-1">Carbos</p>
                                                    <p className="text-lg font-bold text-orange-500">{recipe.carbs}g</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm text-muted-foreground mb-1">Grasas</p>
                                                    <p className="text-lg font-bold text-yellow-600">{recipe.fat}g</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2 pt-4">
                                                {(Array.isArray(recipe.tags) ? recipe.tags : []).map((tag, i) => (
                                                    <Badge key={i} variant="outline" className="text-xs bg-muted/30">#{typeof tag === "string" ? tag : String(tag)}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </ScrollArea>
                                    <div className="shrink-0 p-4 border-t border-border bg-background flex justify-end">
                                        <Button onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
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
