import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, User, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PatientDetailsDialog } from "./PatientDetailsDialog";
import { PatientActionsDropdown } from "./PatientActionsDropdown";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";

interface RecentPatient {
  id: number;
  name: string;
  nombres?: string;
  apellidos?: string;
  avatar: string | null;
  foto_perfil?: string | null;
  email: string;
  telefono?: string | null;
  plan: string;
  status: string;
  joined: string;
  registered_at: string | null;
  role?: string;
  peso_actual?: number | null;
  peso_objetivo?: number | null;
  nivel_actividad?: string | null;
  progreso?: number;
  proxima_cita?: string;
  altura?: number | null;
  edad_formateada?: string | null;
  evaluacion_nutricional?: string | null;
  frecuencia_consumo?: any[] | null;
  alergias?: string[] | string | null;
  preferencias?: string[] | string | null;
  objetivos_salud?: string | null;
  condiciones_medicas?: string | null;
  alimentos_disgusto?: string | null;
  antecedentes_familiares?: string | null;
  direccion?: string | null;
}

interface PatientDetails {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  foto_perfil: string | null;
  status: string;
  role: string;
  peso_actual: number | null;
  peso_objetivo: number | null;
  nivel_actividad: string | null;
  progreso: number;
  proxima_cita: string;
  altura: number | null;
  edad_formateada: string | null;
  evaluacion_nutricional: string | null;
  frecuencia_consumo: any[] | null;
  direccion?: string | null;
  alergias?: string[] | string | null;
  preferencias?: string[] | string | null;
  objetivos_salud?: string | null;
  condiciones_medicas?: string | null;
  alimentos_disgusto?: string | null;
  antecedentes_familiares?: string | null;
}

interface RecentPatientsProps {
  patients?: RecentPatient[];
  loading?: boolean;
  onRefresh?: () => void;
}

const statusStyles = {
  activo: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  pendiente: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
  inactivo: "bg-muted text-muted-foreground border-border",
};

function mapRecentToDetails(patient: RecentPatient): PatientDetails {
  const nameParts = (patient.name || "").trim().split(/\s+/);
  const nombres = patient.nombres || nameParts[0] || "";
  const apellidos =
    patient.apellidos ||
    (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");

  return {
    id: patient.id,
    nombres,
    apellidos,
    email: patient.email,
    telefono: patient.telefono ?? null,
    foto_perfil: patient.foto_perfil ?? patient.avatar,
    status: patient.status || "activo",
    role: patient.role || "patient",
    peso_actual: patient.peso_actual ?? null,
    peso_objetivo: patient.peso_objetivo ?? null,
    nivel_actividad: patient.nivel_actividad ?? null,
    progreso: patient.progreso ?? 0,
    proxima_cita: patient.proxima_cita || "Sin cita",
    altura: patient.altura ?? null,
    edad_formateada: patient.edad_formateada ?? null,
    evaluacion_nutricional: patient.evaluacion_nutricional ?? null,
    frecuencia_consumo: patient.frecuencia_consumo ?? null,
    direccion: patient.direccion ?? null,
    alergias: patient.alergias ?? [],
    preferencias: patient.preferencias ?? [],
    objetivos_salud: patient.objetivos_salud ?? null,
    condiciones_medicas: patient.condiciones_medicas ?? null,
    alimentos_disgusto: patient.alimentos_disgusto ?? null,
    antecedentes_familiares: patient.antecedentes_familiares ?? null,
  };
}

export function RecentPatients({ patients = [], loading = false, onRefresh }: RecentPatientsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPatient, setSelectedPatient] = useState<PatientDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handleViewAll = () => {
    navigate("/patients");
  };

  const handlePatientClick = async (patient: RecentPatient) => {
    setLoadingDetails(true);
    setDetailsOpen(true);
    setSelectedPatient(mapRecentToDetails(patient));

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${patient.id}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedPatient(data);
      }
    } catch (error) {
      console.error("Error loading patient details:", error);
      toast({
        title: "Aviso",
        description: "Se muestran datos parciales del paciente",
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  // Estado de carga
  if (loading) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card/90 shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-br from-card to-primary/[0.03] p-5">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Pacientes Recientes</h3>
            <p className="text-sm text-muted-foreground">Últimas actualizaciones</p>
          </div>
        </div>
        <div className="divide-y divide-border/60">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted"></div>
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-muted rounded"></div>
                  <div className="h-3 w-24 bg-muted rounded"></div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-6 w-16 bg-muted rounded"></div>
                <div className="h-3 w-20 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-border/80 bg-card/90 shadow-card overflow-hidden backdrop-blur-sm h-full">
        <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.04] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">Pacientes Recientes</h3>
              <p className="text-sm text-muted-foreground">Últimas actualizaciones</p>
            </div>
          </div>
          <button
            onClick={handleViewAll}
            className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="divide-y divide-border/60">
          {patients.length > 0 ? (
            patients.map((patient, index) => (
              <div
                key={patient.id}
                className="group flex items-center justify-between gap-3 p-4 transition-all hover:bg-muted/35 animate-fade-in cursor-pointer"
                style={{ animationDelay: `${index * 80}ms` }}
                onClick={() => handlePatientClick(patient)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-11 w-11 border-2 border-background shadow-sm ring-1 ring-border/60">
                    <AvatarImage src={patient.avatar || patient.foto_perfil || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {patient.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {patient.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{patient.plan}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={`capitalize text-[10px] ${statusStyles[patient.status as keyof typeof statusStyles] || statusStyles.activo}`}
                  >
                    {patient.status}
                  </Badge>
                  <span className="hidden sm:inline text-[11px] text-muted-foreground">{patient.joined}</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <PatientActionsDropdown
                      patient={patient}
                      onViewDetails={() => handlePatientClick(patient)}
                      onUpdate={onRefresh}
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-14 px-4">
              <div className="w-14 h-14 rounded-2xl bg-muted/70 flex items-center justify-center mb-3 ring-1 ring-border/50">
                <User className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground text-sm">No hay pacientes recientes</p>
              <p className="text-muted-foreground text-xs mt-1">Los nuevos registros aparecerán aquí</p>
            </div>
          )}
        </div>
      </div>

      <PatientDetailsDialog
        patient={selectedPatient}
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setSelectedPatient(null);
        }}
        onUpdate={onRefresh}
        onEdit={() => {
          if (selectedPatient) {
            navigate(`/patients?patientId=${selectedPatient.id}&action=edit`);
          }
        }}
        onViewPlans={() => {
          if (selectedPatient) {
            navigate(`/patients?patientId=${selectedPatient.id}&action=plans`);
          }
        }}
        onClinicalHistory={() => {
          if (selectedPatient) {
            navigate(`/patients?patientId=${selectedPatient.id}&action=clinical`);
          }
        }}
      />

      {loadingDetails && detailsOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border bg-background px-3 py-2 text-xs shadow-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Cargando detalle...
        </div>
      )}
    </>
  );
}
