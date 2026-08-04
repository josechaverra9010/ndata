import { useState, useEffect, useMemo } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  Share2,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  BarChart3,
  AlertTriangle,
  Library,
  ClipboardCheck,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SharedNutritionist {
  id: number;
  name: string;
  email?: string;
}

interface QualityReport {
  score: number;
  grade: string;
  issues: string[];
  variance_pct: Record<string, number>;
  matched_ingredients: number;
  total_ingredients: number;
  unmatched_ingredients: string[];
}

interface UsageStats {
  menu_count: number;
  legacy_menu_count: number;
  daily_assignment_days: number;
  total_slot_usages: number;
  active_patient_count: number;
}

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
  is_system?: boolean;
  approval_status?: string;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
  shared_with?: SharedNutritionist[];
  shared_nutritionist_ids?: number[];
  quality_report?: QualityReport;
  usage?: UsageStats;
}

interface GlobalStats {
  total_recipes: number;
  public_recipes: number;
  system_recipes: number;
  pending_moderation: number;
  top_by_usage: (UsageStats & { id: number; name: string; is_public: boolean })[];
}

interface NutritionistOption {
  id: number;
  name: string;
  email: string;
  status: string;
}

const categories = ["Todas", "Desayunos", "Ensaladas", "Platos principales", "Bebidas", "Snacks", "Postres"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  pending: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
};

function statusBadge(status?: string) {
  const s = status || "draft";
  if (s === "pending") {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 gap-1">
        <ClipboardCheck className="h-3 w-3" />
        En revisión
      </Badge>
    );
  }
  if (s === "approved") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Aprobada
      </Badge>
    );
  }
  if (s === "rejected") {
    return (
      <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-0 gap-1">
        <XCircle className="h-3 w-3" />
        Rechazada
      </Badge>
    );
  }
  return <Badge variant="secondary">Borrador</Badge>;
}

function gradeColor(grade: string) {
  if (grade === "excelente") return "text-emerald-600";
  if (grade === "buena") return "text-sky-600";
  if (grade === "regular") return "text-amber-600";
  return "text-red-600";
}

