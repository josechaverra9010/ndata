import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";

interface BulkAssignMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientIds?: number[];
  onSuccess?: () => void;
  preselectedMenuId?: number | null;
}

interface WeeklyMenu {
  id: number;
  name: string;
  category?: string;
  total_calories?: number;
}

interface PatientOption {
  id: number;
  nombres: string;
  apellidos: string;
}

export function BulkAssignMenuDialog({
  open,
  onOpenChange,
  patientIds = [],
  onSuccess,
  preselectedMenuId,
}: BulkAssignMenuDialogProps) {
  const { toast } = useToast();
  const [menus, setMenus] = useState<WeeklyMenu[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatients, setSelectedPatients] = useState<number[]>(patientIds);
  const [menuId, setMenuId] = useState<string>("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedPatients(patientIds);
    const token = localStorage.getItem("userToken");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_URL}/weekly-menus`, { headers })
      .then((r) => r.json())
      .then((data) => {
        setMenus(Array.isArray(data) ? data : []);
        if (preselectedMenuId) setMenuId(String(preselectedMenuId));
      })
      .catch(() => setMenus([]));

    if (!patientIds.length) {
      fetch(`${API_URL}/patients`, { headers })
        .then((r) => r.json())
        .then((data) => setPatients(Array.isArray(data) ? data : []))
        .catch(() => setPatients([]));
    }
  }, [open, preselectedMenuId, patientIds]);

  const targetIds = patientIds.length ? patientIds : selectedPatients;

  const togglePatient = (id: number, checked: boolean) => {
    setSelectedPatients((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  const handleAssign = async () => {
    if (!menuId || targetIds.length === 0) {
      toast({
        title: "Faltan datos",
        description: "Selecciona un menú y al menos un paciente",
        variant: "destructive",
      });
      return;
    }
    try {
      setLoading(true);
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/weekly-menus/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          patient_ids: targetIds,
          menu_id: Number(menuId),
          start_date: startDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo asignar el menú");
      }
      toast({
        title: "Menú asignado",
        description: data.message || `Asignado a ${data.assigned_count ?? targetIds.length} pacientes`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Error al asignar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Asignar menú
            {targetIds.length > 0 ? ` a ${targetIds.length} paciente(s)` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Menú semanal</Label>
            <Select value={menuId} onValueChange={setMenuId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Seleccionar menú" />
              </SelectTrigger>
              <SelectContent>
                {menus.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name}
                    {m.total_calories ? ` · ${m.total_calories} kcal` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha de inicio</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl"
            />
          </div>
          {!patientIds.length && (
            <div className="space-y-2">
              <Label>Pacientes</Label>
              <div className="max-h-48 overflow-y-auto rounded-xl border p-2 space-y-1">
                {patients.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">Sin pacientes</p>
                ) : (
                  patients.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPatients.includes(p.id)}
                        onChange={(e) => togglePatient(p.id, e.target.checked)}
                      />
                      {p.nombres} {p.apellidos}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-full" disabled={loading} onClick={handleAssign}>
            {loading ? "Asignando…" : "Asignar menú"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
