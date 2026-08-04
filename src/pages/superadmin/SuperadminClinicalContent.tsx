import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import {
  BookOpen,
  ClipboardList,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Stethoscope,
  Target,
  ArrowRightLeft,
} from "lucide-react";

interface Overview {
  counts: {
    interventions: number;
    challenges: number;
    substitutions: number;
    prep_items: number;
    published_articles: number;
    articles_with_conditions: number;
  };
  conditions: { value: string; label: string }[];
  intervention_categories: { value: string; label: string }[];
  content_types: { value: string; label: string }[];
}

interface Intervention {
  id: number;
  title: string;
  category: string;
  content_type: string;
  condition_tags: string[];
  body: string;
  is_system: boolean;
}

interface Challenge {
  id: number;
  key: string;
  title: string;
  description: string;
  target: number;
  metric: string;
  points: number;
  icon: string;
  period: string;
  sort_order: number;
  is_active: boolean;
}

interface Substitution {
  id: number;
  ingredient_key: string;
  category: string;
  alternatives: { name: string; portion: string; reason: string }[];
  keywords: string[];
  sort_order: number;
  is_active: boolean;
}

interface PrepItem {
  id: number;
  key: string;
  label: string;
  auto_check_rule?: string;
  sort_order: number;
  is_active: boolean;
}

interface ClinicalArticle {
  id: number;
  title: string;
  category: string;
  is_published: boolean;
  clinical_conditions: string[];
  excerpt: string;
}

