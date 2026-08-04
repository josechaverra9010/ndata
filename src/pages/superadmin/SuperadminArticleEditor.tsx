import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { ArticleRichEditor } from "@/components/articles/ArticleRichEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Eye, BarChart2 } from "lucide-react";

interface ArticleCategory {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
}

function toDatetimeLocal(value?: string | null): string {
  if (!value) return "";
  const normalized = value.replace(" ", "T").slice(0, 16);
  return normalized;
}

function fromDatetimeLocal(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace("T", " ") + ":00";
}

export default function SuperadminArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [content, setContent] = useState("<p></p>");
  const [category, setCategory] = useState("Nutrición");
  const [author, setAuthor] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [ogImageFile, setOgImageFile] = useState<File | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [previewCover, setPreviewCover] = useState("");
  const [previewOg, setPreviewOg] = useState("");
  const [viewCount, setViewCount] = useState(0);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  const authHeaders = () => {
    const token = localStorage.getItem("userToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/superadmin/article-categories`, {
          headers: authHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          const active = data.filter((c: ArticleCategory) => c.is_active);
          setCategories(active.length ? active : data);
        }
      } catch {
        /* ignore */
      }
    };
    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/superadmin/articles/${id}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error("No se pudo cargar");
        const article = await res.json();
        if (cancelled) return;
        setTitle(article.title || "");
        setSlug(article.slug || "");
        setSavedSlug(article.slug || null);
        setExcerpt(article.excerpt || "");
        setMetaDescription(article.meta_description || "");
        setContent(article.content || "<p></p>");
        setCategory(article.category || "Nutrición");
        setAuthor(article.author || "");
        setImageUrl(article.image?.startsWith("http") ? article.image : "");
        setPreviewCover(article.image || "");
        setOgImageUrl(article.og_image?.startsWith("http") ? article.og_image : "");
        setPreviewOg(article.og_image || article.image || "");
        setIsPublished(!!article.is_published);
        setScheduledAt(toDatetimeLocal(article.scheduled_publish_at));
        setViewCount(article.view_count || 0);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Error al cargar");
        navigate("/superadmin/articles");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, isNew, navigate]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    const plain = content.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!plain) {
      toast.error("Escribe el contenido del artículo en la hoja de edición");
      return;
    }

    setSaving(true);
    try {
      const body = new FormData();
      body.append("title", title.trim());
      body.append("content", content);
      body.append("excerpt", excerpt.trim());
      body.append("category", category);
      body.append("author", author.trim());
      body.append("meta_description", metaDescription.trim());
      if (slug.trim()) body.append("slug", slug.trim());
      body.append("is_published", String(isPublished));
      const sched = fromDatetimeLocal(scheduledAt);
      if (sched) body.append("scheduled_publish_at", sched);
      if (imageUrl.trim()) body.append("image_url", imageUrl.trim());
      if (ogImageUrl.trim()) body.append("og_image_url", ogImageUrl.trim());
      if (imageFile) body.append("image", imageFile);
      if (ogImageFile) body.append("og_image", ogImageFile);

      const url = isNew
        ? `${API_URL}/superadmin/articles`
        : `${API_URL}/superadmin/articles/${id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "No se pudo guardar");
      }
      const data = await res.json();
      toast.success(isNew ? "Artículo creado" : "Artículo guardado");
      if (isNew && data?.article?.id) {
        navigate(`/superadmin/articles/${data.article.id}/edit`, { replace: true });
      } else {
        navigate("/superadmin/articles");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = savedSlug ? `/article/${savedSlug}` : id ? `/article/${id}` : null;
  const scheduleMode = !!scheduledAt && !isPublished;

  if (loading) {
    return (
      <SuperadminLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Abriendo hoja de edición…</p>
        </div>
      </SuperadminLayout>
    );
  }

  return (
    <SuperadminLayout>
      <div className="space-y-5 animate-fade-in pb-10">
        <div className="sticky top-0 z-20 -mx-1 rounded-2xl border border-border/70 bg-background/95 backdrop-blur-md p-3 sm:p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full"
                onClick={() => navigate("/superadmin/articles")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-destructive/80">
                  Hoja de edición
                </p>
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {isNew ? "Nuevo artículo" : title || "Editar artículo"}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  SEO, programación y contenido en una sola hoja.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isNew && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2.5 py-1 rounded-full border border-border">
                  <BarChart2 className="h-3.5 w-3.5" />
                  {viewCount.toLocaleString("es-CO")} vistas
                </span>
              )}
              {!isNew && isPublished && publicUrl && (
                <Button variant="outline" size="sm" className="rounded-full gap-1.5" asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <Eye className="h-3.5 w-3.5" />
                    Ver público
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => navigate("/superadmin/articles")}
              >
                Cancelar
              </Button>
              <Button className="rounded-full gap-2" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título del artículo"
                  className="h-11 text-lg font-semibold rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Resumen (para las tarjetas del listado)</Label>
                <Textarea
                  rows={2}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Breve descripción que aparece en el home y en /articles"
                  className="rounded-xl resize-none"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">SEO</h2>
              <div className="space-y-2">
                <Label>Slug (URL amigable)</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="mi-articulo-nutricion"
                  className="rounded-xl font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Se genera automáticamente del título si lo dejas vacío.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Meta description</Label>
                <Textarea
                  rows={2}
                  maxLength={320}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Descripción para buscadores y redes sociales (máx. 320 caracteres)"
                  className="rounded-xl resize-none"
                />
                <p className="text-xs text-muted-foreground text-right tabular-nums">
                  {metaDescription.length}/320
                </p>
              </div>
            </div>

            <ArticleRichEditor value={content} onChange={setContent} />
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 h-fit">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Publicación</h2>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Publicar ahora</p>
                  <p className="text-xs text-muted-foreground">Visible en el home público</p>
                </div>
                <Switch
                  checked={isPublished}
                  onCheckedChange={(v) => {
                    setIsPublished(v);
                    if (v) setScheduledAt("");
                  }}
                  disabled={scheduleMode}
                />
              </div>

              <div className="space-y-2">
                <Label>Programar publicación</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => {
                    setScheduledAt(e.target.value);
                    if (e.target.value) setIsPublished(false);
                  }}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  {scheduleMode
                    ? "Se publicará automáticamente en la fecha indicada."
                    : "Opcional. Deja vacío para publicar manualmente."}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories.length
                      ? categories.map((c) => c.name)
                      : ["Nutrición"]
                    ).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Autor</Label>
                <Input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Equipo NutriData"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Portada</h2>
              {(previewCover || imageUrl) && (
                <div className="aspect-video rounded-xl overflow-hidden border border-border bg-muted">
                  <img
                    src={previewCover || imageUrl}
                    alt="Portada"
                    className="h-full w-full object-cover"
                    onError={() => setPreviewCover("")}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>URL de imagen</Label>
                <Input
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setPreviewCover(e.target.value);
                  }}
                  placeholder="https://…"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Subir imagen</Label>
                <Input
                  type="file"
                  accept="image/*"
                  className="rounded-xl"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setImageFile(file);
                    if (file) setPreviewCover(URL.createObjectURL(file));
                  }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Imagen OG (redes)</h2>
              {(previewOg || ogImageUrl) && (
                <div className="aspect-[1.91/1] rounded-xl overflow-hidden border border-border bg-muted">
                  <img
                    src={previewOg || ogImageUrl}
                    alt="OG"
                    className="h-full w-full object-cover"
                    onError={() => setPreviewOg("")}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>URL OG image</Label>
                <Input
                  value={ogImageUrl}
                  onChange={(e) => {
                    setOgImageUrl(e.target.value);
                    setPreviewOg(e.target.value);
                  }}
                  placeholder="https://… (1200×630 recomendado)"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Subir OG image</Label>
                <Input
                  type="file"
                  accept="image/*"
                  className="rounded-xl"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setOgImageFile(file);
                    if (file) setPreviewOg(URL.createObjectURL(file));
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Si no defines una, se usará la portada del artículo.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </SuperadminLayout>
  );
}
