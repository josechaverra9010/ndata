import { useEffect, useState, useCallback } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Receipt,
  Download,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
  Plus,
  FileText,
  Users,
  Building2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--chart-3))", "hsl(var(--muted-foreground))"];

function formatCop(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

interface Overview {
  mrr_cop: number;
  arr_cop: number;
  active_subscriptions: number;
  churn_rate_pct: number;
  ltv_cop: number;
  arpa_cop: number;
  overdue_invoices: number;
  delinquent_subscriptions: number;
  monthly_revenue_chart: { name: string; ingresos: number }[];
  plan_distribution: { name: string; value: number }[];
  recent_invoices: Invoice[];
}

interface Plan {
  id: number;
  code: string;
  name: string;
  billing_unit: string;
  price_monthly_cop: number;
  max_patients: number;
  max_nutritionists: number;
}

interface Subscription {
  id: number;
  plan_name: string;
  subscriber_name: string;
  subscriber_type: string;
  status: string;
  payment_provider: string;
  mrr_cop: number;
  billing_cycle: string;
  usage?: { patients: number; nutritionists: number };
  limits?: { max_patients: number; max_nutritionists: number };
}

interface Invoice {
  id: number;
  subscription_id: number;
  invoice_number: string;
  subscriber_name: string;
  plan_name: string;
  amount_cop: number;
  status: string;
  due_date: string;
  created_at: string;
}

interface OrgOption {
  id: number;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 border-0",
  trialing: "bg-sky-500/15 text-sky-700 border-0",
  past_due: "bg-amber-500/15 text-amber-700 border-0",
  blocked: "bg-red-500/15 text-red-700 border-0",
  cancelled: "bg-muted text-muted-foreground border-0",
  paid: "bg-emerald-500/15 text-emerald-700 border-0",
  pending: "bg-amber-500/15 text-amber-700 border-0",
  overdue: "bg-red-500/15 text-red-700 border-0",
  failed: "bg-red-500/15 text-red-700 border-0",
};

export default function SuperadminBilling() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [delinquents, setDelinquents] = useState<{ invoices: Invoice[]; subscriptions: Subscription[] } | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [subDialog, setSubDialog] = useState(false);
  const [newSub, setNewSub] = useState({
    plan_id: "",
    subscriber_type: "organization",
    subscriber_id: "",
    payment_provider: "manual",
    billing_cycle: "monthly",
  });

  const authHeaders = () => ({
    ...(localStorage.getItem("userToken") ? { Authorization: `Bearer ${localStorage.getItem("userToken")}` } : {}),
  });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [ovRes, plansRes, subsRes, invRes, delRes, orgsRes] = await Promise.all([
        fetch(`${API_URL}/superadmin/billing/overview`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/billing/plans`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/billing/subscriptions`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/billing/invoices`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/billing/delinquents`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/organizations`, { headers: authHeaders() }),
      ]);
      if (ovRes.ok) setOverview(await ovRes.json());
      if (plansRes.ok) setPlans(await plansRes.json());
      if (subsRes.ok) setSubscriptions(await subsRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
      if (delRes.ok) setDelinquents(await delRes.json());
      if (orgsRes.ok) {
        const o = await orgsRes.json();
        setOrgs(Array.isArray(o) ? o.map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })) : []);
      }
    } catch {
      toast.error("Error al cargar facturación");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createSubscription = async () => {
    if (!newSub.plan_id || !newSub.subscriber_id) {
      toast.error("Completa plan y suscriptor");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/superadmin/billing/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          plan_id: parseInt(newSub.plan_id, 10),
          subscriber_type: newSub.subscriber_type,
          subscriber_id: parseInt(newSub.subscriber_id, 10),
          payment_provider: newSub.payment_provider,
          billing_cycle: newSub.billing_cycle,
          status: "active",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Suscripción creada");
      setSubDialog(false);
      loadAll();
    } catch {
      toast.error("Error al crear suscripción");
    }
  };

  const markPaid = async (invoiceId: number) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/billing/invoices/${invoiceId}/pay`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      toast.success("Factura marcada como pagada");
      loadAll();
    } catch {
      toast.error("Error al actualizar factura");
    }
  };

  const downloadPdf = async (invoiceId: number, number: string) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/billing/invoices/${invoiceId}/pdf`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error al descargar PDF");
    }
  };

  const createInvoice = async (subscriptionId: number) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/billing/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ subscription_id: subscriptionId, status: "pending" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Factura generada");
      loadAll();
    } catch {
      toast.error("Error al generar factura");
    }
  };

  const checkoutOnline = async (inv: Invoice, provider = "wompi") => {
    try {
      const res = await fetch(`${API_URL}/superadmin/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          subscription_id: inv.subscription_id,
          invoice_id: inv.id,
          provider,
          return_url: `${window.location.origin}/superadmin/billing`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || "Error checkout");
      if (data.checkout_url) {
        window.open(data.checkout_url, "_blank");
        toast.success("Abriendo checkout Wompi…");
      } else {
        toast.info(data.message || "Modo facturación manual — marque la factura como pagada");
      }
      loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al iniciar pago");
    }
  };

  const updateSubStatus = async (subId: number, status: string) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/billing/subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success("Estado actualizado");
      loadAll();
    } catch {
      toast.error("Error al actualizar");
    }
  };

  if (loading) {
    return (
      <SuperadminLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </SuperadminLayout>
    );
  }

  const chartData = overview?.monthly_revenue_chart || [];
  const pieData = overview?.plan_distribution || [];

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Facturación y suscripciones</h1>
            <p className="text-muted-foreground">Planes, pagos (Stripe / PayU / Wompi), facturas y revenue</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadAll}>
              Actualizar
            </Button>
            <Button className="gap-2" onClick={() => setSubDialog(true)}>
              <Plus className="h-4 w-4" /> Nueva suscripción
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> MRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{formatCop(overview?.mrr_cop || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">ARR</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{formatCop(overview?.arr_cop || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{overview?.active_subscriptions || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Churn</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{overview?.churn_rate_pct || 0}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">LTV est.</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{formatCop(overview?.ltv_cop || 0)}</p>
            </CardContent>
          </Card>
        </div>

        {(overview?.delinquent_subscriptions || 0) > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm">
                <strong>{overview?.delinquent_subscriptions}</strong> suscripción(es) en mora ·{" "}
                <strong>{overview?.overdue_invoices}</strong> factura(s) pendientes/vencidas
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="overview">Revenue</TabsTrigger>
            <TabsTrigger value="plans">Planes</TabsTrigger>
            <TabsTrigger value="subscriptions">Suscripciones</TabsTrigger>
            <TabsTrigger value="invoices">Facturas</TabsTrigger>
            <TabsTrigger value="delinquents">Morosos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Ingresos mensuales (COP)</CardTitle>
                </CardHeader>
                <CardContent className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCop(v)} />
                      <Area type="monotone" dataKey="ingresos" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Distribución de planes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={70}>
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 mt-2">
                    {pieData.map((p, i) => (
                      <div key={p.name} className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {p.name}
                        </span>
                        <span className="tabular-nums">{p.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="plans">
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((p) => (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {p.name}
                      <Badge variant="secondary">{p.code}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-2xl font-bold">{formatCop(p.price_monthly_cop)}<span className="text-xs font-normal text-muted-foreground">/mes</span></p>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      {p.billing_unit === "organization" ? <Building2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                      Por {p.billing_unit === "organization" ? "organización" : "nutricionista"}
                    </p>
                    <p>Hasta {p.max_patients} pacientes · {p.max_nutritionists} nutricionista(s)</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="subscriptions">
            <div className="space-y-3">
              {subscriptions.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold">{s.subscriber_name}</p>
                        <Badge className={STATUS_COLORS[s.status] || ""}>{s.status}</Badge>
                        <Badge variant="outline">{s.payment_provider}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {s.plan_name} · {s.billing_cycle} · MRR {formatCop(s.mrr_cop)}
                      </p>
                      {s.usage && s.limits && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Uso: {s.usage.patients}/{s.limits.max_patients} pac · {s.usage.nutritionists}/{s.limits.max_nutritionists} nutri
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => createInvoice(s.id)}>
                        <Receipt className="h-3.5 w-3.5 mr-1" /> Facturar
                      </Button>
                      {s.status === "past_due" && (
                        <Button size="sm" onClick={() => updateSubStatus(s.id, "active")}>Reactivar</Button>
                      )}
                      {s.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => updateSubStatus(s.id, "past_due")}>Marcar mora</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {subscriptions.length === 0 && (
                <p className="text-center text-muted-foreground py-12">Sin suscripciones — crea una desde el botón superior</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="invoices">
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border">
                  <div>
                    <p className="font-medium">{inv.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">{inv.subscriber_name} · {inv.plan_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold tabular-nums">{formatCop(inv.amount_cop)}</span>
                    <Badge className={STATUS_COLORS[inv.status] || ""}>{inv.status}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => downloadPdf(inv.id, inv.invoice_number)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                    {inv.status !== "paid" && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => checkoutOnline(inv)}>
                          <CreditCard className="h-3.5 w-3.5 mr-1" /> Pagar (Wompi)
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => markPaid(inv.id)}>Pagada</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="delinquents">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" /> Facturas morosas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(delinquents?.invoices || []).map((inv) => (
                    <div key={inv.id} className="flex justify-between items-center p-3 rounded-lg bg-muted/40 text-sm">
                      <span>{inv.subscriber_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCop(inv.amount_cop)}</span>
                        <Button size="sm" variant="outline" onClick={() => markPaid(inv.id)}>Cobrar</Button>
                        <Button size="sm" variant="secondary" onClick={() => checkoutOnline(inv)}>Wompi</Button>
                      </div>
                    </div>
                  ))}
                  {!delinquents?.invoices?.length && <p className="text-muted-foreground text-sm">Sin morosos en facturas</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Suscripciones suspendidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(delinquents?.subscriptions || []).map((s) => (
                    <div key={s.id} className="flex justify-between items-center p-3 rounded-lg bg-muted/40 text-sm">
                      <span>{s.subscriber_name}</span>
                      <Button size="sm" onClick={() => updateSubStatus(s.id, "active")}>Reactivar</Button>
                    </div>
                  ))}
                  {!delinquents?.subscriptions?.length && <p className="text-muted-foreground text-sm">Sin suscripciones en mora</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={subDialog} onOpenChange={setSubDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva suscripción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={newSub.plan_id} onValueChange={(v) => setNewSub({ ...newSub, plan_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name} — {formatCop(p.price_monthly_cop)}/mes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de suscriptor</Label>
              <Select value={newSub.subscriber_type} onValueChange={(v) => setNewSub({ ...newSub, subscriber_type: v, subscriber_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">Organización (EPS)</SelectItem>
                  <SelectItem value="nutritionist">Nutricionista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newSub.subscriber_type === "organization" && (
              <div className="space-y-2">
                <Label>Organización</Label>
                <Select value={newSub.subscriber_id} onValueChange={(v) => setNewSub({ ...newSub, subscriber_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar org" /></SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newSub.subscriber_type === "nutritionist" && (
              <div className="space-y-2">
                <Label>ID nutricionista (user id)</Label>
                <Input value={newSub.subscriber_id} onChange={(e) => setNewSub({ ...newSub, subscriber_id: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Select value={newSub.payment_provider} onValueChange={(v) => setNewSub({ ...newSub, payment_provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="wompi">Wompi</SelectItem>
                    <SelectItem value="payu">PayU</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ciclo</Label>
                <Select value={newSub.billing_cycle} onValueChange={(v) => setNewSub({ ...newSub, billing_cycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDialog(false)}>Cancelar</Button>
            <Button onClick={createSubscription}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
