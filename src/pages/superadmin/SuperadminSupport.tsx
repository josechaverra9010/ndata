import { useCallback, useEffect, useState } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import { formatDateTimeInColombia } from "@/lib/timezone";
import {
  LifeBuoy,
  AlertTriangle,
  Clock,
  UserPlus,
  ArrowUpCircle,
  MessageSquare,
  Loader2,
  RefreshCw,
  FileText,
} from "lucide-react";

interface Agent {
  id: number;
  name: string;
  role: string;
}

interface Macro {
  id: number;
  title: string;
  body: string;
  category: string;
}

interface Ticket {
  id: number;
  patient_name: string;
  patient_email: string;
  nutritionist_name?: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  priority_label: string;
  category: string;
  admin_response?: string;
  assigned_agent_id?: number;
  assigned_agent_name?: string;
  escalated: boolean;
  ticket_level: string;
  sla_due_at?: string;
  sla: { state: string; label: string; breached: boolean };
  created_at: string;
}

interface Overview {
  stats: {
    open_total: number;
    sla_breached: number;
    escalated: number;
    unassigned: number;
  };
  sla_hours: Record<string, number>;
  agents: Agent[];
}

export default function SuperadminSupport() {
  const token = () => localStorage.getItem("userToken");
  const headers = (json = false) => ({
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
  });

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const [selected, setSelected] = useState<Ticket | null>(null);
  const [response, setResponse] = useState("");
  const [assignAgent, setAssignAgent] = useState<string>("");
  const [macroOpen, setMacroOpen] = useState(false);
  const [macroEdit, setMacroEdit] = useState<Macro | null>(null);
  const [macroForm, setMacroForm] = useState({ title: "", body: "", category: "general" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      let url = `${API_URL}/superadmin/support/tickets?limit=100`;
      if (filterStatus !== "all") url += `&status=${filterStatus}`;
      if (filterPriority !== "all") url += `&priority=${filterPriority}`;
      const [ovRes, tRes, mRes] = await Promise.all([
        fetch(`${API_URL}/superadmin/support/overview`, { headers: headers() }),
        fetch(url, { headers: headers() }),
        fetch(`${API_URL}/superadmin/support/macros`, { headers: headers() }),
      ]);
      if (ovRes.ok) setOverview(await ovRes.json());
      if (tRes.ok) {
        const d = await tRes.json();
        setTickets(d.tickets || []);
      }
      if (mRes.ok) {
        const d = await mRes.json();
        setMacros(d.macros || []);
      }
    } catch {
      toast.error("Error al cargar soporte");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority]);

  useEffect(() => {
    load();
  }, [load]);

  const assignTicket = async (ticketId: number, agentId: string) => {
    const res = await fetch(`${API_URL}/superadmin/support/tickets/${ticketId}/assign`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ assigned_agent_id: agentId ? parseInt(agentId, 10) : null }),
    });
    if (!res.ok) return toast.error("Error al asignar");
    toast.success("Agente asignado");
    load();
  };

  const escalate = async (ticketId: number) => {
    const res = await fetch(`${API_URL}/superadmin/support/tickets/${ticketId}/escalate`, {
      method: "POST",
      headers: headers(true),
    });
    if (!res.ok) return toast.error("Error al escalar");
    toast.success("Ticket escalado a L2 (superadmin)");
    load();
  };

  const sendResponse = async () => {
    if (!selected || !response.trim()) return;
    const res = await fetch(`${API_URL}/superadmin/support/tickets/${selected.id}/respond`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ admin_response: response, status: "in_progress" }),
    });
    if (!res.ok) return toast.error("Error al responder");
    toast.success("Respuesta enviada");
    setSelected(null);
    setResponse("");
    load();
  };

  const insertMacro = (macro: Macro) => {
    setResponse((r) => (r ? `${r}\n\n${macro.body}` : macro.body));
  };

  const saveMacro = async () => {
    if (!macroForm.title.trim() || !macroForm.body.trim()) {
      toast.error("Título y cuerpo son requeridos");
      return;
    }
    const url = macroEdit
      ? `${API_URL}/superadmin/support/macros/${macroEdit.id}`
      : `${API_URL}/superadmin/support/macros`;
    const res = await fetch(url, {
      method: macroEdit ? "PUT" : "POST",
      headers: headers(true),
      body: JSON.stringify({ ...macroForm, is_active: true }),
    });
    if (!res.ok) return toast.error("Error al guardar macro");
    toast.success(macroEdit ? "Macro actualizada" : "Macro creada");
    setMacroOpen(false);
    setMacroEdit(null);
    setMacroForm({ title: "", body: "", category: "general" });
    load();
  };

  const deleteMacro = async (id: number) => {
    if (!confirm("¿Eliminar esta macro?")) return;
    const res = await fetch(`${API_URL}/superadmin/support/macros/${id}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) return toast.error("Error al eliminar");
    toast.success("Macro eliminada");
    load();
  };

  const openMacroEditor = (m?: Macro) => {
    if (m) {
      setMacroEdit(m);
      setMacroForm({ title: m.title, body: m.body, category: m.category || "general" });
    } else {
      setMacroEdit(null);
      setMacroForm({ title: "", body: "", category: "general" });
    }
    setMacroOpen(true);
  };

  const resolveTicket = async (id: number) => {
    await fetch(`${API_URL}/superadmin/support/tickets/${id}`, {
      method: "PATCH",
      headers: headers(true),
      body: JSON.stringify({ status: "resolved" }),
    });
    toast.success("Ticket resuelto");
    load();
  };

  const slaBadge = (t: Ticket) => {
    if (t.sla.breached)
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" /> SLA
        </Badge>
      );
    if (t.sla.state === "warning")
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" /> {t.sla.label}
        </Badge>
      );
    return null;
  };

  if (loading && !overview) {
    return (
      <SuperadminLayout>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SuperadminLayout>
    );
  }

  const ov = overview!;

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <LifeBuoy className="h-8 w-8 text-primary" />
              Soporte nivel 2
            </h1>
            <p className="text-muted-foreground">Cola global, SLA, agentes, macros y escalamiento</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Abiertos / en progreso</p>
              <p className="text-2xl font-bold">{ov.stats.open_total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">SLA vencido</p>
              <p className="text-2xl font-bold text-destructive">{ov.stats.sla_breached}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Sin asignar</p>
              <p className="text-2xl font-bold">{ov.stats.unassigned}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Escalados L3</p>
              <p className="text-2xl font-bold">{ov.stats.escalated}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">SLA primera respuesta (horas)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(ov.sla_hours).map(([k, h]) => (
              <Badge key={k} variant="outline">
                {k}: {h}h
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Tabs defaultValue="queue" className="space-y-4">
          <TabsList>
            <TabsTrigger value="queue">Cola global</TabsTrigger>
            <TabsTrigger value="macros">Macros</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abierto</SelectItem>
                  <SelectItem value="in_progress">En progreso</SelectItem>
                  <SelectItem value="resolved">Resuelto</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tickets.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No hay tickets en la cola
                </CardContent>
              </Card>
            ) : (
              tickets.map((t) => (
                <Card key={t.id} className={t.sla.breached ? "border-destructive/50" : ""}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">#{t.id}</span>
                          <span>{t.subject}</span>
                          <Badge variant="outline">{t.priority_label}</Badge>
                          <Badge>{t.status}</Badge>
                          <Badge variant="secondary">{t.ticket_level}</Badge>
                          {t.escalated && <Badge variant="destructive">Escalado</Badge>}
                          {slaBadge(t)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t.patient_name} · {t.patient_email}
                          {t.nutritionist_name && ` · Nutri: ${t.nutritionist_name}`}
                        </p>
                        <p className="text-sm line-clamp-2">{t.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTimeInColombia(t.created_at)}
                          {t.assigned_agent_name && ` · Agente: ${t.assigned_agent_name}`}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        <Select
                          value={t.assigned_agent_id ? String(t.assigned_agent_id) : ""}
                          onValueChange={(v) => assignTicket(t.id, v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Asignar agente" />
                          </SelectTrigger>
                          <SelectContent>
                            {ov.agents.map((a) => (
                              <SelectItem key={a.id} value={String(a.id)}>
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelected(t)}>
                          <MessageSquare className="h-3.5 w-3.5" /> Responder
                        </Button>
                        {!t.escalated && (
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => escalate(t.id)}>
                            <ArrowUpCircle className="h-3.5 w-3.5" /> Escalar L2
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => resolveTicket(t.id)}>
                          Marcar resuelto
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="macros">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => openMacroEditor()}>Nueva macro</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {macros.map((m) => (
                <Card key={m.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4" /> {m.title}
                      </span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openMacroEditor(m)}>Editar</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMacro(m.id)}>Eliminar</Button>
                      </div>
                    </CardTitle>
                    <CardDescription>{m.category}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{m.body}</pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Responder ticket #{selected?.id}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium">{selected.subject}</p>
                <p className="text-muted-foreground mt-1">{selected.message}</p>
              </div>
              <div>
                <Label>Macros rápidas</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {macros.slice(0, 5).map((m) => (
                    <Button key={m.id} size="sm" variant="outline" onClick={() => insertMacro(m)}>
                      {m.title}
                    </Button>
                  ))}
                </div>
              </div>
              <Textarea rows={6} value={response} onChange={(e) => setResponse(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button onClick={sendResponse}>Enviar respuesta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={macroOpen} onOpenChange={setMacroOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{macroEdit ? "Editar macro" : "Nueva macro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={macroForm.title} onChange={(e) => setMacroForm({ ...macroForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Categoría</Label>
              <Input value={macroForm.category} onChange={(e) => setMacroForm({ ...macroForm, category: e.target.value })} />
            </div>
            <div>
              <Label>Cuerpo</Label>
              <Textarea rows={6} value={macroForm.body} onChange={(e) => setMacroForm({ ...macroForm, body: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMacroOpen(false)}>Cancelar</Button>
            <Button onClick={saveMacro}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
