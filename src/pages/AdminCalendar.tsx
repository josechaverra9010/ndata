import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "@/config/api";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Video,
  MapPin,
  MoreHorizontal,
  CalendarIcon,
  CheckCircle2,
  AlertCircle,
  X,
  LayoutGrid,
  Rows3,
  CalendarDays,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isToday,
  startOfDay,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  eachDayOfInterval,
  getHours,
  getMinutes,
} from "date-fns";
import { es } from "date-fns/locale";
import { NewAppointmentDialog } from "@/components/admin/NewAppointmentDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

interface Appointment {
  id: number;
  patientId: number;
  patientName: string;
  date: Date;
  time: string;
  duration: string;
  type: "presencial" | "videollamada";
  status: "confirmada" | "pendiente" | "cancelada";
  notes?: string;
}

/** Horas de trabajo (vista compacta por hora) */
const hourSlots = Array.from({ length: 12 }, (_, i) => i + 8); // 8 → 19

const statusStyles: Record<string, string> = {
  confirmada: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  pendiente: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300",
  cancelada: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300",
};

const statusBar: Record<string, string> = {
  confirmada: "border-l-emerald-500",
  pendiente: "border-l-amber-500",
  cancelada: "border-l-rose-500",
};

const statusDot: Record<string, string> = {
  confirmada: "bg-emerald-500",
  pendiente: "bg-amber-500",
  cancelada: "bg-rose-500",
};

const slotStyles: Record<string, string> = {
  confirmada:
    "bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200",
  pendiente:
    "bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/25 text-amber-800 dark:text-amber-200",
  cancelada:
    "bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/25 text-rose-800 dark:text-rose-200 opacity-70",
};

const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

const parseTimeParts = (time: string) => {
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  return { hour: hh || 0, minutes: mm || 0 };
};

