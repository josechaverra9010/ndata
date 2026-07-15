import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

interface Article {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  image: string;
  is_published: boolean;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  date?: string | null;
}

export default function SuperadminArticles() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        (a.excerpt || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ||
        (filter === "published" && a.is_published) ||
        (filter === "draft" && !a.is_published);
      return matchesSearch && matchesFilter;
    });
  }, [articles, searchTerm, filter]);

  const stats = useMemo(
    () => ({
      total: articles.length,
      published: articles.filter((a) => a.is_published).length,
      draft: articles.filter((a) => !a.is_published).length,
    }),
    [articles]
  );

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/superadmin/articles`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error("No se pudieron cargar los artículos");
      const data = await res.json();
      setArticles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar artículos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const togglePublish = async (article: Article) => {
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/superadmin/articles/${article.id}/publish`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/superadmin/articles/${article.id}`, {
        method: "DELETE",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
              Abre una hoja de edición tipo Word. La estructura se respeta en el detalle público.
            </p>
          </div>
          <Button
            className="gap-2 rounded-full"
            onClick={() => navigate("/superadmin/articles/new")}
          >
            <Plus className="h-4 w-4" />
            Nuevo artículo
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <p className="text-xs text-muted-foreground uppercase">Borradores</p>
              <p className="text-2xl font-bold tabular-nums text-amber-600">{stats.draft}</p>
            </CardContent>
          </Card>
        </div>

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
                        <Badge
                          className={
                            article.is_published
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0"
                          }
                        >
                          {article.is_published ? "Publicado" : "Borrador"}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-foreground truncate">{article.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {article.excerpt || "Sin resumen"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {article.author} ·{" "}
                        {formatDateTimeInColombia(article.updated_at || article.created_at)}
                      </p>
                    </div>
                    <div className="flex sm:flex-col gap-2 sm:items-stretch shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => togglePublish(article)}
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
    </SuperadminLayout>
  );
}
