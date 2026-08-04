import { Eye, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { endImpersonation, getImpersonationMeta, isImpersonating } from "@/lib/impersonation";

export function ImpersonationBanner() {
  if (!isImpersonating()) return null;

  const meta = getImpersonationMeta();

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <span className="truncate">
          <strong>Modo impersonación</strong>
          {meta ? ` — viendo como ${meta.targetName}` : ""}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 rounded-lg border-amber-600/40"
        onClick={() => endImpersonation()}
      >
        <LogOut className="h-3.5 w-3.5 mr-1.5" />
        Salir y volver a superadmin
      </Button>
    </div>
  );
}