function authHeaders(json = false) {
  const h: Record<string, string> = {};
  const token = localStorage.getItem("userToken");
  if (token) h.Authorization = `Bearer ${token}`;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export default function SuperadminClinicalContent() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [prepItems, setPrepItems] = useState<PrepItem[]>([]);
  const [articles, setArticles] = useState<ClinicalArticle[]>([]);
  const [conditionFilter, setConditionFilter] = useState("all");

  const [editIntervention, setEditIntervention] = useState<Partial<Intervention> | null>(null);
  const [editChallenge, setEditChallenge] = useState<Partial<Challenge> | null>(null);
  const [editSubstitution, setEditSubstitution] = useState<Partial<Substitution> | null>(null);
  const [editPrep, setEditPrep] = useState<Partial<PrepItem> | null>(null);
  const [editArticleConds, setEditArticleConds] = useState<ClinicalArticle | null>(null);
  const [selectedConds, setSelectedConds] = useState<string[]>([]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [ov, int, ch, sub, prep, art] = await Promise.all([
        fetch(`${API_URL}/superadmin/clinical-content/overview`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/clinical-content/interventions`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/clinical-content/challenges`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/clinical-content/substitutions`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/clinical-content/prep-items`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/clinical-content/articles${conditionFilter !== "all" ? `?condition=${conditionFilter}` : ""}`, { headers: authHeaders() }),
      ]);
      if (ov.ok) setOverview(await ov.json());
      if (int.ok) setInterventions(await int.json());
      if (ch.ok) setChallenges(await ch.json());
      if (sub.ok) setSubstitutions(await sub.json());
      if (prep.ok) setPrepItems(await prep.json());
      if (art.ok) setArticles(await art.json());
    } catch {
      toast.error("Error cargando contenido clínico");
    } finally {
      setLoading(false);
    }
  }, [conditionFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const saveIntervention = async () => {
    if (!editIntervention?.title || !editIntervention.body) return;
    const isNew = !editIntervention.id;
    const url = isNew
      ? `${API_URL}/superadmin/clinical-content/interventions`
      : `${API_URL}/superadmin/clinical-content/interventions/${editIntervention.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PUT",
      headers: authHeaders(true),
      body: JSON.stringify({
        title: editIntervention.title,
        category: editIntervention.category || "general",
        content_type: editIntervention.content_type || "recommendation",
        condition_tags: editIntervention.condition_tags || [],
        body: editIntervention.body,
        is_system: true,
      }),
    });
    if (res.ok) {
      toast.success(isNew ? "Plantilla creada" : "Plantilla actualizada");
      setEditIntervention(null);
      loadAll();
    } else toast.error("Error al guardar");
  };

  const saveChallenge = async () => {
    if (!editChallenge?.key || !editChallenge.title) return;
    const isNew = !editChallenge.id;
    const url = isNew
      ? `${API_URL}/superadmin/clinical-content/challenges`
      : `${API_URL}/superadmin/clinical-content/challenges/${editChallenge.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PUT",
      headers: authHeaders(true),
      body: JSON.stringify(editChallenge),
    });
    if (res.ok) {
      toast.success(isNew ? "Reto creado" : "Reto actualizado");
      setEditChallenge(null);
      loadAll();
    } else toast.error("Error al guardar reto");
  };

  const saveSubstitution = async () => {
    if (!editSubstitution?.ingredient_key || !editSubstitution.category) return;
    const isNew = !editSubstitution.id;
    const url = isNew
      ? `${API_URL}/superadmin/clinical-content/substitutions`
      : `${API_URL}/superadmin/clinical-content/substitutions/${editSubstitution.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PUT",
      headers: authHeaders(true),
      body: JSON.stringify({
        ingredient_key: editSubstitution.ingredient_key,
        category: editSubstitution.category,
        alternatives: editSubstitution.alternatives || [],
        keywords: editSubstitution.keywords || [],
        sort_order: editSubstitution.sort_order || 0,
        is_active: editSubstitution.is_active !== false,
      }),
    });
    if (res.ok) {
      toast.success(isNew ? "Grupo creado" : "Grupo actualizado");
      setEditSubstitution(null);
      loadAll();
    } else toast.error("Error al guardar sustitución");
  };

  const savePrep = async () => {
    if (!editPrep?.key || !editPrep.label) return;
    const isNew = !editPrep.id;
    const url = isNew
      ? `${API_URL}/superadmin/clinical-content/prep-items`
      : `${API_URL}/superadmin/clinical-content/prep-items/${editPrep.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PUT",
      headers: authHeaders(true),
      body: JSON.stringify(editPrep),
    });
    if (res.ok) {
      toast.success(isNew ? "Ítem creado" : "Ítem actualizado");
      setEditPrep(null);
      loadAll();
    } else toast.error("Error al guardar ítem");
  };

  const saveArticleConditions = async () => {
    if (!editArticleConds) return;
    const res = await fetch(
      `${API_URL}/superadmin/clinical-content/articles/${editArticleConds.id}/conditions`,
      {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ clinical_conditions: selectedConds }),
      }
    );
    if (res.ok) {
      toast.success("Condiciones actualizadas");
      setEditArticleConds(null);
      loadAll();
    } else toast.error("Error al actualizar");
  };

  const deleteItem = async (type: string, id: number) => {
    if (!confirm("¿Eliminar este registro?")) return;
    const res = await fetch(`${API_URL}/superadmin/clinical-content/${type}/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      toast.success("Eliminado");
      loadAll();
    }
  };

  const toggleCond = (c: string) => {
    setSelectedConds((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Stethoscope className="h-7 w-7 text-primary" />
              Contenido clínico
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Plantillas, educación por condición, retos, sustituciones y prep cita
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/superadmin/articles">CMS Artículos</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {overview && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
            {[
              { label: "Intervenciones", v: overview.counts.interventions, icon: FileText },
              { label: "Retos F3", v: overview.counts.challenges, icon: Target },
              { label: "Sustituciones", v: overview.counts.substitutions, icon: ArrowRightLeft },
              { label: "Prep cita", v: overview.counts.prep_items, icon: ClipboardList },
              { label: "Artículos", v: overview.counts.published_articles, icon: BookOpen },
              { label: "Con condición", v: overview.counts.articles_with_conditions, icon: BookOpen },
            ].map(({ label, v, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <p className="text-2xl font-bold mt-1">{v}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="interventions">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="interventions">Intervenciones</TabsTrigger>
            <TabsTrigger value="articles">Artículos / condición</TabsTrigger>
            <TabsTrigger value="challenges">Retos Fase 3</TabsTrigger>
            <TabsTrigger value="substitutions">Sustituciones F4</TabsTrigger>
            <TabsTrigger value="prep">Prep cita</TabsTrigger>
          </TabsList>

          <TabsContent value="interventions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Plantillas de intervención del sistema</CardTitle>
                  <CardDescription>Biblioteca global para nutricionistas</CardDescription>
                </div>
                <Button size="sm" onClick={() => setEditIntervention({ category: "general", content_type: "recommendation", condition_tags: [] })}>
                  <Plus className="h-4 w-4 mr-1" /> Nueva
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interventions.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{r.title}</TableCell>
                        <TableCell><Badge variant="secondary">{r.category}</Badge></TableCell>
                        <TableCell className="text-sm">{r.content_type}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{(r.condition_tags || []).join(", ")}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditIntervention(r)}>Editar</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteItem("interventions", r.id)}>Eliminar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="articles">
            <Card>
              <CardHeader>
                <CardTitle>Artículos educativos por condición</CardTitle>
                <CardDescription>
                  Asigna condiciones clínicas a artículos del CMS.{" "}
                  <Link to="/superadmin/articles" className="text-primary underline">Editar contenido →</Link>
                </CardDescription>
                <Select value={conditionFilter} onValueChange={setConditionFilter}>
                  <SelectTrigger className="w-48 mt-2">
                    <SelectValue placeholder="Filtrar condición" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {(overview?.conditions || []).map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Categoría CMS</TableHead>
                      <TableHead>Condiciones</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {articles.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium max-w-[220px] truncate">{a.title}</TableCell>
                        <TableCell>{a.category}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(a.clinical_conditions || []).map((c) => (
                              <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                            ))}
                            {!a.clinical_conditions?.length && <span className="text-muted-foreground text-xs">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={a.is_published ? "bg-emerald-500/15 text-emerald-700 border-0" : ""}>
                            {a.is_published ? "Publicado" : "Borrador"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => { setEditArticleConds(a); setSelectedConds(a.clinical_conditions || []); }}>
                            Condiciones
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="challenges">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Retos predefinidos — Fase 3</CardTitle>
                  <CardDescription>Gamificación del panel paciente</CardDescription>
                </div>
                <Button size="sm" onClick={() => setEditChallenge({ period: "weekly", points: 10, target: 1, metric: "completed_meals_week", is_active: true })}>
                  <Plus className="h-4 w-4 mr-1" /> Nuevo reto
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Clave</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Meta</TableHead>
                      <TableHead>Puntos</TableHead>
                      <TableHead>Activo</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {challenges.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.key}</TableCell>
                        <TableCell>{c.title}</TableCell>
                        <TableCell className="text-sm">{c.target} ({c.metric})</TableCell>
                        <TableCell>{c.points}</TableCell>
                        <TableCell>{c.is_active ? "✓" : "—"}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditChallenge(c)}>Editar</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteItem("challenges", c.id)}>Eliminar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="substitutions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Reglas de sustitución — Fase 4</CardTitle>
                  <CardDescription>Grupos de intercambio nutricional</CardDescription>
                </div>
                <Button size="sm" onClick={() => setEditSubstitution({ alternatives: [], keywords: [], is_active: true })}>
                  <Plus className="h-4 w-4 mr-1" /> Nuevo grupo
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediente</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Alternativas</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {substitutions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.ingredient_key}</TableCell>
                        <TableCell>{s.category}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.alternatives?.length || 0} opciones</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditSubstitution(s)}>Editar</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteItem("substitutions", s.id)}>Eliminar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prep">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Checklist prep cita</CardTitle>
                  <CardDescription>Ítems mostrados antes de cada consulta</CardDescription>
                </div>
                <Button size="sm" onClick={() => setEditPrep({ is_active: true, sort_order: prepItems.length + 1 })}>
                  <Plus className="h-4 w-4 mr-1" /> Nuevo ítem
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orden</TableHead>
                      <TableHead>Clave</TableHead>
                      <TableHead>Etiqueta</TableHead>
                      <TableHead>Auto-check</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prepItems.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.sort_order}</TableCell>
                        <TableCell className="font-mono text-xs">{p.key}</TableCell>
                        <TableCell>{p.label}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.auto_check_rule || "manual"}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditPrep(p)}>Editar</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteItem("prep-items", p.id)}>Eliminar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Intervention dialog */}
      <Dialog open={!!editIntervention} onOpenChange={() => setEditIntervention(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editIntervention?.id ? "Editar" : "Nueva"} plantilla</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={editIntervention?.title || ""} onChange={(e) => setEditIntervention({ ...editIntervention!, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Categoría</Label>
                <Select value={editIntervention?.category || "general"} onValueChange={(v) => setEditIntervention({ ...editIntervention!, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(overview?.intervention_categories || []).map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={editIntervention?.content_type || "recommendation"} onValueChange={(v) => setEditIntervention({ ...editIntervention!, content_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(overview?.content_types || []).map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Cuerpo (use {"{paciente}"} para personalizar)</Label>
              <Textarea rows={6} value={editIntervention?.body || ""} onChange={(e) => setEditIntervention({ ...editIntervention!, body: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={saveIntervention}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Challenge dialog */}
      <Dialog open={!!editChallenge} onOpenChange={() => setEditChallenge(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editChallenge?.id ? "Editar" : "Nuevo"} reto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!editChallenge?.id && (
              <div><Label>Clave única</Label><Input value={editChallenge?.key || ""} onChange={(e) => setEditChallenge({ ...editChallenge!, key: e.target.value })} /></div>
            )}
            <div><Label>Título</Label><Input value={editChallenge?.title || ""} onChange={(e) => setEditChallenge({ ...editChallenge!, title: e.target.value })} /></div>
            <div><Label>Descripción</Label><Input value={editChallenge?.description || ""} onChange={(e) => setEditChallenge({ ...editChallenge!, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Meta</Label><Input type="number" value={editChallenge?.target ?? 1} onChange={(e) => setEditChallenge({ ...editChallenge!, target: +e.target.value })} /></div>
              <div><Label>Puntos</Label><Input type="number" value={editChallenge?.points ?? 10} onChange={(e) => setEditChallenge({ ...editChallenge!, points: +e.target.value })} /></div>
              <div><Label>Periodo</Label>
                <Select value={editChallenge?.period || "weekly"} onValueChange={(v) => setEditChallenge({ ...editChallenge!, period: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diario</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="rolling">Racha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Métrica (campo interno)</Label><Input value={editChallenge?.metric || ""} onChange={(e) => setEditChallenge({ ...editChallenge!, metric: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={editChallenge?.is_active !== false} onCheckedChange={(v) => setEditChallenge({ ...editChallenge!, is_active: v })} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={saveChallenge}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Substitution dialog */}
      <Dialog open={!!editSubstitution} onOpenChange={() => setEditSubstitution(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editSubstitution?.id ? "Editar" : "Nuevo"} grupo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!editSubstitution?.id && (
              <div><Label>Ingrediente clave</Label><Input value={editSubstitution?.ingredient_key || ""} onChange={(e) => setEditSubstitution({ ...editSubstitution!, ingredient_key: e.target.value })} /></div>
            )}
            <div><Label>Categoría</Label><Input value={editSubstitution?.category || ""} onChange={(e) => setEditSubstitution({ ...editSubstitution!, category: e.target.value })} /></div>
            <div><Label>Alternativas (JSON array)</Label>
              <Textarea rows={8} value={JSON.stringify(editSubstitution?.alternatives || [], null, 2)}
                onChange={(e) => { try { setEditSubstitution({ ...editSubstitution!, alternatives: JSON.parse(e.target.value) }); } catch { /* */ } }} />
            </div>
          </div>
          <DialogFooter><Button onClick={saveSubstitution}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prep dialog */}
      <Dialog open={!!editPrep} onOpenChange={() => setEditPrep(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editPrep?.id ? "Editar" : "Nuevo"} ítem prep</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!editPrep?.id && (
              <div><Label>Clave</Label><Input value={editPrep?.key || ""} onChange={(e) => setEditPrep({ ...editPrep!, key: e.target.value })} /></div>
            )}
            <div><Label>Etiqueta</Label><Input value={editPrep?.label || ""} onChange={(e) => setEditPrep({ ...editPrep!, label: e.target.value })} /></div>
            <div><Label>Regla auto-check</Label>
              <Select value={editPrep?.auto_check_rule || "none"} onValueChange={(v) => setEditPrep({ ...editPrep!, auto_check_rule: v === "none" ? undefined : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manual</SelectItem>
                  <SelectItem value="meals_3d">Comidas 3 días</SelectItem>
                  <SelectItem value="weight_7d">Peso 7 días</SelectItem>
                  <SelectItem value="active_plan">Plan activo</SelectItem>
                  <SelectItem value="confirmed_appt">Cita confirmada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Switch checked={editPrep?.is_active !== false} onCheckedChange={(v) => setEditPrep({ ...editPrep!, is_active: v })} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={savePrep}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Article conditions dialog */}
      <Dialog open={!!editArticleConds} onOpenChange={() => setEditArticleConds(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Condiciones clínicas</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">{editArticleConds?.title}</p>
          <div className="flex flex-wrap gap-2">
            {(overview?.conditions || []).map((c) => (
              <Badge
                key={c.value}
                variant={selectedConds.includes(c.value) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleCond(c.value)}
              >
                {c.label}
              </Badge>
            ))}
          </div>
          <DialogFooter><Button onClick={saveArticleConditions}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
