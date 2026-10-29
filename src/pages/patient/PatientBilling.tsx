import { useCallback, useEffect, useState } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import { Check, CreditCard, Loader2, Receipt, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Plan {
  id: number;
  code: string;
  name: string;
  price_monthly_cop: number;
  price_yearly_cop?: number | null;
  features: string[];
  sort_order: number;
}

interface Subscription {
  id: number;
  status: string;
  plan_code: string;
  plan_name: string;
  billing_cycle: string;
  payment_provider: string;
  current_period_end?: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  amount_cop: number;
  status: string;
  due_date: string;
}

const FEATURE_LABELS: Record<string, string> = {
  dashboard: "Dashboard del día",
  meals: "Mis comidas del menú",
  my_plan: "Plan nutricional completo",
  ai_meal_suggestions: "2 sugerencias de comida con IA",
  adherence: "Seguimiento de adherencia",
  progress: "Fotos y progreso",
  appointments: "Citas con nutricionista",
  recipes: "Biblioteca de recetas",
  notifications: "Notificaciones",
  program: "Mi programa",
  messages: "Mensajes con nutricionista",
  food_diary: "Diario fotográfico",
  profile: "Perfil",
  help: "Ayuda",
  settings: "Configuración",
  billing: "Suscripción",
  patient_phase_1: "Seguimiento avanzado",
  patient_phase_4: "Diario avanzado",
};

/** Orden de beneficios en tarjetas de plan (más claros para el paciente). */
const FEATURE_ORDER = [
  "dashboard",
  "ai_meal_suggestions",
  "meals",
  "my_plan",
  "progress",
  "notifications",
  "adherence",
  "program",
  "appointments",
  "recipes",
  "messages",
  "food_diary",
];

function formatCop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

function authHeaders() {
  return {
    ...(localStorage.getItem("userToken")
      ? { Authorization: `Bearer ${localStorage.getItem("userToken")}` }
      : {}),
  };
}

export default function PatientBilling() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [meRes, plansRes] = await Promise.all([
        fetch(`${API_URL}/patient/billing/me`, { headers: authHeaders() }),
        fetch(`${API_URL}/patient/billing/plans`, { headers: authHeaders() }),
      ]);
      const me = await meRes.json();
      const plansData = await plansRes.json();
      if (!meRes.ok) throw new Error(me.detail || "Error al cargar suscripción");
      if (plansRes.ok && Array.isArray(plansData)) setPlans(plansData);
      setPlan(me.plan || null);
      setSubscription(me.subscription || null);
      setInvoices(me.invoices || []);
      setTrialDaysLeft(me.trial_days_left ?? null);
      setMessage(me.message || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al cargar facturación");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const subscribe = async (planCode: string) => {
    try {
      setBusyCode(planCode);
      const res = await fetch(`${API_URL}/patient/billing/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          plan_code: planCode,
          billing_cycle: cycle,
          provider: "wompi",
          return_url: `${window.location.origin}/patient/billing`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail;
        throw new Error(typeof detail === "string" ? detail : detail?.message || "No se pudo suscribir");
      }
      const checkoutUrl = data.checkout?.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      toast.info(data.checkout?.message || "Suscripción creada. Si el pago no abre, contacta soporte.");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al suscribirse");
    } finally {
      setBusyCode(null);
    }
  };

  const payInvoice = async (inv: Invoice) => {
    try {
      setBusyCode(`inv-${inv.id}`);
      const res = await fetch(`${API_URL}/patient/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          invoice_id: inv.id,
          provider: "wompi",
          return_url: `${window.location.origin}/patient/billing`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al pagar");
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.info(data.message || "Pago manual: un administrador puede marcar la factura como pagada");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al pagar");
    } finally {
      setBusyCode(null);
    }
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PatientLayout>
    );
  }

  const currentCode = subscription?.plan_code || plan?.code || "patient_free";

  return (
    <PatientLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Suscripción</h1>
          <p className="text-sm text-muted-foreground">
            Elige tu plan y desbloquea módulos del panel. Pagos con Wompi (Colombia).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plan actual: {plan?.name || "Gratis"}
            </CardTitle>
            <CardDescription>{message || "Estado de tu suscripción NutriData"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {subscription && <Badge>{subscription.status}</Badge>}
            {subscription?.billing_cycle && <Badge variant="outline">{subscription.billing_cycle}</Badge>}
            {trialDaysLeft != null && subscription?.status === "trialing" && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                Trial: {trialDaysLeft} día{trialDaysLeft === 1 ? "" : "s"} restantes
              </Badge>
            )}
            {subscription?.current_period_end && (
              <span className="text-xs text-muted-foreground">
                Periodo hasta {subscription.current_period_end}
              </span>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium">Facturación</p>
          <div className="inline-flex rounded-lg border p-1">
            <Button
              size="sm"
              variant={cycle === "monthly" ? "default" : "ghost"}
              onClick={() => setCycle("monthly")}
            >
              Mensual
            </Button>
            <Button
              size="sm"
              variant={cycle === "yearly" ? "default" : "ghost"}
              onClick={() => setCycle("yearly")}
            >
              Anual
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const price =
              cycle === "yearly" && p.price_yearly_cop
                ? p.price_yearly_cop
                : p.price_monthly_cop;
            const isCurrent = p.code === currentCode && subscription?.status !== "past_due";
            const isPaid = p.code === "patient_essential" || p.code === "patient_plus";
            const highlight = p.code === "patient_plus";
            const visibleFeatures = (p.features || [])
              .filter(
                (f) => FEATURE_LABELS[f] && !["profile", "help", "settings", "billing", "patient_phase_1", "patient_phase_4", "pwa_offline"].includes(f)
              )
              .sort((a, b) => {
                const ia = FEATURE_ORDER.indexOf(a);
                const ib = FEATURE_ORDER.indexOf(b);
                return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
              });
            return (
              <Card
                key={p.id}
                className={cn(
                  "relative flex flex-col",
                  highlight && "border-primary shadow-md",
                  isCurrent && "ring-2 ring-primary/40"
                )}
              >
                {highlight && (
                  <Badge className="absolute -top-2 right-3">Recomendado</Badge>
                )}
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                  <CardDescription>
                    {price === 0 ? (
                      <span className="text-2xl font-bold text-foreground">Gratis</span>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-foreground">{formatCop(price)}</span>
                        <span className="text-muted-foreground">
                          /{cycle === "yearly" ? "año" : "mes"}
                        </span>
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <ul className="space-y-2 text-sm flex-1">
                    {visibleFeatures.slice(0, 10).map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{FEATURE_LABELS[f] || f}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button disabled variant="secondary" className="w-full">
                      Plan actual
                    </Button>
                  ) : isPaid ? (
                    <Button
                      className="w-full"
                      disabled={busyCode === p.code}
                      onClick={() => subscribe(p.code)}
                    >
                      {busyCode === p.code ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Mejorar plan"
                      )}
                    </Button>
                  ) : (
                    <Button disabled variant="outline" className="w-full">
                      Incluido
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> Facturas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoices.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no tienes facturas.</p>
            )}
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border"
              >
                <div>
                  <p className="font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">Vence: {inv.due_date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatCop(inv.amount_cop)}</span>
                  <Badge variant={inv.status === "paid" ? "default" : "secondary"}>
                    {inv.status}
                  </Badge>
                  {inv.status !== "paid" && (
                    <Button
                      size="sm"
                      disabled={busyCode === `inv-${inv.id}`}
                      onClick={() => payInvoice(inv)}
                    >
                      Pagar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PatientLayout>
  );
}
