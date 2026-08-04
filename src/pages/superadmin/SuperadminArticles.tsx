import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_URL } from "@/config/api";
import { formatDateTimeInColombia } from "@/lib/timezone";
import { toast } from "sonner";
import {
  Newspaper,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  FileEdit,
  BarChart2,
  CalendarClock,
  Tags,
} from "lucide-react";

interface Article {
  id: number;
  title: string;
  slug?: string | null;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  image: string;
  is_published: boolean;
  publish_status?: "published" | "draft" | "scheduled";
  published_at?: string | null;
  scheduled_publish_at?: string | null;
  view_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
  date?: string | null;
}

interface Analytics {
  total_views: number;
  total_articles: number;
  published: number;
  scheduled: number;
  top_articles: { id: number; title: string; view_count: number }[];
}

interface ArticleCategory {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

function statusBadge(article: Article) {
  const status = article.publish_status || (article.is_published ? "published" : "draft");
  if (status === "scheduled") {
    return (
      <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-0 gap-1">
        <CalendarClock className="h-3 w-3" />
        Programado
      </Badge>
    );
  }
  if (status === "published") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0">
        Publicado
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0">
      Borrador
    </Badge>
  );
}

export default function SuperadminArticles() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<Article[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "scheduled">("all");

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<ArticleCategory | null>(null);
  const [editCatName, setEditCatName] = useState("");

  const authHeaders = () => {
    const token = localStorage.getItem("userToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        (a.excerpt || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q);
      const status = a.publish_status || (a.is_published ? "published" : "draft");
      const matchesFilter =
        filter === "all" ||
        (filter === "published" && status === "published") ||
        (filter === "draft" && status === "draft") ||
        (filter === "scheduled" && status === "scheduled");
      return matchesSearch && matchesFilter;
    });
  }, [articles, searchTerm, filter]);

  const stats = useMemo(
    () => ({
      total: articles.length,
      published: articles.filter((a) => (a.publish_status || "") === "published" || (a.is_published && a.publish_status !== "scheduled")).length,
      draft: articles.filter((a) => (a.publish_status || "draft") === "draft").length,
      scheduled: articles.filter((a) => a.publish_status === "scheduled").length,
      views: analytics?.total_views ?? articles.reduce((s, a) => s + (a.view_count || 0), 0),
    }),
    [articles, analytics]
  );

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const [listRes, analyticsRes] = await Promise.all([
        fetch(`${API_URL}/superadmin/articles`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/articles/analytics`, { headers: authHeaders() }),
      ]);
      if (!listRes.ok) throw new Error("No se pudieron cargar los artículos");
      const data = await listRes.json();
      setArticles(Array.isArray(data) ? data : []);
      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar artículos");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    setCatLoading(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/article-categories`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al cargar categorías");
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const openCategories = () => {
    setCatDialogOpen(true);
    fetchCategories();
  };

  const createCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const res = await fetch(`${API_URL}/superadmin/article-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error");
      }
      setNewCatName("");
      toast.success("Categoría creada");
      fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    }
  };

  const saveCategory = async () => {
    if (!editingCat || !editCatName.trim()) return;
    try {
      const res = await fetch(`${API_URL}/superadmin/article-categories/${editingCat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: editCatName.trim() }),
      });
      if (!res.ok) throw new Error();
      setEditingCat(null);
      toast.success("Categoría actualizada");
      fetchCategories();
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const toggleCategoryActive = async (cat: ArticleCategory) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/article-categories/${cat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ is_active: !cat.is_active }),
      });
      if (!res.ok) throw new Error();
      fetchCategories();
    } catch {
      toast.error("Error al cambiar estado");
    }
  };

  const deleteCategory = async (cat: ArticleCategory) => {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/superadmin/article-categories/${cat.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error");
      }
      toast.success("Categoría eliminada");
      fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const togglePublish = async (article: Article) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/articles/${article.id}/publish`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ is_published: !article.is_published }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar el estado");
      toast.success(!article.is_published ? "Artículo publicado" : "Artículo despublicado");
      fetchArticles();
    } catch {
      toast.error("Error al cambiar publicación");
    }
  };

  const handleDelete = async (article: Article) => {
    if (!confirm(`¿Eliminar el artículo "${article.title}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/superadmin/articles/${article.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("No se pudo eliminar");
      toast.success("Artículo eliminado");
      fetchArticles();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-destructive/80 mb-1">
              SuperAdmin
            </p>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Artículos del Home</h1>
            <p className="text-muted-foreground mt-1">
              CMS con SEO, programación, analytics y categorías gestionables.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2 rounded-full" onClick={openCategories}>
              <Tags className="h-4 w-4" />
              Categorías
            </Button>
            <Button
              className="gap-2 rounded-full"
              onClick={() => navigate("/superadmin/articles/new")}
            >
              <Plus className="h-4 w-4" />
              Nuevo artículo
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Total</p>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Publicados</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-600">{stats.published}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Programados</p>
              <p className="text-2xl font-bold tabular-nums text-blue-600">{stats.scheduled}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Borradores</p>
              <p className="text-2xl font-bold tabular-nums text-amber-600">{stats.draft}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                <BarChart2 className="h-3 w-3" /> Vistas
              </p>
              <p className="text-2xl font-bold tabular-nums">{stats.views.toLocaleString("es-CO")}</p>
            </CardContent>
          </Card>
        </div>

        {analytics && analytics.top_articles.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-destructive" />
                Top artículos por vistas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.top_articles.slice(0, 5).map((a, i) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-border/50 last:border-0"
                  >
                    <span className="text-muted-foreground w-5 tabular-nums">{i + 1}.</span>
                    <span className="flex-1 truncate font-medium">{a.title}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {a.view_count.toLocaleString("es-CO")} vistas
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Newspaper className="h-4 w-4 text-destructive" />
                Biblioteca de artículos
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <SelectTrigger className="sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="published">Publicados</SelectItem>
                    <SelectItem value="scheduled">Programados</SelectItem>
                    <SelectItem value="draft">Borradores</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileEdit className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No hay artículos para mostrar</p>
                <Button
                  className="mt-4 rounded-full"
                  variant="outline"
                  onClick={() => navigate("/superadmin/articles/new")}
                >
                  Crear en hoja Word
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((article) => (
                  <div
                    key={article.id}
                    className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-border hover:border-destructive/20 transition-colors"
                  >
                    <div className="h-24 w-full sm:w-36 shrink-0 rounded-lg overflow-hidden bg-muted">
                      {article.image ? (
                        <img
                          src={article.image}
                          alt={article.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="secondary">{article.category}</Badge>
                        {statusBadge(article)}
                        <Badge variant="outline" className="gap-1 tabular-nums">
                          <BarChart2 className="h-3 w-3" />
                          {(article.view_count || 0).toLocaleString("es-CO")}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-foreground truncate">{article.title}</h3>
                      {article.slug && (
                        <p className="text-xs text-muted-foreground font-mono truncate">/{article.slug}</p>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {article.excerpt || "Sin resumen"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {article.author} ·{" "}
                        {formatDateTimeInColombia(article.updated_at || article.created_at)}
                        {article.scheduled_publish_at && (
                          <>
                            {" "}
                            · Programado:{" "}
                            {formatDateTimeInColombia(article.scheduled_publish_at)}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex sm:flex-col gap-2 sm:items-stretch shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => togglePublish(article)}
                        disabled={article.publish_status === "scheduled"}
                      >
                        {article.is_published ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" /> Despublicar
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" /> Publicar
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => navigate(`/superadmin/articles/${article.id}/edit`)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Abrir hoja
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive gap-1.5"
                        onClick={() => handleDelete(article)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Categorías de artículos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nueva categoría…"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCategory()}
              />
              <Button onClick={createCategory} disabled={!newCatName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {catLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border"
                  >
                    {editingCat?.id === cat.id ? (
                      <>
                        <Input
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          className="h-8"
                        />
                        <Button size="sm" onClick={saveCategory}>
                          OK
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCat(null)}>
                          ✕
                        </Button>
                      </>
                    ) : (
                      <>
                        <span
                          className={`flex-1 text-sm ${!cat.is_active ? "line-through text-muted-foreground" : ""}`}
                        >
                          {cat.name}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingCat(cat);
                            setEditCatName(cat.name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleCategoryActive(cat)}>
                          {cat.is_active ? "Ocultar" : "Activar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteCategory(cat)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
