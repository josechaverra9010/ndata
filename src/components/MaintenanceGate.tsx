import { useEffect, useState, ReactNode } from "react";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Wrench, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlatformStatus {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  siteName?: string;
}

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiOffline, setApiOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/public/platform-status`, {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setStatus(data);
            setApiOffline(false);
          }
        } else if (!cancelled) {
          setApiOffline(true);
          setStatus({ maintenanceMode: false, maintenanceMessage: "" });
        }
      } catch {
        if (!cancelled) {
          setApiOffline(true);
          setStatus({ maintenanceMode: false, maintenanceMessage: "" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isSuperadmin = user?.role === "superadmin";
  if (status?.maintenanceMode && !isSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Wrench className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Mantenimiento</h1>
          <p className="text-muted-foreground">
            {status.maintenanceMessage || "La plataforma está en mantenimiento. Vuelve pronto."}
          </p>
          {!user && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {apiOffline && (
        <div className="sticky top-0 z-[100] flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-sm text-white">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            No se puede conectar al servidor ({API_URL.replace("/api", "")}). Inicia el backend:{" "}
            <code className="rounded bg-black/20 px-1">python -m uvicorn main:app --reload --port 8001</code>
          </span>
        </div>
      )}
      {children}
    </>
  );
}
