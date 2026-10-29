import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { API_URL } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle } from "lucide-react";

export function SubscriptionPaywallBanner() {
  const location = useLocation();
  const [info, setInfo] = useState<{
    planCode?: string;
    status?: string;
    trialDaysLeft?: number | null;
    message?: string | null;
    degraded?: boolean;
  } | null>(null);

  useEffect(() => {
    if (location.pathname.startsWith("/patient/billing")) {
      setInfo(null);
      return;
    }
    const token = localStorage.getItem("userToken");
    fetch(`${API_URL}/patient/billing/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setInfo({
          planCode: data.plan?.code,
          status: data.subscription?.status,
          trialDaysLeft: data.trial_days_left,
          message: data.message,
          degraded: data.degraded,
        });
      })
      .catch(() => {});
  }, [location.pathname]);

  if (!info) return null;
  if (location.pathname.startsWith("/patient/billing")) return null;

  const showTrial =
    info.status === "trialing" && info.trialDaysLeft != null && info.trialDaysLeft <= 7;
  const showFree = info.planCode === "patient_free" && info.status === "active";
  const showPastDue = info.status === "past_due" || info.degraded;

  if (!showTrial && !showFree && !showPastDue) return null;

  const title = showPastDue
    ? "Pago pendiente — funciones limitadas"
    : showTrial
      ? `Prueba: ${info.trialDaysLeft} día(s) restantes`
      : "Estás en el plan Gratis";

  const subtitle = showPastDue
    ? "Completa el pago para recuperar tu plan."
    : showTrial
      ? "Durante la prueba tienes Esencial: plan, comidas, citas y adherencia."
      : "En Gratis ves tu quema calórica, meta al peso ideal y 2 sugerencias IA. Mejora para plan y comidas.";

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-2">
        {showPastDue ? (
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        ) : (
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        )}
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{info.message || subtitle}</p>
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link to="/patient/billing">Ver planes</Link>
      </Button>
    </div>
  );
}
