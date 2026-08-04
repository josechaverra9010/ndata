import { WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OfflineBannerProps {
  online: boolean;
  pending: number;
  syncing: boolean;
  onSync?: () => void;
}

export function OfflineBanner({ online, pending, syncing, onSync }: OfflineBannerProps) {
  if (online && pending === 0) return null;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm ${
        online
          ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {!online
            ? "Sin conexión — tus acciones se guardarán y sincronizarán al volver"
            : `${pending} acción${pending !== 1 ? "es" : ""} pendiente${pending !== 1 ? "s" : ""} de sincronizar`}
        </span>
      </div>
      {online && pending > 0 && onSync && (
        <Button size="sm" variant="outline" className="h-7 shrink-0" disabled={syncing} onClick={onSync}>
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  );
}
