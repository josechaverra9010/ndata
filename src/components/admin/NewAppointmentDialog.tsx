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
import { CalendarIcon, Loader2 } from "lucide-react";
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
  children: React.ReactNode;
  onAppointmentCreated?: () => void;
}

export function NewAppointmentDialog({ children, onAppointmentCreated }: NewAppointmentDialogProps) {
  const [open, setOpen] = useState(false);
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
    }
  }, [open]);

  useEffect(() => {
    if (formData.date) {
      fetchAvailableSlots();
    }
  }, [formData.date]);

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
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setAvailableSlots(response.data.available_slots);
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

      // Reset form
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
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva Cita</DialogTitle>
            <DialogDescription>
              Programa una nueva cita con un paciente
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Selección de Paciente */}
            <div className="grid gap-2">
              <Label htmlFor="patient">Paciente *</Label>
              <Select
                value={formData.patient_id}
                onValueChange={handlePatientChange}
              >
                <SelectTrigger>
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

            {/* Fecha */}
            <div className="grid gap-2">
              <Label>Fecha *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`justify-start text-left font-normal ${!formData.date && "text-muted-foreground"
                      }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date ? (
                      format(formData.date, "PPP", { locale: es })
                    ) : (
                      <span>Selecciona una fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) =>
                      setFormData({ ...formData, date, time: "" })
                    }
                    locale={es}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Hora */}
            <div className="grid gap-2">
              <Label htmlFor="time">Hora *</Label>
              <Select
                value={formData.time}
                onValueChange={(value) =>
                  setFormData({ ...formData, time: value })
                }
                disabled={!formData.date || loadingSlots}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingSlots
                        ? "Cargando horarios..."
                        : "Selecciona una hora"
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

            {/* Duración */}
            <div className="grid gap-2">
              <Label htmlFor="duration">Duración</Label>
              <Select
                value={formData.duration}
                onValueChange={(value) =>
                  setFormData({ ...formData, duration: value })
                }
              >
                <SelectTrigger>
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

            {/* Tipo */}
            <div className="grid gap-2">
              <Label htmlFor="type">Tipo de consulta</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="videollamada">Videollamada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notas */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Cita
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}