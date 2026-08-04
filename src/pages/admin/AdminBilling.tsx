import { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import { CreditCard, Receipt, Loader2 } from "lucide-react";

interface Plan {
  id: number;
  name: string;
  code: string;
  price_monthly_cop: number;
}

interface Subscription {
  id: number;
  status: string;
  payment_provider: string;
  billing_cycle: string;
  mrr_cop: number;
}

interface Invoice {
  id: number;
  subscription_id: number;
  invoice_number: string;
  amount_cop: number;
  status: string;
  due_date: string;
}

function formatCop(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function AdminBilling() {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const authHeaders = () => ({
    ...(localStorage.getItem("userToken") ? { Authorization: `Bearer ${localStorage.getItem("userToken")}` } : {}),
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/admin/billing/me`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setPlan(data.plan || null);
      setSubscription(data.subscription || null);
      setInvoices(data.invoices || []);
      setMessage(data.message || null);
    } catch {
      toast.error("Error al cargar facturación");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const payInvoice = async (inv: Invoice) => {
    if (!subscription) return;
    try {
      const res = await fetch(`${API_URL}/admin/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          subscription_id: subscription.id,
          invoice_id: inv.id,
          provider: subscription.payment_provider === "manual" ? "wompi" : subscription.payment_provider,
          return_url: `${window.location.origin}/billing`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message);
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.info(data.message || "Contacte al administrador para registrar el pago");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al pagar");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Mi facturación</h1>
          <p className="text-muted-foreground text-sm">Plan, suscripción y pagos en línea (Wompi Colombia)</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {plan?.name || "Sin plan"}
            </CardTitle>
            <CardDescription>{message || "Estado de tu suscripción NutriData"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {plan && (
              <p className="text-2xl font-bold">{formatCop(plan.price_monthly_cop)}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
            )}
            {subscription && (
              <div className="flex flex-wrap gap-2">
                <Badge>{subscription.status}</Badge>
                <Badge variant="outline">{subscription.payment_provider}</Badge>
                <Badge variant="secondary">{subscription.billing_cycle}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> Facturas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoices.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay facturas pendientes.</p>
            )}
            {invoices.map((inv) => (
              <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border">
                <div>
                  <p className="font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">Vence: {inv.due_date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatCop(inv.amount_cop)}</span>
                  <Badge variant={inv.status === "paid" ? "default" : "secondary"}>{inv.status}</Badge>
                  {inv.status !== "paid" && subscription && (
                    <Button size="sm" onClick={() => payInvoice(inv)}>Pagar en línea</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