export default function SuperadminRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [nutritionists, setNutritionists] = useState<NutritionistOption[]>([]);
  const [shareIds, setShareIds] = useState<number[]>([]);
  const [savingShares, setSavingShares] = useState(false);
  const [nutriSearch, setNutriSearch] = useState("");

  const token = () => localStorage.getItem("userToken");
  const authHeaders = () => ({
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
  });

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (recipe.created_by_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "Todas" || recipe.category === selectedCategory;
    const matchesStatus =
      statusFilter === "all" || (recipe.approval_status || "draft") === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const uniqueCreators = new Set(recipes.map((r) => r.created_by_name).filter(Boolean));
  const sharedCount = recipes.filter((r) => (r.shared_nutritionist_ids || []).length > 0).length;
  const pendingCount = recipes.filter((r) => r.approval_status === "pending").length;

  const filteredNutritionists = useMemo(() => {
    const q = nutriSearch.toLowerCase().trim();
    const list = nutritionists.filter((n) => n.status !== "inactivo");
    if (!q) return list;
    return list.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.email || "").toLowerCase().includes(q)
    );
  }, [nutritionists, nutriSearch]);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const [listRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/superadmin/recipes?include_usage=true&include_quality=true`, {
          headers: authHeaders(),
        }),
        fetch(`${API_URL}/superadmin/recipes/stats`, { headers: authHeaders() }),
      ]);
      if (listRes.ok) {
        setRecipes(await listRes.json());
      } else {
        const err = await listRes.json().catch(() => ({}));
        toast.error(err.detail || "Error al cargar recetas");
      }
      if (statsRes.ok) {
        setGlobalStats(await statsRes.json());
      }
    } catch (error) {
      console.error(error);
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const fetchNutritionists = async () => {
    try {
      const response = await fetch(`${API_URL}/superadmin/nutritionists`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setNutritionists(Array.isArray(data) ? data : []);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchRecipes();
    fetchNutritionists();
  }, []);

  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
    if (imagePath.startsWith("http")) return imagePath;
    const baseUrl = API_URL.replace("/api", "");
    return `${baseUrl}${imagePath}`;
  };

  const applyRecipeUpdate = (updated: Recipe) => {
    setRecipes((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
    if (selectedRecipe?.id === updated.id) {
      setSelectedRecipe({ ...selectedRecipe, ...updated });
    }
  };

  const openDetail = async (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShareIds([...(recipe.shared_nutritionist_ids || [])]);
    setNutriSearch("");
    setIsDetailOpen(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/recipes/${recipe.id}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const full = await res.json();
        setSelectedRecipe(full);
        applyRecipeUpdate(full);
      }
    } catch {
      /* keep cached */
    }
  };

  const toggleVisibility = async (recipe: Recipe) => {
    try {
      const response = await fetch(`${API_URL}/superadmin/recipes/${recipe.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ is_public: !recipe.is_public }),
      });
      if (response.ok) {
        const data = await response.json();
        applyRecipeUpdate({ ...recipe, ...data });
        toast.success(recipe.is_public ? "Receta marcada como privada" : "Receta marcada como pública");
        fetchRecipes();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.detail || "Error al cambiar visibilidad");
      }
    } catch {
      toast.error("Error al cambiar visibilidad");
    }
  };

  const approveRecipe = async (recipe: Recipe) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/recipes/${recipe.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ is_public: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error");
      applyRecipeUpdate(data.recipe);
      toast.success("Receta aprobada y publicada");
      fetchRecipes();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al aprobar");
    } finally {
      setActionLoading(false);
    }
  };

  const rejectRecipe = async () => {
    if (!selectedRecipe || !rejectReason.trim()) {
      toast.error("Indica el motivo del rechazo");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/recipes/${selectedRecipe.id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error");
      applyRecipeUpdate(data.recipe);
      setRejectOpen(false);
      setRejectReason("");
      toast.success("Receta rechazada");
      fetchRecipes();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al rechazar");
    } finally {
      setActionLoading(false);
    }
  };

  const duplicateToLibrary = async (recipe: Recipe) => {
    if (!confirm(`¿Duplicar "${recipe.name}" a la biblioteca global del sistema?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/recipes/${recipe.id}/duplicate-to-library`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error");
      toast.success(data.message || "Duplicada en biblioteca");
      fetchRecipes();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al duplicar");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleShareId = (id: number, checked: boolean) => {
    setShareIds((prev) =>
      checked ? [...prev.filter((x) => x !== id), id] : prev.filter((x) => x !== id)
    );
  };

  const saveShares = async () => {
    if (!selectedRecipe) return;
    setSavingShares(true);
    try {
      const response = await fetch(`${API_URL}/superadmin/recipes/${selectedRecipe.id}/shares`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ nutritionist_ids: shareIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Error");
      const updated = data.recipe || data;
      applyRecipeUpdate({ ...selectedRecipe, ...updated });
      setShareIds(updated.shared_nutritionist_ids || shareIds);
      toast.success("Compartidos actualizados");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingShares(false);
    }
  };

  if (loading) {
    return (
      <SuperadminLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </SuperadminLayout>
    );
  }

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Recetas globales</h1>
          <p className="text-muted-foreground">
            Moderación, calidad nutricional, biblioteca del sistema y uso en menús
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar receta, autor, etiquetas…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">En revisión ({pendingCount})</SelectItem>
              <SelectItem value="approved">Aprobadas</SelectItem>
              <SelectItem value="draft">Borradores</SelectItem>
              <SelectItem value="rejected">Rechazadas</SelectItem>
            </SelectContent>
          </Select>
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ChefHat className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xl font-bold tabular-nums">{recipes.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-xl font-bold tabular-nums">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">En revisión</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Globe className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xl font-bold tabular-nums">
                  {recipes.filter((r) => r.is_public).length}
                </p>
                <p className="text-xs text-muted-foreground">Públicas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Library className="h-5 w-5 text-violet-600" />
              <div>
                <p className="text-xl font-bold tabular-nums">
                  {recipes.filter((r) => r.is_system).length}
                </p>
                <p className="text-xs text-muted-foreground">Sistema</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <UserCog className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-xl font-bold tabular-nums">{uniqueCreators.size}</p>
                <p className="text-xs text-muted-foreground">Autores</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Share2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xl font-bold tabular-nums">{sharedCount}</p>
                <p className="text-xs text-muted-foreground">Compartidas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {globalStats && globalStats.top_by_usage.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Top recetas por uso en menús
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {globalStats.top_by_usage.slice(0, 8).map((r, i) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 text-sm py-1 border-b border-border/50 last:border-0"
                  >
                    <span className="text-muted-foreground w-5">{i + 1}.</span>
                    <span className="flex-1 truncate font-medium">{r.name}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {r.total_slot_usages} usos · {r.menu_count} menús
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecipes.map((recipe) => (
            <Card
              key={recipe.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => openDetail(recipe)}
            >
              <div className="relative">
                <img
                  src={getImageUrl(recipe.image)}
                  alt={recipe.name}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <Badge className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm">
                  {recipe.category}
                </Badge>
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  {statusBadge(recipe.approval_status)}
                  {recipe.is_system && (
                    <Badge className="bg-violet-600/90 text-white border-0">
                      <Library className="h-3 w-3 mr-1" />
                      Sistema
                    </Badge>
                  )}
                </div>
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                  {recipe.created_by_name && (
                    <Badge variant="secondary" className="bg-background/80 text-[10px]">
                      {recipe.created_by_name}
                    </Badge>
                  )}
                  {(recipe.usage?.total_slot_usages || 0) > 0 && (
                    <Badge variant="outline" className="bg-background/80 tabular-nums text-[10px]">
                      <BarChart3 className="h-3 w-3 mr-1" />
                      {recipe.usage?.total_slot_usages} usos
                    </Badge>
                  )}
                  {recipe.quality_report && (
                    <Badge
                      variant="outline"
                      className={`bg-background/80 text-[10px] ${gradeColor(recipe.quality_report.grade)}`}
                    >
                      Calidad {recipe.quality_report.score}
                    </Badge>
                  )}
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-1 line-clamp-1">{recipe.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{recipe.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5 text-amber-600" />
                    {recipe.calories} kcal
                  </span>
                  <span>Prot {recipe.protein}g</span>
                </div>
                {recipe.approval_status === "pending" && (
                  <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      className="flex-1 gap-1"
                      disabled={actionLoading}
                      onClick={() => approveRecipe(recipe)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1 text-destructive"
                      disabled={actionLoading}
                      onClick={() => {
                        setSelectedRecipe(recipe);
                        setRejectOpen(true);
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Rechazar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredRecipes.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ChefHat className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>No hay recetas con los filtros actuales</p>
          </div>
        )}

        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            {selectedRecipe && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex flex-wrap items-center gap-2">
                    {selectedRecipe.name}
                    {statusBadge(selectedRecipe.approval_status)}
                  </DialogTitle>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedRecipe.created_by_name && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <UserCog className="h-4 w-4" />
                        {selectedRecipe.created_by_name}
                      </span>
                    )}
                    <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5">
                      <Switch
                        checked={!!selectedRecipe.is_public}
                        onCheckedChange={() => toggleVisibility(selectedRecipe)}
                      />
                      <Label className="text-sm">
                        {selectedRecipe.is_public ? "Pública" : "Privada"}
                      </Label>
                    </div>
                  </div>
                </DialogHeader>
                <ScrollArea className="max-h-[65vh] pr-4">
                  <div className="space-y-4">
                    {selectedRecipe.approval_status === "rejected" && selectedRecipe.rejection_reason && (
                      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-300">
                        <strong>Motivo de rechazo:</strong> {selectedRecipe.rejection_reason}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {selectedRecipe.approval_status === "pending" && (
                        <>
                          <Button size="sm" className="gap-1" disabled={actionLoading} onClick={() => approveRecipe(selectedRecipe)}>
                            <CheckCircle2 className="h-4 w-4" /> Aprobar y publicar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-destructive"
                            onClick={() => setRejectOpen(true)}
                          >
                            <XCircle className="h-4 w-4" /> Rechazar
                          </Button>
                        </>
                      )}
                      {!selectedRecipe.is_system && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={actionLoading}
                          onClick={() => duplicateToLibrary(selectedRecipe)}
                        >
                          <Copy className="h-4 w-4" /> Duplicar a biblioteca sistema
                        </Button>
                      )}
                    </div>

                    {selectedRecipe.quality_report && (
                      <div className="rounded-xl border p-4 space-y-2 bg-muted/20">
                        <p className="text-sm font-semibold flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Reporte de calidad nutricional
                          <Badge className={gradeColor(selectedRecipe.quality_report.grade)}>
                            {selectedRecipe.quality_report.grade} · {selectedRecipe.quality_report.score}/100
                          </Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedRecipe.quality_report.matched_ingredients}/
                          {selectedRecipe.quality_report.total_ingredients} ingredientes reconocidos en tabla EVANUT
                        </p>
                        {selectedRecipe.quality_report.issues.length > 0 ? (
                          <ul className="text-xs space-y-1 list-disc list-inside text-amber-700 dark:text-amber-300">
                            {selectedRecipe.quality_report.issues.map((issue, i) => (
                              <li key={i}>{issue}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-emerald-600">Sin alertas de calidad</p>
                        )}
                      </div>
                    )}

                    {selectedRecipe.usage && (
                      <div className="rounded-xl border p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div>
                          <p className="text-lg font-bold tabular-nums">{selectedRecipe.usage.menu_count}</p>
                          <p className="text-xs text-muted-foreground">Menús</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold tabular-nums">{selectedRecipe.usage.total_slot_usages}</p>
                          <p className="text-xs text-muted-foreground">Usos totales</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold tabular-nums">{selectedRecipe.usage.daily_assignment_days}</p>
                          <p className="text-xs text-muted-foreground">Días asignados</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold tabular-nums">{selectedRecipe.usage.active_patient_count}</p>
                          <p className="text-xs text-muted-foreground">Pacientes activos</p>
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl border p-4 space-y-3 bg-muted/20">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Share2 className="h-4 w-4" />
                          Compartir con nutricionistas
                        </p>
                        <Button size="sm" onClick={saveShares} disabled={savingShares}>
                          {savingShares && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Guardar ({shareIds.length})
                        </Button>
                      </div>
                      <Input
                        placeholder="Buscar nutricionista…"
                        value={nutriSearch}
                        onChange={(e) => setNutriSearch(e.target.value)}
                        className="h-9"
                      />
                      <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2">
                        {filteredNutritionists.map((n) => (
                          <label key={n.id} className="flex items-center gap-2 px-2 py-1 hover:bg-muted/60 rounded cursor-pointer">
                            <Checkbox
                              checked={shareIds.includes(n.id)}
                              onCheckedChange={(v) => toggleShareId(n.id, !!v)}
                            />
                            <span className="text-sm truncate">{n.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {selectedRecipe.image && (
                      <img
                        src={getImageUrl(selectedRecipe.image)}
                        alt=""
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                    )}

                    <div>
                      <h4 className="font-semibold flex items-center gap-2 mb-2">
                        <List className="h-4 w-4" /> Ingredientes
                      </h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {selectedRecipe.ingredients.map((ing, i) => (
                          <li key={i}>{ing}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Instrucciones</h4>
                      <ol className="list-decimal list-inside text-sm space-y-1">
                        {selectedRecipe.instructions.map((inst, i) => (
                          <li key={i}>{inst}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="flex gap-4 text-sm border-t pt-3">
                      <span className="text-amber-600 font-medium">{selectedRecipe.calories} kcal</span>
                      <span className="text-primary font-medium">Prot {selectedRecipe.protein}g</span>
                      <span>CHO {selectedRecipe.carbs}g</span>
                      <span>Grasa {selectedRecipe.fat}g</span>
                      <span className="text-muted-foreground">
                        Estado: {STATUS_LABELS[selectedRecipe.approval_status || "draft"]}
                      </span>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rechazar receta</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Motivo del rechazo (visible para el nutricionista)…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" disabled={actionLoading} onClick={rejectRecipe}>
                Rechazar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperadminLayout>
  );
}
