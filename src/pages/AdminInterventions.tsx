import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { BookOpen, Copy, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";

interface Intervention {
  id: number;
  title: string;
  category: string;
  category_label: string;
  content_type: string;
  content_type_label: string;
  condition_tags: string[];
  body: string;
  is_system: boolean;
}

interface MetaOption {
  value: string;
  label: string;
}

const contentTypeColors: Record<string, string> = {
  recommendation: "bg-primary/10 text-primary border-primary/20",
  message: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
  smart_goal: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
};

export default function AdminInterventions() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Intervention[]>([]);
  const [categories, setCategories] = useState<MetaOption[]>([]);
  const [contentTypes, setContentTypes] = useState<MetaOption[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Intervention | null>(null);
  const [toDelete, setToDelete] = useState<Intervention | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "general",
    content_type: "recommendation",
    condition_tags: "",
    body: "",
  });

  const headers = () => {
    const token = localStorage.getItem("userToken");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (typeFilter !== "all") params.set("content_type", typeFilter);
      if (search.trim()) params.set("q", search.trim());
      const [metaRes, listRes] = await Promise.all([
        fetch(`${API_URL}/nutritionist/interventions/meta`, { headers: headers() }),
        fetch(`${API_URL}/nutritionist/interventions?${params}`, { headers: headers() }),
      ]);
      if (!metaRes.ok || !listRes.ok) throw new Error("Error al cargar biblioteca");
      const meta = await metaRes.json();
      const list = await listRes.json();
      setCategories(meta.categories || []);
      setContentTypes(meta.content_types || []);
      setItems(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo cargar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, typeFilter, search, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      category: "general",
      content_type: "recommendation",
      condition_tags: "",
      body: "",
    });
    setEditorOpen(true);
  };

  const openEdit = (item: Intervention) => {
    if (item.is_system) {
      toast({ title: "Plantilla del sistema", description: "Duplícala creando una copia propia." });
      setEditing(null);
      setForm({
        title: `${item.title} (copia)`,
        category: item.category,
        content_type: item.content_type,
        condition_tags: item.condition_tags.join(", "),
        body: item.body,
      });
      setEditorOpen(true);
      return;
    }
    setEditing(item);
    setForm({
      title: item.title,
      category: item.category,
      content_type: item.content_type,
      condition_tags: item.condition_tags.join(", "),
      body: item.body,
    });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        content_type: form.content_type,
        condition_tags: form.condition_tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        body: form.body.trim(),
      };
      const url = editing
        ? `${API_URL}/nutritionist/interventions/${editing.id}`
        : `${API_URL}/nutritionist/interventions`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: headers(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error al guardar");
      }
      toast({ title: editing ? "Intervención actualizada" : "Intervención creada" });
      setEditorOpen(false);
      load();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo guardar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      const res = await fetch(`${API_URL}/nutritionist/interventions/${toDelete.id}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!res.ok) throw new Error("No se pudo eliminar");
      toast({ title: "Intervención eliminada" });
      setDeleteOpen(false);
      setToDelete(null);
      load();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Error al eliminar",
        variant: "destructive",
      });
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copiado al portapapeles" });
  };

  const filteredCount = useMemo(() => items.length, [items]);

  return (
    <AdminLayout>
      <LoadingGate loading={loading} message="Cargando biblioteca de intervenciones">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-primary" />
              Biblioteca de intervenciones
            </h1>
            <p className="text-muted-foreground mt-1">
              Plantillas reutilizables para consultas, mensajes y metas SMART
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva intervención
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título, etiqueta o contenido…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {contentTypes.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">{filteredCount} plantilla{filteredCount !== 1 ? "s" : ""}</p>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
                  {item.is_system && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">Sistema</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline">{item.category_label}</Badge>
                  <Badge variant="outline" className={contentTypeColors[item.content_type] || ""}>
                    {item.content_type_label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-sm text-muted-foreground line-clamp-4 flex-1 whitespace-pre-wrap">
                  {item.body}
                </p>
                {item.condition_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {item.condition_tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">#{tag}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-4 pt-3 border-t border-border/60">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => copyText(item.body)}>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {!item.is_system && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => {
                        setToDelete(item);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            No hay plantillas con esos filtros.
          </div>
        )}
      </div>
      </LoadingGate>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar intervención" : "Nueva intervención"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.content_type} onValueChange={(v) => setForm({ ...form, content_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {contentTypes.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Etiquetas (separadas por coma)</Label>
              <Input
                placeholder="dm2, adherencia, porciones"
                value={form.condition_tags}
                onChange={(e) => setForm({ ...form, condition_tags: e.target.value })}
              />
            </div>
            <div>
              <Label>Contenido</Label>
              <Textarea
                rows={8}
                placeholder="Usa {paciente} para insertar el nombre automáticamente"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar intervención?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará &quot;{toDelete?.title}&quot; permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