export default function AdminCalendar() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("week");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"todas" | "confirmada" | "pendiente" | "cancelada">("todas");
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{ date?: Date; time?: string }>({});
  const [focusedAppointmentId, setFocusedAppointmentId] = useState<number | null>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const authHeaders = () => {
    const token = localStorage.getItem("userToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [selectedDate]);

  const now = new Date();
  const currentHour = getHours(now);
  const currentMinute = getMinutes(now);

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Deep-link desde dashboard: ?date=&appointmentId=&action=new&view=
  useEffect(() => {
    const dateStr = searchParams.get("date");
    const aptIdRaw = searchParams.get("appointmentId");
    const action = searchParams.get("action");
    const viewParam = searchParams.get("view");
    if (viewParam === "day" || viewParam === "week" || viewParam === "month") {
      setView(viewParam);
    }
    if (dateStr) {
      const parsed = new Date(`${dateStr}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        if (!viewParam) setView("day");
      }
    }
    if (aptIdRaw) {
      const id = Number(aptIdRaw);
      if (!Number.isNaN(id)) setFocusedAppointmentId(id);
    }
    if (action === "new") {
      openCreate(dateStr ? new Date(`${dateStr}T00:00:00`) : undefined);
      const next = new URLSearchParams(searchParams);
      next.delete("action");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!focusedAppointmentId || appointments.length === 0) return;
    const apt = appointments.find((a) => a.id === focusedAppointmentId);
    if (!apt) return;
    setSelectedDate(apt.date);
    setView("day");
    // Limpiar query para no re-enfatizar al navegar
    const next = new URLSearchParams(searchParams);
    if (next.has("appointmentId") || next.has("date") || next.has("patientId")) {
      next.delete("appointmentId");
      next.delete("date");
      next.delete("patientId");
      setSearchParams(next, { replace: true });
    }
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-appointment-id="${focusedAppointmentId}"]`);
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 250);
    return () => window.clearTimeout(t);
  }, [focusedAppointmentId, appointments]);

  useEffect(() => {
    // Auto-scroll hacia la hora actual / primera cita en vistas de timeline
    if (view === "month" || !gridScrollRef.current) return;
    const targetHour = Math.min(Math.max(currentHour, 8), 19);
    const row = gridScrollRef.current.querySelector(`[data-hour="${targetHour}"]`);
    if (row) {
      row.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [view, selectedDate, currentHour]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/appointments`, {
        headers: authHeaders(),
      });
      const formattedAppointments = response.data.map((apt: any) => ({
        id: apt.id,
        patientId: apt.patient_id,
        patientName: apt.patient_name,
        // Fix: Append T00:00:00 to force local time interpretation instead of UTC
        date: new Date(apt.date + "T00:00:00"),
        time: apt.time,
        duration: apt.duration,
        type: apt.type,
        status: apt.status,
        notes: apt.notes,
      }));
      setAppointments(formattedAppointments);
    } catch (error) {
      console.error("Error loading appointments:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las citas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = (date?: Date, time?: string) => {
    setCreatePrefill({ date: date ?? selectedDate, time });
    setCreateOpen(true);
  };

  const filteredAppointments = useMemo(() => {
    if (statusFilter === "todas") return appointments;
    return appointments.filter((a) => a.status === statusFilter);
  }, [appointments, statusFilter]);

  const getAppointmentsForDate = (date: Date) => {
    return filteredAppointments
      .filter((apt) => isSameDay(apt.date, date))
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const getAppointmentsForHour = (date: Date, hour: number) => {
    return getAppointmentsForDate(date).filter((apt) => parseTimeParts(apt.time).hour === hour);
  };

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const todayApts = appointments.filter((a) => isSameDay(a.date, today) && a.status !== "cancelada");
    return {
      today: todayApts.length,
      pending: appointments.filter((a) => a.status === "pendiente").length,
      confirmed: appointments.filter((a) => a.status === "confirmada").length,
      video: appointments.filter((a) => a.type === "videollamada" && a.status !== "cancelada").length,
    };
  }, [appointments]);

  const handlePrevious = () => {
    if (view === "week") setSelectedDate(subWeeks(selectedDate, 1));
    else if (view === "day") setSelectedDate(addDays(selectedDate, -1));
    else setSelectedDate(subMonths(selectedDate, 1));
  };

  const handleNext = () => {
    if (view === "week") setSelectedDate(addWeeks(selectedDate, 1));
    else if (view === "day") setSelectedDate(addDays(selectedDate, 1));
    else setSelectedDate(addMonths(selectedDate, 1));
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleCancelAppointment = async () => {
    if (!appointmentToCancel) return;
    const id = appointmentToCancel.id;

    try {
      await axios.patch(
        `${API_URL}/appointments/${id}/status`,
        { status: "cancelada" },
        { headers: authHeaders() }
      );

      setAppointments((prev) =>
        prev.map((apt) => (apt.id === id ? { ...apt, status: "cancelada" as const } : apt))
      );
      setAppointmentToCancel(null);

      toast({
        title: "Cita cancelada",
        description: "La cita ha sido cancelada correctamente.",
      });
    } catch (error) {
      console.error("Error canceling appointment:", error);
      toast({
        title: "Error",
        description: "No se pudo cancelar la cita",
        variant: "destructive",
      });
    }
  };

  const handleConfirmAppointment = async (id: number) => {
    try {
      await axios.patch(
        `${API_URL}/appointments/${id}/status`,
        { status: "confirmada" },
        { headers: authHeaders() }
      );

      setAppointments((prev) =>
        prev.map((apt) => (apt.id === id ? { ...apt, status: "confirmada" as const } : apt))
      );

      toast({
        title: "Cita confirmada",
        description: "La cita ha sido confirmada correctamente.",
      });
    } catch (error) {
      console.error("Error confirming appointment:", error);
      toast({
        title: "Error",
        description: "No se pudo confirmar la cita",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAppointment = async () => {
    if (!appointmentToDelete) return;
    const id = appointmentToDelete.id;

    try {
      await axios.delete(`${API_URL}/appointments/${id}`, {
        headers: authHeaders(),
      });

      setAppointments((prev) => prev.filter((apt) => apt.id !== id));
      setAppointmentToDelete(null);

      toast({
        title: "Cita eliminada",
        description: "La cita ha sido eliminada correctamente.",
      });
    } catch (error) {
      console.error("Error deleting appointment:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la cita",
        variant: "destructive",
      });
    }
  };

  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => (
    <div
      data-appointment-id={appointment.id}
      className={`group relative overflow-hidden rounded-2xl border bg-card p-3.5 shadow-sm transition-all hover:shadow-md border-l-4 ${statusBar[appointment.status] || statusBar.pendiente} ${
        focusedAppointmentId === appointment.id
          ? "ring-2 ring-primary/50 shadow-md bg-primary/[0.04]"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate leading-tight">{appointment.patientName}</p>
              <Badge
                variant="outline"
                className={`mt-1 rounded-full text-[10px] capitalize px-2 py-0 ${statusStyles[appointment.status]}`}
              >
                {appointment.status}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pl-0.5">
            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
              <Clock className="h-3 w-3 text-primary" />
              {appointment.time}
              <span className="text-muted-foreground font-normal">· {appointment.duration}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              {appointment.type === "videollamada" ? (
                <Video className="h-3 w-3 text-sky-500" />
              ) : (
                <MapPin className="h-3 w-3 text-emerald-500" />
              )}
              {appointment.type === "videollamada" ? "Videollamada" : "Presencial"}
            </span>
          </div>
          {appointment.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
              {appointment.notes}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {appointment.status === "pendiente" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 rounded-full text-xs border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
                onClick={() => handleConfirmAppointment(appointment.id)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Confirmar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-full text-xs"
              onClick={() => navigate(`/patients?patientId=${appointment.patientId}`)}
            >
              <User className="h-3.5 w-3.5 mr-1" />
              Abrir ficha
            </Button>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full opacity-60 group-hover:opacity-100 shrink-0"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl">
            {appointment.status === "pendiente" && (
              <DropdownMenuItem onClick={() => handleConfirmAppointment(appointment.id)}>
                <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                Confirmar cita
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() =>
                toast({
                  title: appointment.patientName,
                  description: `${format(appointment.date, "PPP", { locale: es })} · ${appointment.time} · ${appointment.type}`,
                })
              }
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              Ver detalles
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/patients?patientId=${appointment.patientId}`)}>
              <User className="mr-2 h-4 w-4" />
              Abrir ficha paciente
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/progress?patientId=${appointment.patientId}`)}>
              <User className="mr-2 h-4 w-4" />
              Registrar progreso
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {appointment.status !== "cancelada" && (
              <DropdownMenuItem
                className="text-amber-700 focus:text-amber-700 dark:text-amber-400"
                onClick={() => setAppointmentToCancel(appointment)}
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar cita
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setAppointmentToDelete(appointment)}
            >
              Eliminar cita
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const dayAppointments = getAppointmentsForDate(selectedDate);

  return (
    <AdminLayout>
      <LoadingGate loading={loading} message="Cargando citas">
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-sky-500/5 p-5 sm:p-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-sky-500/10 blur-2xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20">
                <CalendarIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Citas</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Agenda semanal y mensual de consultas
                  {appointments.length > 0 && (
                    <span className="font-medium text-foreground/80"> · {appointments.length} totales</span>
                  )}
                </p>
              </div>
            </div>
            <NewAppointmentDialog onAppointmentCreated={fetchAppointments}>
              <Button className="rounded-full shadow-md hover:shadow-lg transition-shadow shrink-0 gap-2">
                <Plus className="h-4 w-4" />
                Nueva cita
              </Button>
            </NewAppointmentDialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={handleToday}
            className="rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/30"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Hoy</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{stats.today}</p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "pendiente" ? "todas" : "pendiente")}
            className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${
              statusFilter === "pendiente" ? "ring-2 ring-amber-500/30 border-amber-500/30" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-500/10 p-2.5">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{stats.pending}</p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "confirmada" ? "todas" : "confirmada")}
            className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${
              statusFilter === "confirmada" ? "ring-2 ring-emerald-500/30 border-emerald-500/30" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Confirmadas</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{stats.confirmed}</p>
              </div>
            </div>
          </button>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-sky-500/10 p-2.5">
                <Video className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Videollamadas</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{stats.video}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={handlePrevious}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-10 rounded-xl px-4" onClick={handleToday}>
                  Hoy
                </Button>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={handleNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="ml-1 sm:ml-2">
                  <p className="text-base sm:text-lg font-semibold tracking-tight capitalize">
                    {view === "week"
                      ? `${format(weekStart, "d MMM", { locale: es })} – ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}`
                      : view === "day"
                        ? format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })
                        : format(selectedDate, "MMMM yyyy", { locale: es })}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5 mr-1">
                  {(["todas", "pendiente", "confirmada", "cancelada"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize border transition-all ${
                        statusFilter === s
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <Tabs value={view} onValueChange={(v) => setView(v as "month" | "week" | "day")}>
                  <TabsList className="h-10 p-1 rounded-xl bg-muted/70">
                    <TabsTrigger value="day" className="rounded-lg gap-1.5 px-3 data-[state=active]:shadow-sm">
                      <Rows3 className="h-3.5 w-3.5 hidden sm:inline" />
                      Día
                    </TabsTrigger>
                    <TabsTrigger value="week" className="rounded-lg gap-1.5 px-3 data-[state=active]:shadow-sm">
                      <CalendarDays className="h-3.5 w-3.5 hidden sm:inline" />
                      Semana
                    </TabsTrigger>
                    <TabsTrigger value="month" className="rounded-lg gap-1.5 px-3 data-[state=active]:shadow-sm">
                      <LayoutGrid className="h-3.5 w-3.5 hidden sm:inline" />
                      Mes
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Views */}
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          {/* Main Calendar */}
          <Card className="rounded-2xl border-border/80 shadow-sm overflow-hidden min-w-0">
            <CardContent className="p-0">
              {view === "month" ? (
                <div className="p-3 sm:p-4">
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                      <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground py-2">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 auto-rows-fr">
                    {monthDays.map((day) => {
                      const dayApts = getAppointmentsForDate(day);
                      const inMonth = isSameMonth(day, selectedDate);
                      const selected = isSameDay(day, selectedDate);
                      const today = isToday(day);
                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => {
                            setSelectedDate(day);
                          }}
                          onDoubleClick={() => {
                            setSelectedDate(day);
                            setView("day");
                          }}
                          className={`min-h-[88px] sm:min-h-[110px] rounded-xl border p-1.5 sm:p-2 text-left transition-all hover:border-primary/40 hover:shadow-sm ${
                            selected
                              ? "border-primary/40 bg-primary/5 ring-2 ring-primary/20"
                              : today
                                ? "border-primary/25 bg-primary/[0.03]"
                                : "border-border/60 bg-card"
                          } ${!inMonth ? "opacity-40" : ""}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`h-7 w-7 flex items-center justify-center rounded-full text-sm font-semibold ${
                                today
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : selected
                                    ? "bg-primary/15 text-primary"
                                    : "text-foreground"
                              }`}
                            >
                              {format(day, "d")}
                            </span>
                            {dayApts.length > 0 && (
                              <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px] tabular-nums">
                                {dayApts.length}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1 hidden sm:block">
                            {dayApts.slice(0, 3).map((apt) => (
                              <div
                                key={apt.id}
                                className={`truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium border-l-2 ${
                                  apt.status === "confirmada"
                                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-200"
                                    : apt.status === "pendiente"
                                      ? "bg-amber-500/10 border-amber-500 text-amber-800 dark:text-amber-200"
                                      : "bg-rose-500/10 border-rose-500 text-rose-800 dark:text-rose-200"
                                }`}
                                title={`${apt.time} ${apt.patientName}`}
                              >
                                <span className="opacity-70">{apt.time}</span> {apt.patientName}
                              </div>
                            ))}
                            {dayApts.length > 3 && (
                              <p className="text-[10px] text-muted-foreground pl-1">+{dayApts.length - 3} más</p>
                            )}
                          </div>
                          <div className="flex gap-0.5 sm:hidden mt-1 justify-center">
                            {dayApts.slice(0, 4).map((apt) => (
                              <span key={apt.id} className={`h-1.5 w-1.5 rounded-full ${statusDot[apt.status]}`} />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <p>Doble clic en un día para abrir la vista diaria</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full h-8"
                      onClick={() => {
                        setView("day");
                      }}
                    >
                      Ver día seleccionado
                    </Button>
                  </div>
                </div>
              ) : view === "week" ? (
                <div className="overflow-hidden flex flex-col">
                  {/* Sticky week header */}
                  <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] sm:grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b bg-muted/40 sticky top-0 z-10">
                    <div className="p-2 sm:p-3 border-r flex items-end justify-center pb-3">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    {weekDays.map((day) => {
                      const count = getAppointmentsForDate(day).length;
                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => {
                            setSelectedDate(day);
                            setView("day");
                          }}
                          className={`p-2 sm:p-3 text-center border-r last:border-r-0 transition-colors ${
                            isSameDay(day, selectedDate)
                              ? "bg-primary/10"
                              : isToday(day)
                                ? "bg-primary/5"
                                : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {format(day, "EEE", { locale: es })}
                          </div>
                          <div
                            className={`mt-1 text-base sm:text-lg font-bold h-8 w-8 mx-auto flex items-center justify-center rounded-full ${
                              isToday(day)
                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                                : isSameDay(day, selectedDate)
                                  ? "bg-primary/15 text-primary"
                                  : "text-foreground"
                            }`}
                          >
                            {format(day, "d")}
                          </div>
                          {count > 0 && (
                            <div className="mt-1 text-[10px] font-semibold text-muted-foreground tabular-nums">
                              {count} cita{count !== 1 ? "s" : ""}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div ref={gridScrollRef} className="max-h-[min(70vh,680px)] overflow-y-auto relative">
                    {/* Current time line across today column would be complex; draw full-width in day column height via absolute per row */}
                    {hourSlots.map((hour) => (
                      <div
                        key={hour}
                        data-hour={hour}
                        className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] sm:grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b last:border-b-0 min-h-[76px]"
                      >
                        <div className="p-2 text-[11px] font-semibold text-muted-foreground border-r text-center pt-2 bg-muted/10 sticky left-0 z-[1]">
                          {formatHour(hour)}
                        </div>
                        {weekDays.map((day) => {
                          const hourApts = getAppointmentsForHour(day, hour);
                          const isNowHour = isToday(day) && currentHour === hour;
                          return (
                            <div
                              key={`${day.toISOString()}-${hour}`}
                              className={`relative group/cell p-1 border-r last:border-r-0 min-h-[76px] ${
                                isSameDay(day, selectedDate)
                                  ? "bg-primary/[0.04]"
                                  : isToday(day)
                                    ? "bg-primary/[0.02]"
                                    : ""
                              } ${isNowHour ? "ring-1 ring-inset ring-primary/20" : ""}`}
                            >
                              {isNowHour && (
                                <div
                                  className="absolute left-0 right-0 z-[2] pointer-events-none"
                                  style={{ top: `${(currentMinute / 60) * 100}%` }}
                                >
                                  <div className="h-0.5 bg-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.5)]" />
                                </div>
                              )}
                              <div className="space-y-1">
                                {hourApts.map((appointment) => (
                                  <button
                                    key={appointment.id}
                                    type="button"
                                    className={`w-full text-left px-1.5 py-1 rounded-lg text-[10px] sm:text-xs cursor-pointer transition-all hover:scale-[1.01] shadow-sm ${
                                      slotStyles[appointment.status] || slotStyles.pendiente
                                    }`}
                                    onClick={() => setSelectedDate(day)}
                                  >
                                    <div className="font-semibold truncate leading-tight">{appointment.patientName}</div>
                                    <div className="opacity-80 flex items-center gap-1 mt-0.5">
                                      <span className="tabular-nums">{appointment.time}</span>
                                      {appointment.type === "videollamada" ? (
                                        <Video className="h-3 w-3" />
                                      ) : (
                                        <MapPin className="h-3 w-3" />
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                              {hourApts.length === 0 && (
                                <button
                                  type="button"
                                  onClick={() => openCreate(day, formatHour(hour))}
                                  className="absolute inset-1 rounded-lg opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center justify-center border border-dashed border-primary/30 bg-primary/[0.03] text-primary text-[10px] font-medium"
                                >
                                  <Plus className="h-3.5 w-3.5 mr-0.5" />
                                  Agregar
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Day view */
                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
                    <div>
                      <p className="text-sm font-semibold capitalize">
                        {format(selectedDate, "EEEE d MMMM", { locale: es })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dayAppointments.length} cita{dayAppointments.length !== 1 ? "s" : ""} · clic en un horario vacío para agendar
                      </p>
                    </div>
                    <Button size="sm" className="rounded-full" onClick={() => openCreate(selectedDate)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Nueva
                    </Button>
                  </div>
                  <div ref={gridScrollRef} className="max-h-[min(70vh,680px)] overflow-y-auto">
                    {hourSlots.map((hour) => {
                      const hourApts = getAppointmentsForHour(selectedDate, hour);
                      const isNowHour = isToday(selectedDate) && currentHour === hour;
                      return (
                        <div
                          key={hour}
                          data-hour={hour}
                          className={`grid grid-cols-[72px_1fr] border-b last:border-b-0 min-h-[88px] ${
                            isNowHour ? "bg-primary/[0.03]" : ""
                          }`}
                        >
                          <div className="p-3 text-xs font-semibold text-muted-foreground border-r text-right bg-muted/10">
                            {formatHour(hour)}
                          </div>
                          <div className="relative p-2 space-y-2">
                            {isNowHour && (
                              <div
                                className="absolute left-0 right-0 z-[2] pointer-events-none flex items-center"
                                style={{ top: `${(currentMinute / 60) * 100}%` }}
                              >
                                <span className="h-2 w-2 rounded-full bg-rose-500 -ml-1" />
                                <div className="h-0.5 flex-1 bg-rose-500/80" />
                              </div>
                            )}
                            {hourApts.length > 0 ? (
                              hourApts.map((apt) => (
                                <div
                                  key={apt.id}
                                  data-appointment-id={apt.id}
                                  className={`rounded-xl border p-3 shadow-sm border-l-4 ${statusBar[apt.status]} bg-card ${
                                    focusedAppointmentId === apt.id
                                      ? "ring-2 ring-primary/50 bg-primary/[0.04]"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-sm">{apt.patientName}</p>
                                        <Badge variant="outline" className={`rounded-full text-[10px] capitalize ${statusStyles[apt.status]}`}>
                                          {apt.status}
                                        </Badge>
                                      </div>
                                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                        <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                                          <Clock className="h-3.5 w-3.5 text-primary" />
                                          {apt.time} · {apt.duration}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                          {apt.type === "videollamada" ? (
                                            <Video className="h-3.5 w-3.5 text-sky-500" />
                                          ) : (
                                            <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                          )}
                                          {apt.type === "videollamada" ? "Videollamada" : "Presencial"}
                                        </span>
                                      </div>
                                      {apt.notes && (
                                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{apt.notes}</p>
                                      )}
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="rounded-xl">
                                        {apt.status === "pendiente" && (
                                          <DropdownMenuItem onClick={() => handleConfirmAppointment(apt.id)}>
                                            Confirmar
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem onClick={() => navigate(`/progress?patientId=${apt.patientId}`)}>
                                          Registrar progreso
                                        </DropdownMenuItem>
                                        {apt.status !== "cancelada" && (
                                          <DropdownMenuItem onClick={() => setAppointmentToCancel(apt)}>
                                            Cancelar
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => setAppointmentToDelete(apt)}
                                        >
                                          Eliminar
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <button
                                type="button"
                                onClick={() => openCreate(selectedDate, formatHour(hour))}
                                className="w-full h-full min-h-[64px] rounded-xl border border-dashed border-muted-foreground/20 text-muted-foreground text-sm hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Plus className="h-4 w-4" />
                                Agendar a las {formatHour(hour)}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="rounded-2xl border-border/80 shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary via-sky-500/70 to-transparent" />
              <CardHeader className="pb-3 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold tracking-tight capitalize">
                      {format(selectedDate, "EEEE, d MMMM", { locale: es })}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {dayAppointments.length} cita{dayAppointments.length !== 1 ? "s" : ""} este día
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-full h-8 shrink-0" onClick={() => setView("day")}>
                    Timeline
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {dayAppointments.length > 0 ? (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-0.5">
                    {dayAppointments.map((apt) => (
                      <AppointmentCard key={apt.id} appointment={apt} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed bg-muted/20">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                      <CalendarIcon className="h-7 w-7 text-primary" />
                    </div>
                    <p className="font-medium text-foreground">Sin citas este día</p>
                    <p className="text-sm text-muted-foreground mb-3">Agenda una consulta</p>
                    <Button size="sm" className="rounded-full" onClick={() => openCreate(selectedDate)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Programar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Resumen del día</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="flex justify-between items-center rounded-xl bg-muted/40 px-3 py-2.5 ring-1 ring-border/50">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <Badge variant="secondary" className="rounded-full tabular-nums">
                    {dayAppointments.length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center rounded-xl bg-emerald-500/5 px-3 py-2.5 ring-1 ring-emerald-500/15">
                  <span className="text-sm text-muted-foreground">Confirmadas</span>
                  <Badge className={`rounded-full tabular-nums border ${statusStyles.confirmada}`}>
                    {dayAppointments.filter((a) => a.status === "confirmada").length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center rounded-xl bg-amber-500/5 px-3 py-2.5 ring-1 ring-amber-500/15">
                  <span className="text-sm text-muted-foreground">Pendientes</span>
                  <Badge className={`rounded-full tabular-nums border ${statusStyles.pendiente}`}>
                    {dayAppointments.filter((a) => a.status === "pendiente").length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center rounded-xl bg-sky-500/5 px-3 py-2.5 ring-1 ring-sky-500/15">
                  <span className="text-sm text-muted-foreground">Videollamadas</span>
                  <Badge variant="outline" className="rounded-full tabular-nums">
                    {dayAppointments.filter((a) => a.type === "videollamada").length}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-2xl border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground text-sm">Leyenda</p>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Confirmada</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Pendiente</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Cancelada</div>
              <div className="flex items-center gap-2 pt-1"><span className="h-0.5 w-4 bg-rose-500 rounded" /> Hora actual</div>
            </div>
          </div>
        </div>
      </div>
      </LoadingGate>

      <NewAppointmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialDate={createPrefill.date}
        initialTime={createPrefill.time}
        onAppointmentCreated={fetchAppointments}
      />

      <AlertDialog open={!!appointmentToDelete} onOpenChange={(open) => !open && setAppointmentToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cita?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar la cita de <strong>{appointmentToDelete?.patientName}</strong>
              {appointmentToDelete && (
                <>
                  {" "}
                  del {format(appointmentToDelete.date, "PPP", { locale: es })} a las {appointmentToDelete.time}.
                </>
              )}{" "}
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAppointment}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar cita
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!appointmentToCancel} onOpenChange={(open) => !open && setAppointmentToCancel(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar cita?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a cancelar la cita de <strong>{appointmentToCancel?.patientName}</strong>
              {appointmentToCancel && (
                <>
                  {" "}
                  del {format(appointmentToCancel.date, "PPP", { locale: es })} a las {appointmentToCancel.time}.
                </>
              )}{" "}
              El paciente podrá verla como cancelada en su historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelAppointment}
              className="rounded-full bg-amber-600 text-white hover:bg-amber-700"
            >
              Cancelar cita
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}