import { useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Users, Filter, Loader2, AlertTriangle } from "lucide-react";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { todayInColombiaISO } from "@/lib/timezone";
import { CreateWeeklyMenuDialog, CreatedWeeklyMenu } from "@/components/admin/CreateWeeklyMenuDialog";

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

interface BulkPreview {
  count: number;
  patient_ids: number[];
  sample: Array<{ id: number; name: string; programa_eps?: string | null }>;
  filters: Record<string, unknown>;
}

interface BulkFilters {
  cohorts: Array<{ value: string; label: string }>;
  organizations: Array<{ id: number; name: string }>;
  eps_programs: string[];
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
  const [startDate, setStartDate] = useState(todayInColombiaISO());
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "cohort">("cohort");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkFilters, setBulkFilters] = useState<BulkFilters | null>(null);
  const [cohort, setCohort] = useState("all");
  const [organizationId, setOrganizationId] = useState("all");
  const [programaEps, setProgramaEps] = useState("");
  const [preview, setPreview] = useState<BulkPreview | null>(null);

  const headers = () => {
    const token = localStorage.getItem("userToken");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    if (!open) return;
    setSelectedPatients(patientIds);
    setCreateMenuOpen(false);
    setMode(patientIds.length ? "manual" : "cohort");
    setPreview(null);
    setConfirmOpen(false);

    fetch(`${API_URL}/weekly-menus`, { headers: headers() })
      .then((r) => r.json())
      .then((data) => {
        setMenus(Array.isArray(data) ? data : []);
        if (preselectedMenuId) setMenuId(String(preselectedMenuId));
      })
      .catch(() => setMenus([]));

    fetch(`${API_URL}/nutritionist/menus/bulk-filters`, { headers: headers() })
      .then((r) => r.json())
      .then(setBulkFilters)
      .catch(() => setBulkFilters(null));

    if (!patientIds.length) {
      fetch(`${API_URL}/patients`, { headers: headers() })
        .then((r) => r.json())
        .then((data) => setPatients(Array.isArray(data) ? data : []))
        .catch(() => setPatients([]));
    }
  }, [open, preselectedMenuId, patientIds]);

  useEffect(() => {
    if (!open || mode !== "cohort") return;
    const params = new URLSearchParams();
    if (cohort !== "all") params.set("cohort", cohort);
    if (organizationId !== "all") params.set("organization_id", organizationId);
    if (programaEps.trim()) params.set("programa_eps", programaEps.trim());

    setPreviewLoading(true);
    const timer = setTimeout(() => {
      fetch(`${API_URL}/nutritionist/menus/bulk-preview?${params}`, { headers: headers() })
        .then((r) => r.json())
        .then(setPreview)
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [open, mode, cohort, organizationId, programaEps]);

  const targetIds = useMemo(() => {
    if (patientIds.length) return patientIds;
    if (mode === "cohort") return preview?.patient_ids ?? [];
    return selectedPatients;
  }, [patientIds, mode, preview, selectedPatients]);

  const selectedMenu = menus.find((m) => String(m.id) === menuId);

  const togglePatient = (id: number, checked: boolean) => {
    setSelectedPatients((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  const runAssign = async () => {
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
      const res = await fetch(`${API_URL}/weekly-menus/assign`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          patient_ids: targetIds,
          menu_id: Number(menuId),
          start_date: startDate,
          notes: mode === "cohort" ? "Asignación masiva por cohorte/filtros" : undefined,
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
      setConfirmOpen(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Error al asignar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMenuCreated = (menu: CreatedWeeklyMenu) => {
    const normalized: WeeklyMenu = {
      id: menu.id,
      name: menu.name,
      category: menu.category,
      total_calories: menu.total_calories,
    };
    setMenus((prev) => {
      if (prev.some((m) => m.id === normalized.id)) {
        return prev.map((m) => (m.id === normalized.id ? { ...m, ...normalized } : m));
      }
      return [normalized, ...prev];
    });
    setMenuId(String(normalized.id));
    setCreateMenuOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-2xl sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Asignación masiva de menú
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Menú semanal</Label>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-full" onClick={() => setCreateMenuOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Crear menú
                </Button>
              </div>
              {menus.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-center space-y-3 bg-muted/20">
                  <p className="text-sm text-muted-foreground">No hay menús semanales.</p>
                  <Button type="button" className="rounded-full" onClick={() => setCreateMenuOpen(true)}>
                    Crear menú semanal
                  </Button>
                </div>
              ) : (
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
              )}
            </div>

            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl" />
            </div>

            {!patientIds.length && (
              <Tabs value={mode} onValueChange={(v) => setMode(v as "manual" | "cohort")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="cohort" className="gap-1">
                    <Filter className="h-3.5 w-3.5" />
                    Por cohorte
                  </TabsTrigger>
                  <TabsTrigger value="manual">Manual</TabsTrigger>
                </TabsList>

                <TabsContent value="cohort" className="space-y-3 mt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Cohorte / tipo de plan</Label>
                      <Select value={cohort} onValueChange={setCohort}>
                        <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los pacientes activos</SelectItem>
                          {(bulkFilters?.cohorts ?? []).map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Organización</Label>
                      <Select value={organizationId} onValueChange={setOrganizationId}>
                        <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {(bulkFilters?.organizations ?? []).map((o) => (
                            <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">EPS / Programa</Label>
                    <Input
                      list="eps-options-bulk"
                      placeholder="Ej. Sanitas, crónicos…"
                      value={programaEps}
                      onChange={(e) => setProgramaEps(e.target.value)}
                      className="rounded-xl mt-1"
                    />
                    <datalist id="eps-options-bulk">
                      {(bulkFilters?.eps_programs ?? []).map((e) => (
                        <option key={e} value={e} />
                      ))}
                    </datalist>
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    {previewLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Calculando alcance…
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium">
                          {preview?.count ?? 0} paciente{(preview?.count ?? 0) !== 1 ? "s" : ""} coinciden
                        </p>
                        {preview?.sample?.length ? (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {preview.sample.map((p) => p.name).join(" · ")}
                            {(preview.count ?? 0) > preview.sample.length ? " …" : ""}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">Ajusta filtros para incluir pacientes</p>
                        )}
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="manual" className="mt-3">
                  <div className="max-h-48 overflow-y-auto rounded-xl border p-2 space-y-1">
                    {patients.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">Sin pacientes</p>
                    ) : (
                      patients.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-sm">
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
                </TabsContent>
              </Tabs>
            )}

            {patientIds.length > 0 && (
              <Badge variant="secondary">{patientIds.length} paciente(s) preseleccionado(s)</Badge>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-full"
              disabled={loading || !menuId || targetIds.length === 0}
              onClick={() => setConfirmOpen(true)}
            >
              Revisar y asignar ({targetIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirmar asignación masiva
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Vas a asignar <strong className="text-foreground">{selectedMenu?.name || "el menú"}</strong> a{" "}
                  <strong className="text-foreground">{targetIds.length}</strong> paciente{targetIds.length !== 1 ? "s" : ""}.
                </p>
                <p>Inicio: {startDate}. Los planes activos previos se pausarán automáticamente.</p>
                {mode === "cohort" && preview?.sample?.length ? (
                  <p className="text-xs">Incluye: {preview.sample.slice(0, 4).map((p) => p.name).join(", ")}{(preview.count ?? 0) > 4 ? "…" : ""}</p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={loading} onClick={(e) => { e.preventDefault(); runAssign(); }}>
              {loading ? "Asignando…" : "Confirmar asignación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateWeeklyMenuDialog open={createMenuOpen} onOpenChange={setCreateMenuOpen} onCreated={handleMenuCreated} />
    </>
  );
}
