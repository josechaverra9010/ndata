import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

interface Patient {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
}

interface NewAppointmentDialogProps {
  children?: React.ReactNode;
  onAppointmentCreated?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialDate?: Date;
  initialTime?: string;
}

export function NewAppointmentDialog({
  children,
  onAppointmentCreated,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialDate,
  initialTime,
}: NewAppointmentDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (value: boolean) => {
    if (!isControlled) setUncontrolledOpen(value);
    controlledOnOpenChange?.(value);
  };

  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    patient_id: "",
    patient_name: "",
    date: undefined as Date | undefined,
    time: "",
    duration: "30 min",
    type: "presencial",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchPatients();
      setFormData((prev) => ({
        ...prev,
        date: initialDate ?? prev.date,
        time: initialTime ?? (initialDate ? "" : prev.time),
      }));
    }
  }, [open, initialDate, initialTime]);

  useEffect(() => {
    if (formData.date) {
      fetchAvailableSlots();
    }
  }, [formData.date, formData.duration]);

  const fetchPatients = async () => {
    try {
      const token = localStorage.getItem("userToken");
      const response = await axios.get(`${API_URL}/patients`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setPatients(response.data);
    } catch (error) {
      console.error("Error loading patients:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pacientes",
        variant: "destructive",
      });
    }
  };

  const fetchAvailableSlots = async () => {
    if (!formData.date) return;

    setLoadingSlots(true);
    try {
      const token = localStorage.getItem("userToken");
      const dateStr = format(formData.date, "yyyy-MM-dd");
      const response = await axios.get(
        `${API_URL}/appointments/available-slots/${dateStr}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          params: { duration: formData.duration },
        }
      );
      const slots: string[] = response.data.available_slots || [];
      // Conservar hora prefijada aunque no venga todavía en la lista
      if (formData.time && !slots.includes(formData.time)) {
        slots.push(formData.time);
        slots.sort();
      }
      setAvailableSlots(slots);
    } catch (error) {
      console.error("Error loading slots:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los horarios disponibles",
        variant: "destructive",
      });
    } finally {
      setLoadingSlots(false);
    }
  };

  const handlePatientChange = (patientId: string) => {
    const patient = patients.find((p) => p.id === parseInt(patientId));
    if (patient) {
      setFormData({
        ...formData,
        patient_id: patientId,
        patient_name: `${patient.nombres} ${patient.apellidos}`,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patient_id || !formData.date || !formData.time) {
      toast({
        title: "Campos incompletos",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const appointmentData = {
        patient_id: parseInt(formData.patient_id),
        patient_name: formData.patient_name,
        date: format(formData.date, "yyyy-MM-dd"),
        time: formData.time,
        duration: formData.duration,
        type: formData.type,
        notes: formData.notes || null,
      };

      const token = localStorage.getItem("userToken");
      await axios.post(`${API_URL}/appointments`, appointmentData, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      toast({
        title: "Cita creada",
        description: "La cita ha sido programada correctamente",
      });

      setFormData({
        patient_id: "",
        patient_name: "",
        date: undefined,
        time: "",
        duration: "30 min",
        type: "presencial",
        notes: "",
      });

      setOpen(false);
      onAppointmentCreated?.();
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      toast({
        title: "Error",
        description: error.response?.data?.detail || "No se pudo crear la cita",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
          <DialogHeader className="border-b bg-gradient-to-br from-primary/10 via-background to-sky-500/5 px-6 pt-6 pb-4 space-y-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <CalendarPlus className="h-4 w-4" />
              </span>
              Nueva cita
            </DialogTitle>
            <DialogDescription>
              Programa una consulta presencial o por videollamada
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-5 overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="patient">Paciente *</Label>
              <Select
                value={formData.patient_id}
                onValueChange={handlePatientChange}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecciona un paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id.toString()}>
                      {patient.nombres} {patient.apellidos}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Fecha *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-11 rounded-xl justify-start text-left font-normal",
                      !formData.date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {formData.date ? (
                      format(formData.date, "PPP", { locale: es })
                    ) : (
                      <span>Selecciona una fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) =>
                      setFormData({ ...formData, date, time: "" })
                    }
                    locale={es}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="rounded-xl"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="time">Hora *</Label>
                <Select
                  value={formData.time}
                  onValueChange={(value) =>
                    setFormData({ ...formData, time: value })
                  }
                  disabled={!formData.date || loadingSlots}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue
                      placeholder={
                        loadingSlots
                          ? "Cargando..."
                          : "Selecciona hora"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                    {availableSlots.length === 0 && !loadingSlots && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No hay horarios disponibles
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="duration">Duración</Label>
                <Select
                  value={formData.duration}
                  onValueChange={(value) =>
                    setFormData({ ...formData, duration: value })
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30 min">30 minutos</SelectItem>
                    <SelectItem value="45 min">45 minutos</SelectItem>
                    <SelectItem value="60 min">60 minutos</SelectItem>
                    <SelectItem value="90 min">90 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Tipo de consulta</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: "presencial" })}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-sm font-medium transition-all text-left",
                    formData.type === "presencial"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20 text-foreground"
                      : "hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <span className="block font-semibold text-foreground">Presencial</span>
                  <span className="text-xs text-muted-foreground">En consultorio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: "videollamada" })}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-sm font-medium transition-all text-left",
                    formData.type === "videollamada"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20 text-foreground"
                      : "hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <span className="block font-semibold text-foreground">Videollamada</span>
                  <span className="text-xs text-muted-foreground">Consulta online</span>
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                className="rounded-xl resize-none"
                placeholder="Motivo, preparación, recordatorios..."
              />
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/30 px-6 py-4 gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" className="rounded-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear cita
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}