import { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

export interface DeletePatientTarget {
  id: number;
  nombres?: string;
  apellidos?: string;
  name?: string;
  email?: string;
}

interface DeletePatientDialogProps {
  patient: DeletePatientTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Si true, elimina definitivamente (solo desde papelera). */
  permanent?: boolean;
}

/**
 * Doble alerta para eliminar paciente:
 * 1) Confirmación inicial (mover a papelera o eliminar definitivo)
 * 2) Debe escribir el apellido (o ELIMINAR) para autorizar
 */
export function DeletePatientDialog({
  patient,
  open,
  onOpenChange,
  onSuccess,
  permanent = false,
}: DeletePatientDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const displayName = useMemo(() => {
    if (!patient) return "";
    return (
      patient.name ||
      [patient.nombres, patient.apellidos].filter(Boolean).join(" ") ||
      patient.email ||
      "este paciente"
    );
  }, [patient]);

  const apellido = (patient?.apellidos || "").trim();
  const expectedToken = useMemo(() => {
    if (apellido) return apellido.toLowerCase();
    return permanent ? "eliminar permanentemente" : "eliminar";
  }, [apellido, permanent]);

  const confirmed =
    confirmText.trim().toLowerCase() === expectedToken ||
    confirmText.trim().toUpperCase() === "ELIMINAR";

  useEffect(() => {
    if (!open) {
      setStep(1);
      setConfirmText("");
      setLoading(false);
    }
  }, [open]);

  const handleClose = (v: boolean) => {
    if (loading) return;
    onOpenChange(v);
  };

  const execute = async () => {
    if (!patient || !confirmed) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const url = permanent
        ? `${API_URL}/patients/${patient.id}/permanent`
        : `${API_URL}/patients/${patient.id}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const err = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof err.detail === "string"
            ? err.detail
            : permanent
              ? "No se pudo eliminar definitivamente"
              : "No se pudo mover a la papelera"
        );
      }

      toast({
        title: permanent ? "Eliminado definitivamente" : "Movido a la papelera",
        description: permanent
          ? `${displayName} fue eliminado de forma permanente.`
          : `${displayName} está en la papelera. Puedes recuperarlo cuando quieras.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No se pudo completar la acción",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="rounded-2xl max-w-md">
        {step === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${permanent ? "text-destructive" : "text-amber-500"}`} />
                {permanent ? "¿Eliminar definitivamente?" : "¿Mover a la papelera?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 text-left">
                <span className="block">
                  Estás a punto de {permanent ? "eliminar definitivamente a" : "enviar a la papelera a"}{" "}
                  <strong className="text-foreground">{displayName}</strong>.
                </span>
                {permanent ? (
                  <span className="block text-destructive/90">
                    Esta acción no se puede deshacer. Se borrarán fichas, citas, métricas y planes asociados.
                  </span>
                ) : (
                  <span className="block">
                    No se borrará de inmediato: irá a la <strong>papelera</strong> y podrás recuperarlo.
                    La eliminación definitiva solo la autoriza un administrador desde la papelera.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
              <Button
                variant={permanent ? "destructive" : "default"}
                className={permanent ? "" : "bg-amber-600 hover:bg-amber-700 text-white"}
                disabled={loading}
                onClick={() => setStep(2)}
              >
                Continuar
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmación final</AlertDialogTitle>
              <AlertDialogDescription className="text-left space-y-3">
                <span className="block">
                  Para autorizar, escribe{" "}
                  {apellido ? (
                    <>
                      el apellido <strong className="text-foreground">«{apellido}»</strong>
                    </>
                  ) : (
                    <>
                      la palabra <strong className="text-foreground">ELIMINAR</strong>
                    </>
                  )}{" "}
                  y confirma.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-1">
              <Label htmlFor="confirm-delete-patient">
                {apellido ? `Apellido de ${displayName}` : "Escribe ELIMINAR"}
              </Label>
              <Input
                id="confirm-delete-patient"
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={apellido || "ELIMINAR"}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && confirmed && !loading) execute();
                }}
              />
            </div>
            <AlertDialogFooter>
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setStep(1);
                  setConfirmText("");
                }}
              >
                Atrás
              </Button>
              <Button
                variant="destructive"
                disabled={!confirmed || loading}
                onClick={execute}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {permanent ? "Eliminar definitivamente" : "Mover a papelera"}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
