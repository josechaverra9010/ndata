import { useCallback, useEffect, useState } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import {
  Plug,
  MessageCircle,
  Calendar,
  Watch,
  Building2,
  Webhook,
  Loader2,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface CatalogItem {
  key: string;
  category: string;
  name: string;
  description: string;
  config_fields: { key: string; label: string; type: string; required?: boolean }[];
  connected: boolean;
  status: string;
  connection_id?: number;
  env_configured?: boolean;
}

interface WebhookRow {
  id: number;
  name: string;
  url: string;
  events: string[];
  is_enabled: boolean;
  has_secret: boolean;
}

interface Overview {
  catalog: CatalogItem[];
  webhook_events: Record<string, string>;
  stats: {
    connected_integrations: number;
    active_webhooks: number;
    deliveries_24h: number;
  };
}

const CATEGORY_ICONS: Record<string, typeof Plug> = {
  messaging: MessageCircle,
  calendar: Calendar,
  wearables: Watch,
  eps: Building2,
};

const CATEGORY_LABELS: Record<string, string> = {
  messaging: "Mensajería",
  calendar: "Calendario",
  wearables: "Wearables",
  eps: "EPS / APIs",
};

export default function SuperadminIntegrations() {
  const token = () => localStorage.getItem("userToken");
  const headers = (json = false) => ({
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
  });

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);

  const [configOpen, setConfigOpen] = useState(false);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const [configEnabled, setConfigEnabled] = useState(true);
  const [testing, setTesting] = useState(false);

  const [webhookOpen, setWebhookOpen] = useState(false);
  const [whForm, setWhForm] = useState({ name: "", url: "", events: [] as string[] });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ovRes, whRes] = await Promise.all([
        fetch(`${API_URL}/superadmin/integrations/overview`, { headers: headers() }),
        fetch(`${API_URL}/superadmin/integrations/webhooks`, { headers: headers() }),
      ]);
      if (ovRes.ok) setOverview(await ovRes.json());
      if (whRes.ok) {
        const d = await whRes.json();
        setWebhooks(d.webhooks || []);
      }
    } catch {
      toast.error("Error al cargar integraciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openConfig = (item: CatalogItem) => {
    setSelected(item);
    setConfigForm({});
    setConfigEnabled(true);
    setConfigOpen(true);
  };

  const saveConnection = async () => {
    if (!selected) return;
    const res = await fetch(`${API_URL}/superadmin/integrations/connections`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({
        integration_key: selected.key,
        config: configForm,
        is_enabled: configEnabled,
      }),
    });
    if (!res.ok) return toast.error("Error al guardar");
    const data = await res.json();
    toast.success("Integración configurada");
    setConfigOpen(false);
    load();
    if (data.connection?.id) {
      testConnection(data.connection.id);
    }
  };

  const testConnection = async (connectionId: number) => {
    setTesting(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/integrations/connections/${connectionId}/test`, {
        method: "POST",
        headers: headers(true),
      });
      const data = await res.json();
      if (data.success) toast.success(data.message || "Conexión OK");
      else toast.error(data.message || "Error de conexión");
      load();
    } finally {
      setTesting(false);
    }
  };

  const createWebhook = async () => {
    if (!whForm.name || !whForm.url || whForm.events.length === 0) {
      return toast.error("Completa nombre, URL y eventos");
    }
    const res = await fetch(`${API_URL}/superadmin/integrations/webhooks`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify(whForm),
    });
    if (!res.ok) return toast.error("Error al crear webhook");
    const data = await res.json();
    toast.success(`Webhook creado. Secret: ${data.secret?.slice(0, 12)}…`);
    setWebhookOpen(false);
    setWhForm({ name: "", url: "", events: [] });
    load();
  };

  const testWebhook = async (id: number) => {
    const res = await fetch(`${API_URL}/superadmin/integrations/webhooks/${id}/test`, {
      method: "POST",
      headers: headers(true),
    });
    const data = await res.json();
    if (data.success) toast.success("Evento de prueba entregado");
    else toast.error("Falló entrega de prueba");
  };

  const toggleWebhook = async (id: number, enabled: boolean) => {
    await fetch(`${API_URL}/superadmin/integrations/webhooks/${id}`, {
      method: "PATCH",
      headers: headers(true),
      body: JSON.stringify({ is_enabled: enabled }),
    });
    load();
  };

  const deleteWebhook = async (id: number) => {
    if (!confirm("¿Eliminar webhook?")) return;
    await fetch(`${API_URL}/superadmin/integrations/webhooks/${id}`, {
      method: "DELETE",
      headers: headers(),
    });
    toast.success("Webhook eliminado");
    load();
  };

  const toggleEvent = (ev: string) => {
    setWhForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
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
  const byCategory = ov.catalog.reduce<Record<string, CatalogItem[]>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Plug className="h-8 w-8 text-primary" />
              Marketplace de integraciones
            </h1>
            <p className="text-muted-foreground">
              WhatsApp, calendarios, wearables, EPS y webhooks salientes
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Zap className="h-8 w-8 text-primary/70" />
              <div>
                <p className="text-xs text-muted-foreground">Integraciones activas</p>
                <p className="text-2xl font-bold">{ov.stats.connected_integrations}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Webhook className="h-8 w-8 text-primary/70" />
              <div>
                <p className="text-xs text-muted-foreground">Webhooks salientes</p>
                <p className="text-2xl font-bold">{ov.stats.active_webhooks}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-primary/70" />
              <div>
                <p className="text-xs text-muted-foreground">Entregas 24h</p>
                <p className="text-2xl font-bold">{ov.stats.deliveries_24h}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="marketplace" className="space-y-4">
          <TabsList>
            <TabsTrigger value="marketplace">Catálogo</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks salientes</TabsTrigger>
          </TabsList>

          <TabsContent value="marketplace" className="space-y-6">
            {Object.entries(byCategory).map(([cat, items]) => {
              const Icon = CATEGORY_ICONS[cat] || Plug;
              return (
                <div key={cat}>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                    <Icon className="h-4 w-4" /> {CATEGORY_LABELS[cat] || cat}
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                      <Card key={item.key} className="flex flex-col">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base">{item.name}</CardTitle>
                            {item.status === "connected" || item.connected ? (
                              <Badge className="gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Conectado
                              </Badge>
                            ) : item.status === "env" ? (
                              <Badge variant="secondary">Env .env</Badge>
                            ) : (
                              <Badge variant="outline">Desconectado</Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs">{item.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="mt-auto pt-0 flex gap-2">
                          <Button size="sm" className="flex-1" onClick={() => openConfig(item)}>
                            Configurar
                          </Button>
                          {item.connection_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={testing}
                              onClick={() => testConnection(item.connection_id!)}
                            >
                              Probar
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Eventos: paciente nuevo, cita, recordatorio, adherencia baja
              </p>
              <Button className="gap-2" onClick={() => setWebhookOpen(true)}>
                <Webhook className="h-4 w-4" /> Nuevo webhook
              </Button>
            </div>
            {webhooks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Sin webhooks — crea uno para recibir eventos en tu sistema externo
                </CardContent>
              </Card>
            ) : (
              webhooks.map((w) => (
                <Card key={w.id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{w.name}</p>
                        <p className="text-xs font-mono text-muted-foreground truncate max-w-md">{w.url}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {w.events.map((e) => (
                            <Badge key={e} variant="outline" className="text-[10px]">
                              {ov.webhook_events[e] || e}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={w.is_enabled} onCheckedChange={(v) => toggleWebhook(w.id, v)} />
                        <Button size="sm" variant="outline" onClick={() => testWebhook(w.id)}>
                          Probar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteWebhook(w.id)}>
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {selected?.config_fields.map((f) => (
              <div key={f.key}>
                <Label>{f.label}{f.required ? " *" : ""}</Label>
                <Input
                  type={f.type === "secret" ? "password" : "text"}
                  placeholder={f.type === "secret" ? "••••••••" : ""}
                  value={configForm[f.key] || ""}
                  onChange={(e) => setConfigForm({ ...configForm, [f.key]: e.target.value })}
                />
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <Label>Habilitada</Label>
              <Switch checked={configEnabled} onCheckedChange={setConfigEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveConnection}>Guardar conexión</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={webhookOpen} onOpenChange={setWebhookOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo webhook saliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nombre (ej. CRM externo)"
              value={whForm.name}
              onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
            />
            <Input
              placeholder="https://tu-sistema.com/webhooks/nutridata"
              value={whForm.url}
              onChange={(e) => setWhForm({ ...whForm, url: e.target.value })}
            />
            <div className="space-y-2">
              <Label>Eventos</Label>
              {Object.entries(ov.webhook_events).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    checked={whForm.events.includes(key)}
                    onCheckedChange={() => toggleEvent(key)}
                  />
                  <span className="text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground font-mono">{key}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createWebhook}>Crear webhook</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
