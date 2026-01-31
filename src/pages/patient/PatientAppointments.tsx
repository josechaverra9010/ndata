import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, Video, MapPin, User, Phone, CheckCircle2, Plus, X, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

// Tipos
interface Appointment {
  id: number;
  date: string;
  time: string;
  doctor: string;
  type: string;
  mode: "video" | "presencial";
  status: "confirmed" | "pending";
  notes?: string;
  duration?: string;
  meeting_link?: string;
}

interface Nutritionist {
  id: number;
  name: string;
  title: string;
  verified: boolean;
  patients_count: number;
  photo: string;
  phone: string;
  email: string;
}

interface NewAppointment {
  date: string;
  time: string;
  type: string;
  duration: string;
  notes: string;
}

export default function PatientAppointments() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [nutritionist, setNutritionist] = useState<Nutritionist | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const [newAppointment, setNewAppointment] = useState<NewAppointment>({
    date: "",
    time: "",
    type: "presencial",
    duration: "30 min",
    notes: ""
  });

  const { user } = useAuth();
  const patientId = user?.id;

  // Cargar datos cuando tengamos el patientId
  useEffect(() => {
    if (patientId) {
      loadAppointmentsData();
      loadNutritionistData();
    }
  }, [patientId]);

  // Cargar datos cuando tengamos el patientId
  useEffect(() => {
    if (patientId) {
      loadAppointmentsData();
      loadNutritionistData();
    }
  }, [patientId]);

  // Cargar horarios disponibles cuando se selecciona una fecha
  useEffect(() => {
    if (selectedDate && patientId) {
      loadAvailableSlots(selectedDate);
    }
  }, [selectedDate, patientId]);

  const loadAppointmentsData = async () => {
    if (!patientId) return;

    setLoading(true);
    try {
      // Cargar próximas citas
      const token = localStorage.getItem("userToken");
      const upcomingRes = await fetch(`${API_URL}/patients/${patientId}/appointments/upcoming`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (upcomingRes.ok) {
        const data = await upcomingRes.json();
        setUpcomingAppointments(data);
      }

      // Cargar historial
      const pastRes = await fetch(`${API_URL}/patients/${patientId}/appointments/past`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (pastRes.ok) {
        const data = await pastRes.json();
        setPastAppointments(data);
      }
    } catch (error) {
      console.error("Error cargando citas:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las citas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadNutritionistData = async () => {
    if (!patientId) return;

    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patients/${patientId}/nutritionist`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (res.ok) {
        const data = await res.json();
        setNutritionist(data);
      }
    } catch (error) {
      console.error("Error cargando nutricionista:", error);
    }
  };

  const loadAvailableSlots = async (date: string) => {
    if (!patientId) return;

    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patients/${patientId}/available-times?date=${date}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (res.ok) {
        const data = await res.json();
        const available = data.slots
          .filter((slot: any) => slot.available)
          .map((slot: any) => slot.time);
        setAvailableSlots(available);
      }
    } catch (error) {
      console.error("Error cargando horarios:", error);
    }
  };

  const handleRequestAppointment = async () => {
    if (!patientId || !newAppointment.date || !newAppointment.time) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patients/${patientId}/appointments/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newAppointment)
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "¡Éxito!",
          description: data.message || "Solicitud de cita enviada correctamente"
        });
        setIsDialogOpen(false);
        setNewAppointment({
          date: "",
          time: "",
          type: "presencial",
          duration: "30 min",
          notes: ""
        });
        loadAppointmentsData();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo solicitar la cita",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Error de conexión con el servidor",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async () => {
    if (!patientId || !selectedAppointment || !newAppointment.date || !newAppointment.time) {
      toast({
        title: "Error",
        description: "Por favor selecciona fecha y hora",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(
        `${API_URL}/patients/${patientId}/appointments/${selectedAppointment.id}/reschedule`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            date: newAppointment.date,
            time: newAppointment.time
          })
        }
      );

      if (res.ok) {
        toast({
          title: "¡Éxito!",
          description: "Cita reprogramada correctamente"
        });
        setIsRescheduleDialogOpen(false);
        setSelectedAppointment(null);
        loadAppointmentsData();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo reprogramar la cita",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Error de conexión con el servidor",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: number) => {
    if (!patientId) return;

    if (!confirm("¿Estás seguro de que deseas cancelar esta cita?")) return;

    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(
        `${API_URL}/patients/${patientId}/appointments/${appointmentId}/cancel`,
        {
          method: "DELETE",
          headers: {
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          }
        }
      );

      if (res.ok) {
        toast({
          title: "Cita cancelada",
          description: "La cita ha sido cancelada exitosamente"
        });
        loadAppointmentsData();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo cancelar la cita",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Error de conexión con el servidor",
        variant: "destructive"
      });
    }
  };

  const openRescheduleDialog = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setNewAppointment({
      date: "",
      time: "",
      type: appointment.mode,
      duration: "30 min",
      notes: ""
    });
    setIsRescheduleDialogOpen(true);
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="space-y-4 lg:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">Mis Citas</h1>
            <p className="text-sm lg:text-base text-muted-foreground">Gestiona tus consultas con tu nutricionista</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto" size="sm">
                <Plus className="h-4 w-4" />
                Solicitar Cita
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Solicitar Nueva Cita</DialogTitle>
                <DialogDescription>
                  Completa los datos para solicitar tu consulta
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Fecha</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newAppointment.date}
                    onChange={(e) => {
                      setNewAppointment({ ...newAppointment, date: e.target.value });
                      setSelectedDate(e.target.value);
                    }}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="time">Hora</Label>
                  <Select
                    value={newAppointment.time}
                    onValueChange={(value) => setNewAppointment({ ...newAppointment, time: value })}
                    disabled={!selectedDate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSlots.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          {selectedDate ? "No hay horarios disponibles" : "Selecciona una fecha primero"}
                        </div>
                      ) : (
                        availableSlots.map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="type">Tipo de consulta</Label>
                  <Select
                    value={newAppointment.type}
                    onValueChange={(value) => setNewAppointment({ ...newAppointment, type: value })}
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

                <div className="grid gap-2">
                  <Label htmlFor="duration">Duración</Label>
                  <Select
                    value={newAppointment.duration}
                    onValueChange={(value) => setNewAppointment({ ...newAppointment, duration: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30 min">30 minutos</SelectItem>
                      <SelectItem value="45 min">45 minutos</SelectItem>
                      <SelectItem value="60 min">60 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes">Notas (opcional)</Label>
                  <Textarea
                    id="notes"
                    value={newAppointment.notes}
                    onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleRequestAppointment} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Solicitar Cita"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Upcoming Appointments */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-3 lg:pb-6">
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
              Próximas Citas
            </CardTitle>
            <CardDescription className="text-xs lg:text-sm">Tus consultas programadas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 lg:space-y-4">
            {upcomingAppointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No tienes citas programadas</p>
                <Button
                  variant="link"
                  onClick={() => setIsDialogOpen(true)}
                  className="mt-2"
                >
                  Solicitar una cita
                </Button>
              </div>
            ) : (
              upcomingAppointments.map((appointment, index) => (
                <div
                  key={appointment.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 lg:p-5 rounded-xl border border-primary/20 bg-primary/5 transition-all duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-3 lg:gap-4">
                    <div className="flex h-12 w-12 lg:h-14 lg:w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <span className="text-base lg:text-lg font-bold">{appointment.date.split(" ")[0]}</span>
                      <span className="text-[10px] lg:text-xs">{appointment.date.split(" ")[1]}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm lg:text-base">{appointment.type}</p>
                        <Badge
                          variant={appointment.status === "confirmed" ? "default" : "secondary"}
                          className="text-[10px] lg:text-xs"
                        >
                          {appointment.status === "confirmed" ? "Confirmada" : "Pendiente"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:gap-4 mt-1 text-xs lg:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 lg:h-4 lg:w-4" />
                          {appointment.time}
                        </span>
                        <span className="flex items-center gap-1">
                          {appointment.mode === "video" ? (
                            <>
                              <Video className="h-3 w-3 lg:h-4 lg:w-4" />
                              Video
                            </>
                          ) : (
                            <>
                              <MapPin className="h-3 w-3 lg:h-4 lg:w-4" />
                              Presencial
                            </>
                          )}
                        </span>
                        {appointment.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 lg:h-4 lg:w-4" />
                            {appointment.duration}
                          </span>
                        )}
                      </div>
                      {appointment.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic line-clamp-1 border-l-2 border-primary/20 pl-2">
                          "{appointment.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    {appointment.mode === "video" && appointment.status === "confirmed" && (
                      <Button
                        size="sm"
                        className="gap-1 text-xs flex-1 sm:flex-none animate-pulse-subtle bg-success hover:bg-success/90"
                        onClick={() => {
                          if (appointment.meeting_link) {
                            window.open(appointment.meeting_link, "_blank");
                          } else {
                            toast({
                              title: "Link no disponible",
                              description: "El link de la videollamada aún no ha sido generado",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <Video className="h-3 w-3" />
                        Unirse
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs flex-1 sm:flex-none"
                      onClick={() => openRescheduleDialog(appointment)}
                    >
                      Reprogramar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={() => handleCancelAppointment(appointment.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Reschedule Dialog */}
        <Dialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Reprogramar Cita</DialogTitle>
              <DialogDescription>
                Selecciona una nueva fecha y hora para tu cita
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reschedule-date">Nueva Fecha</Label>
                <Input
                  id="reschedule-date"
                  type="date"
                  value={newAppointment.date}
                  onChange={(e) => {
                    setNewAppointment({ ...newAppointment, date: e.target.value });
                    setSelectedDate(e.target.value);
                  }}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reschedule-time">Nueva Hora</Label>
                <Select
                  value={newAppointment.time}
                  onValueChange={(value) => setNewAppointment({ ...newAppointment, time: value })}
                  disabled={!selectedDate}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una hora" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        {selectedDate ? "No hay horarios disponibles" : "Selecciona una fecha primero"}
                      </div>
                    ) : (
                      availableSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRescheduleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleReschedule} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reprogramando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Doctor Info */}
        {nutritionist && (
          <Card className="border-border shadow-card">
            <CardHeader className="pb-3 lg:pb-6">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <User className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Tu Nutricionista
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center gap-4 lg:gap-6">
                <div className="h-16 w-16 lg:h-20 lg:w-20 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden">
                  <img
                    src={nutritionist.photo}
                    alt={nutritionist.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-base lg:text-lg font-semibold text-foreground">{nutritionist.name}</h3>
                  <p className="text-xs lg:text-sm text-muted-foreground">{nutritionist.title}</p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 lg:gap-4 mt-2 lg:mt-3 flex-wrap">
                    {nutritionist.verified && (
                      <Badge variant="secondary" className="gap-1 text-[10px] lg:text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        Verificada
                      </Badge>
                    )}
                    <span className="text-xs lg:text-sm text-muted-foreground">
                      +{nutritionist.patients_count} pacientes
                    </span>
                  </div>
                </div>
                <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs flex-1 sm:flex-none"
                    onClick={() => window.location.href = `tel:${nutritionist.phone}`}
                  >
                    <Phone className="h-3 w-3 lg:h-4 lg:w-4" />
                    Llamar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs flex-1 sm:flex-none"
                    onClick={() => window.location.href = `mailto:${nutritionist.email}`}
                  >
                    <Video className="h-3 w-3 lg:h-4 lg:w-4" />
                    Email
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Past Appointments */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-3 lg:pb-6">
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <Clock className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
              Historial de Citas
            </CardTitle>
            <CardDescription className="text-xs lg:text-sm">Consultas anteriores y notas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 lg:space-y-3">
            {pastAppointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No tienes historial de citas</p>
              </div>
            ) : (
              pastAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 p-3 lg:p-4 rounded-xl border border-border bg-muted/30"
                >
                  <div className="flex items-start gap-3 lg:gap-4">
                    <div className="flex h-10 w-10 lg:h-12 lg:w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <span className="text-xs lg:text-sm font-bold">{appointment.date.split(" ")[0]}</span>
                      <span className="text-[10px] lg:text-xs">{appointment.date.split(" ")[1]}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm lg:text-base">{appointment.type}</p>
                      <div className="flex items-center gap-2 lg:gap-3 mt-1 text-xs lg:text-sm text-muted-foreground">
                        <span>{appointment.time}</span>
                        <span className="flex items-center gap-1">
                          {appointment.mode === "video" ? (
                            <Video className="h-3 w-3" />
                          ) : (
                            <MapPin className="h-3 w-3" />
                          )}
                          {appointment.mode === "video" ? "Video" : "Presencial"}
                        </span>
                      </div>
                      {appointment.notes && (
                        <p className="text-xs lg:text-sm text-muted-foreground mt-2 p-2 rounded bg-background border border-border">
                          📝 {appointment.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-success border-success/30 text-[10px] lg:text-xs shrink-0 self-start">
                    Completada
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PatientLayout>
  );
}