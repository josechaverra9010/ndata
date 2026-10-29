import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  defaultFlags,
  fetchPatientFeatureFlags,
  isRouteEnabled,
  subscribeFeatureFlagRefresh,
} from "@/lib/featureFlags";
import { toast } from "sonner";

/** Redirige a /patient/billing si la ruta actual no está en el plan. */
export function SubscriptionRouteGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [flags, setFlags] = useState<Record<string, boolean>>(() => defaultFlags());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    fetchPatientFeatureFlags(token)
      .then(setFlags)
      .finally(() => setReady(true));
    return subscribeFeatureFlagRefresh(fetchPatientFeatureFlags, setFlags);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const path = location.pathname;
    if (path.startsWith("/patient/billing") || path === "/patient" || path === "/patient/") {
      return;
    }
    if (!isRouteEnabled(path, flags)) {
      toast.message("Esta función requiere un plan superior", {
        description: "Revisa los planes disponibles en Suscripción.",
      });
      navigate("/patient/billing", { replace: true });
    }
  }, [ready, flags, location.pathname, navigate]);

  return null;
}
