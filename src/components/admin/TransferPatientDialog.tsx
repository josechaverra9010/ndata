import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRightLeft } from "lucide-react";

export interface TransferPatientTarget {
  id: number;
  name?: string;
  nombres?: string;
  apellidos?: string;
  email?: string;
  nutritionist_id?: number | null;
  nutritionist_name?: string | null;
}

interface NutritionistOption {
  id: number;
  name: string;
  email: string;
  status: string;
  patients?: number;
}

interface TransferPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Uno o varios pacientes a transferir */
  patients: TransferPatientTarget[];
  onSuccess?: () => void;
}

export function TransferPatientDialog({
  open,
  onOpenChange,
  patients,
  onSuccess,
}: TransferPatientDialogProps) {
  const { toast } = useToast();
  const [nutritionists, setNutritionists] = useState<NutritionistOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nutritionistId, setNutritionistId] = useState<string>("");

  const labels = useMemo(() => {
    return patients.map((p) => {
      const name =
        p.name ||
        [p.nombres, p.apellidos].filter(Boolean).join(" ") ||
        p.email ||
        `Paciente #${p.id}`;
      return { id: p.id, name, current: p.nutritionist_name || null };
    });
  }, [patients]);

  const isBulk = patients.length > 1;

  useEffect(() => {
    if (!open) {
      setNutritionistId("");
      setSaving(false);
      return;
    }

    const load = async () => {
      setLoadingList(true);
      try {
        const token = localStorage.getItem("userToken");
        const res = await fetch(`${API_URL}/superadmin/nutritionists`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) throw new Error("No se pudieron cargar nutricionistas");
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setNutritionists(
          list.filter((n: NutritionistOption) => n.status !== "inactivo")
        );

        // Preseleccionar si hay un solo paciente y ya tiene nutricionista distinto
        if (patients.length === 1 && patients[0].nutritionist_id) {
          // no preseleccionar el actual; dejar vacío para forzar elección
        }
      } catch (e: any) {
        toast({
          title: "Error",
          description: e?.message || "No se pudieron cargar nutricionistas",
          variant: "destructive",
        });
      } finally {
        setLoadingList(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleTransfer = async () => {
    if (!nutritionistId || patients.length === 0) return;
    const targetId = Number(nutritionistId);
    if (!Number.isFinite(targetId)) return;

    setSaving(true);
    try {
      const token = localStorage.getItem("userToken");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      let message = "Paciente transferido correctamente";

      if (isBulk) {
        const res = await fetch(`${API_URL}/superadmin/patients/transfer`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            patient_ids: patients.map((p) => p.id),
            nutritionist_id: targetId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "No se pudo transferir"
          );
        }
        message = `${data.transferred || 0} paciente(s) transferido(s) a ${
          data.nutritionist_name || "el nutricionista"
        }${data.skipped ? ` · ${data.skipped} omitido(s)` : ""}`;
      } else {
        const patient = patients[0];
        const res = await fetch(
          `${API_URL}/superadmin/patients/${patient.id}/nutritionist`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({ nutritionist_id: targetId }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "No se pudo transferir"
          );
        }
        message = `${data.patient_name || labels[0]?.name} → ${
          data.nutritionist_name || "nutricionista"
        }`;
      }

      toast({ title: "Transferencia realizada", description: message });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No se pudo transferir",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            {isBulk
              ? `Transferir ${patients.length} pacientes`
              : "Transferir paciente"}
          </DialogTitle>
          <DialogDescription className="text-left space-y-2">
            {isBulk ? (
              <span className="block">
                Se reasignarán {patients.length} pacientes al nutricionista que
                elijas.
              </span>
            ) : (
              <span className="block">
                Paciente:{" "}
                <strong className="text-foreground">{labels[0]?.name}</strong>
                {labels[0]?.current ? (
                  <>
                    {" "}
                    · Actual:{" "}
                    <strong className="text-foreground">{labels[0].current}</strong>
                  </>
                ) : (
                  " · Sin nutricionista asignado"
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label>Nutricionista destino</Label>
          {loadingList ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando nutricionistas…
            </div>
          ) : (
            <Select value={nutritionistId} onValueChange={setNutritionistId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecciona un nutricionista" />
              </SelectTrigger>
              <SelectContent>
                {nutritionists.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No hay nutricionistas activos
                  </SelectItem>
                ) : (
                  nutritionists.map((n) => (
                    <SelectItem
                      key={n.id}
                      value={String(n.id)}
                      disabled={
                        !isBulk && patients[0]?.nutritionist_id === n.id
                      }
                    >
                      {n.name}
                      {typeof n.patients === "number"
                        ? ` · ${n.patients} pac.`
                        : ""}
                      {n.email ? ` (${n.email})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            disabled={!nutritionistId || saving || loadingList}
            onClick={handleTransfer}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-4 w-4 mr-2" />
            )}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
