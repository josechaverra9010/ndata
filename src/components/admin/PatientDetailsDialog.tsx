import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/config/api";
import { resolveMediaUrl } from "@/lib/media";
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Activity,
  Target,
  AlertCircle,
  Heart,
  Apple,
  FileText,
  Edit,
  Trash2,
  Clock,
  Plus,
  Loader2,
  Camera,
  TrendingUp,
  MessageSquare,
  RotateCcw,
} from "lucide-react";
import { Recordatorio24hForm } from "./Recordatorio24hForm";
import { useToast } from "@/hooks/use-toast";
import { formatInColombia, formatDateTimeInColombia } from "@/lib/timezone";
import {
  BIO_HEMOGRAMA,
  BIO_LIPIDOS,
  BIO_OTROS,
  normalizeBioquimicos,
} from "@/components/shared/BioquimicosForm";
import { DeletePatientDialog } from "@/components/admin/DeletePatientDialog";

const formatListOrText = (value: string[] | string | null | undefined) => {
  if (value == null || value === "") return "No registrado";
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "No registrado";
  }
  return String(value);
};

const getFrequencyLabel = (freqId: string) => {
  if (!freqId) return "No registrado";
  if (freqId === "never") return "Nunca o casi nunca";
  if (freqId.startsWith("month_")) return `Al mes: ${freqId.split("_")[1]}`;
  if (freqId.startsWith("week_")) return `A la semana: ${freqId.split("_")[1]}`;
  if (freqId.startsWith("day_")) {
    const val = freqId.split("_")[1];
    return `Al día: ${val === "6" ? "≥ 6" : val}`;
  }
  return freqId; // Soporte para datos antiguos o manuales
};

const RecallDetailTable = ({ data, title }: { data: any, title: string }) => {
  let parsed = null;
  try {
    if (typeof data === "string" && data.startsWith("[")) {
      parsed = JSON.parse(data);
    }
  } catch (e) {
    parsed = null;
  }

  if (!parsed || !Array.isArray(parsed) || parsed.every(row => !row.prep && !row.ingredients && !row.qty && !row.measure)) {
    if (typeof data === "string" && !data.startsWith("[")) {
      return (
        <div className="p-2 rounded bg-muted/50">
          <p className="font-bold text-xs uppercase text-muted-foreground mb-1">{title}</p>
          <p>{data}</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="md:col-span-2 overflow-x-auto border rounded bg-muted/20 mt-2">
      <table className="w-full text-[10px] border-collapse">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th colSpan={3} className="p-1 px-2 text-left font-bold uppercase text-primary/70">{title}</th>
          </tr>
          <tr className="bg-muted/30">
            <th className="p-1 border-r text-left font-semibold">PREPARACIÓN</th>
            <th className="p-1 border-r text-left font-semibold">INGREDIENTES</th>
            <th className="p-1 text-center font-semibold w-[60px]">QTY (g)</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {parsed.map((row: any, i: number) => (
            (row.prep || row.ingredients || row.qty) ? (
              <tr key={i}>
                <td className="p-1 border-r">{row.prep}</td>
                <td className="p-1 border-r">{row.ingredients}</td>
                <td className="p-1 text-center">{row.qty}</td>
              </tr>
            ) : null
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface Patient {
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
  acompanante_nombre?: string | null;
  acompanante_parentesco?: string | null;
  acompanante_telefono?: string | null;
  acompanante_email?: string | null;
  acompanante_documento?: string | null;
  acompanante_observaciones?: string | null;
  programa_eps?: string | null;
  examenes_bioquimicos?: Record<string, string> | null;
  deleted_at?: string | null;
}

interface PatientDetailsDialogProps {
  patient: Patient | null; // Permitimos null para evitar errores externos
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
  onEdit?: () => void;
  onViewPlans?: () => void;
  onClinicalHistory?: () => void;
  /** Vista desde papelera: mostrar recuperar / eliminar definitivo */
  inTrash?: boolean;
}

const statusStyles: Record<string, string> = {
  activo: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
  pendiente: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25",
  inactivo: "bg-muted text-muted-foreground border-border",
};

const statusDot: Record<string, string> = {
  activo: "bg-emerald-500",
  pendiente: "bg-amber-500",
  inactivo: "bg-muted-foreground/50",
};

export function PatientDetailsDialog({
  patient,
  open,
  onOpenChange,
  onUpdate,
  onEdit,
  onViewPlans,
  onClinicalHistory,
  inTrash = false,
}: PatientDetailsDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [recalls, setRecalls] = useState<any[]>([]);
  const [loadingRecalls, setLoadingRecalls] = useState(false);
  const [showRecallForm, setShowRecallForm] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    setAvatarUrl(patient?.foto_perfil || null);
  }, [patient?.id, patient?.foto_perfil, open]);

  // SOLUCIÓN AL ERROR: Si no hay paciente, no renderizamos nada para evitar el crash
  if (!patient) return null;

  // Función para obtener las iniciales del paciente
  const getInitials = (nombres: string, apellidos: string) => {
    return `${nombres?.[0] || ''}${apellidos?.[0] || ''}`.toUpperCase();
  };

  // Función para formatear fechas de forma segura
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "No especificado";
    if (dateString === "Sin cita" || dateString === "Sin programar") return "Sin cita";
    if (dateString.includes(":")) {
      return formatDateTimeInColombia(dateString) || dateString;
    }
    return formatInColombia(dateString, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }) || dateString;
  };

  const fetchRecalls = async () => {
    try {
      setLoadingRecalls(true);
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${patient.id}/recalls`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (!response.ok) throw new Error("Error fetching recalls");
      const data = await response.json();
      setRecalls(data);
    } catch (error) {
      console.error("Error fetching recalls:", error);
    } finally {
      setLoadingRecalls(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: "La imagen no puede superar 2MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingAvatar(true);
      const token = localStorage.getItem("userToken");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_URL}/patient/${patient.id}/upload-avatar`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.detail || "No se pudo subir la foto");
      }
      setAvatarUrl(result.foto_url);
      toast({
        title: "Foto actualizada",
        description: "La foto de perfil del paciente se guardó correctamente",
      });
      onUpdate?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "No se pudo subir la foto",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <div className="sticky top-0 z-10 border-b bg-gradient-to-br from-background via-background to-primary/[0.04] px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className="sr-only">
                {patient.nombres} {patient.apellidos}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Información detallada del paciente
              </DialogDescription>
              <div className="w-full flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-16 w-16 border-2 border-primary/15 shadow-sm">
                      <AvatarImage src={resolveMediaUrl(avatarUrl)} alt={`${patient.nombres} ${patient.apellidos}`} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                        {getInitials(patient.nombres, patient.apellidos)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${statusDot[patient.status] || statusDot.activo}`}
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute -bottom-1 -left-1 h-7 w-7 rounded-full shadow border"
                      disabled={uploadingAvatar}
                      onClick={() => fileInputRef.current?.click()}
                      title="Cambiar foto"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Camera className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-lg tracking-tight truncate">
                        {patient.nombres} {patient.apellidos}
                      </span>
                      <Badge
                        variant="outline"
                        className={`capitalize text-[11px] ${statusStyles[patient.status] || statusStyles.activo}`}
                      >
                        {patient.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Badge
                        variant="secondary"
                        className="bg-primary/5 text-primary border-primary/10 text-[10px] uppercase font-bold tracking-wide"
                      >
                        {patient.edad_formateada || "Edad no registrada"}
                      </Badge>
                      {patient.email && (
                        <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {patient.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-primary/20 hover:bg-primary/5 hover:text-primary"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/progress?patientId=${patient.id}`);
                    }}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Progreso
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-primary/20 hover:bg-primary/5 hover:text-primary"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/messages?patientId=${patient.id}`);
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Mensajes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-primary/20 hover:bg-primary/5 hover:text-primary"
                    onClick={() => {
                      onOpenChange(false);
                      onClinicalHistory?.();
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Historia clínica
                  </Button>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 py-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 gap-1 h-auto p-1 bg-muted/60 rounded-xl">
              <TabsTrigger value="general" className="rounded-lg text-xs sm:text-sm data-[state=active]:shadow-sm">General</TabsTrigger>
              <TabsTrigger value="health" className="rounded-lg text-xs sm:text-sm data-[state=active]:shadow-sm">Salud</TabsTrigger>
              <TabsTrigger value="bioquimico" className="rounded-lg text-xs sm:text-sm data-[state=active]:shadow-sm">Bioquímico</TabsTrigger>
              <TabsTrigger value="evaluacion" className="rounded-lg text-xs sm:text-sm data-[state=active]:shadow-sm">Evaluación</TabsTrigger>
              <TabsTrigger value="frecuencia" className="rounded-lg text-xs sm:text-sm data-[state=active]:shadow-sm">Frecuencia</TabsTrigger>
              <TabsTrigger value="recuerdos" className="rounded-lg text-xs sm:text-sm data-[state=active]:shadow-sm" onClick={fetchRecalls}>Recordatorio</TabsTrigger>
              <TabsTrigger value="plans" className="rounded-lg text-xs sm:text-sm data-[state=active]:shadow-sm">Planes</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
                      <p className="text-sm mt-0.5 truncate">{patient.email}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Teléfono</p>
                      <p className="text-sm mt-0.5">{patient.telefono || "No registrado"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ID del sistema</p>
                      <p className="text-sm mt-0.5">#{patient.id}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dirección</p>
                      <p className="text-sm mt-0.5">{patient.direccion || "No registrada"}</p>
                    </div>
                  </div>

                  {(patient.acompanante_nombre || patient.acompanante_telefono) && (
                    <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors md:col-span-2">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Acompañante</p>
                        <p className="text-sm font-medium">
                          {patient.acompanante_nombre || "—"}
                          {patient.acompanante_parentesco ? ` (${patient.acompanante_parentesco})` : ""}
                        </p>
                        {patient.acompanante_telefono && (
                          <p className="text-xs text-muted-foreground">Tel: {patient.acompanante_telefono}</p>
                        )}
                        {patient.acompanante_email && (
                          <p className="text-xs text-muted-foreground">Email: {patient.acompanante_email}</p>
                        )}
                        {patient.acompanante_documento && (
                          <p className="text-xs text-muted-foreground">Doc: {patient.acompanante_documento}</p>
                        )}
                        {patient.acompanante_observaciones && (
                          <p className="text-xs text-muted-foreground">{patient.acompanante_observaciones}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {patient.programa_eps && (
                    <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors md:col-span-2">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Heart className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Programa al que pertenece a su EPS (si aplica)
                        </p>
                        <p className="text-sm font-medium whitespace-pre-wrap">{patient.programa_eps}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Próxima cita</p>
                      <p className="text-sm mt-0.5">{formatDate(patient.proxima_cita)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nivel de actividad</p>
                      <p className="text-sm mt-0.5 capitalize">{patient.nivel_actividad || "No especificado"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rol</p>
                      <p className="text-sm mt-0.5 capitalize">{patient.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="health" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Objetivos de Peso y IMC</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Peso Actual</p>
                          <p className="text-2xl font-bold">
                            {patient.peso_actual ? `${patient.peso_actual} kg` : "No registrado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Peso Objetivo</p>
                          <p className="text-2xl font-bold">
                            {patient.peso_objetivo ? `${patient.peso_objetivo} kg` : "No registrado"}
                          </p>
                        </div>
                      </div>

                      {/* IMC Display */}
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm text-muted-foreground">IMC (Índice de Masa Corporal)</p>
                          {patient.peso_actual && patient.altura && (
                            <Badge variant="outline" className={(() => {
                              const h = patient.altura > 3 ? patient.altura / 100 : patient.altura;
                              const imc = patient.peso_actual / (h * h);
                              if (imc < 18.5) return "text-blue-500 border-blue-200 bg-blue-50";
                              if (imc < 25) return "text-green-600 border-green-200 bg-green-50";
                              if (imc < 30) return "text-yellow-600 border-yellow-200 bg-yellow-50";
                              return "text-red-600 border-red-200 bg-red-50";
                            })()}>
                              {(() => {
                                const h = patient.altura > 3 ? patient.altura / 100 : patient.altura;
                                const imc = patient.peso_actual / (h * h);
                                if (imc < 18.5) return "Bajo peso";
                                if (imc < 25) return "Peso normal";
                                if (imc < 30) return "Sobrepeso";
                                return "Obesidad";
                              })()}
                            </Badge>
                          )}
                        </div>
                        <p className="text-2xl font-bold flex items-baseline gap-2">
                          {patient.peso_actual && patient.altura ? (
                            <>
                              {(() => {
                                const h = patient.altura > 3 ? patient.altura / 100 : patient.altura;
                                return (patient.peso_actual / (h * h)).toFixed(2);
                              })()}
                              <span className="text-sm font-normal text-muted-foreground">kg/m²</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">
                              {!patient.peso_actual ? "Falta peso" : "Falta altura"}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Heart className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Progreso</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Progreso Total</span>
                        <span className="text-2xl font-bold text-primary">{patient.progreso}%</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${patient.progreso}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Información clínica</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Alergias</p>
                        <p className="mt-0.5">{formatListOrText(patient.alergias)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Preferencias</p>
                        <p className="mt-0.5">{formatListOrText(patient.preferencias)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Condiciones médicas</p>
                        <p className="mt-0.5">{patient.condiciones_medicas || "No registrado"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Objetivos de salud</p>
                        <p className="mt-0.5">{patient.objetivos_salud || "No registrado"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Alimentos que no le gustan</p>
                        <p className="mt-0.5">{patient.alimentos_disgusto || "No registrado"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Antecedentes familiares</p>
                        <p className="mt-0.5">{patient.antecedentes_familiares || "No registrado"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bioquimico" className="space-y-4 mt-4">
              {(() => {
                const bio = normalizeBioquimicos(patient.examenes_bioquimicos as any);
                const groups = [
                  { title: "Hemograma y otros", rows: BIO_HEMOGRAMA },
                  { title: "Otros", rows: BIO_OTROS },
                  { title: "Perfil lipídico", rows: BIO_LIPIDOS },
                ];
                const hasAny = Object.values(bio).some((v) => String(v || "").trim());
                if (!hasAny) {
                  return (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground italic border rounded-lg">
                      <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                      <p>No hay exámenes bioquímicos registrados.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    {bio.bio_fecha_examenes && (
                      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Fecha de los exámenes</span>
                        <span className="font-medium">{bio.bio_fecha_examenes}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      {groups.map((g) => (
                        <div key={g.title} className="rounded-lg border overflow-hidden">
                          <div className="bg-muted/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                            {g.title}
                          </div>
                          <div className="divide-y">
                            {g.rows.map(({ key, analisisKey, label }) => (
                              <div key={key} className="px-3 py-2 space-y-1 text-sm">
                                <div className="grid grid-cols-[1fr_auto] gap-2">
                                  <span>{label}</span>
                                  <span className="font-medium tabular-nums">{bio[key] || "—"}</span>
                                </div>
                                {bio[analisisKey] && (
                                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                    <span className="font-medium text-foreground/80">Análisis:</span>{" "}
                                    {bio[analisisKey]}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {bio.bio_analisis && (
                      <div className="rounded-lg border p-3 text-sm">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Análisis general</p>
                        <p className="whitespace-pre-wrap">{bio.bio_analisis}</p>
                      </div>
                    )}
                    {bio.bioquimicos && (
                      <div className="rounded-lg border p-3 text-sm">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Observaciones</p>
                        <p className="whitespace-pre-wrap">{bio.bioquimicos}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="evaluacion" className="space-y-4 mt-4">
              <div className="p-4 rounded-lg border border-border bg-card min-h-[200px]">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Evaluación Nutricional</h3>
                </div>
                {patient.evaluacion_nutricional ? (
                  <div className="text-sm border rounded-md p-4 bg-muted/30 whitespace-pre-wrap leading-relaxed">
                    {patient.evaluacion_nutricional}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground italic">
                    <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                    <p>No se ha registrado una evaluación aún.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="recuerdos" className="space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Historial de Recordatorios 24h
                </h3>
                {!showRecallForm && (
                  <Button onClick={() => setShowRecallForm(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Recordatorio
                  </Button>
                )}
              </div>

              {showRecallForm ? (
                <div className="bg-muted/30 p-4 rounded-lg border border-border">
                  <Recordatorio24hForm
                    patientId={patient.id}
                    onSuccess={() => {
                      setShowRecallForm(false);
                      fetchRecalls();
                    }}
                    onCancel={() => setShowRecallForm(false)}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {loadingRecalls ? (
                    <div className="flex justify-center py-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : recalls.length > 0 ? (
                    recalls.map((recall) => (
                      <Card key={recall.id} className="border border-border">
                        <CardHeader className="py-3 px-4 bg-muted/20">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold">{formatDate(recall.date)}</span>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 text-sm space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <RecallDetailTable data={recall.desayuno} title="Desayuno" />
                            <RecallDetailTable data={recall.media_manana} title="Nueves" />
                            <RecallDetailTable data={recall.almuerzo} title="Almuerzo" />
                            <RecallDetailTable data={recall.media_tarde} title="Onces" />
                            <RecallDetailTable data={recall.cena} title="Cena" />
                            <RecallDetailTable data={recall.snack_nocturno} title="Snack Nocturno" />
                          </div>
                          {recall.observaciones && (
                            <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/10">
                              <p className="font-bold text-xs uppercase text-primary/70 mb-1">Observaciones</p>
                              <p className="italic">{recall.observaciones}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border rounded-lg border-dashed">
                      <Clock className="h-10 w-10 mb-2 opacity-20" />
                      <p>No hay recordatorios registrados para este paciente.</p>
                      <Button variant="link" onClick={() => setShowRecallForm(true)}>
                        Crear el primero
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="frecuencia" className="space-y-4 mt-4">
              <div className="rounded-md border bg-card">
                <div className="p-4 border-b">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Frecuencia de Consumo de Alimentos</h3>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left font-medium">Grupo de Alimento</th>
                        <th className="p-3 text-left font-medium">Frecuencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {patient.frecuencia_consumo && Array.isArray(patient.frecuencia_consumo) && patient.frecuencia_consumo.length > 0 ? (
                        patient.frecuencia_consumo.map((item: any) => (
                          <tr key={item.grupo}>
                            <td className="p-3 font-medium">{item.grupo}</td>
                            <td className="p-3">
                              <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10">
                                {getFrequencyLabel(item.frecuencia)}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="p-10 text-center text-muted-foreground italic">
                            No se ha registrado la frecuencia de consumo para este paciente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="plans" className="space-y-4 mt-4">
              <div className="p-6 rounded-lg border border-border bg-card text-center">
                <Apple className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Planes Nutricionales</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Consulta y gestiona los planes nutricionales asignados a este paciente
                </p>
                <Button variant="outline" onClick={() => {
                  onViewPlans?.();
                  onOpenChange(false);
                }}>
                  Ver Planes Asignados
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t">
            {inTrash || patient.deleted_at ? (
              <>
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={restoring}
                  onClick={async () => {
                    if (!patient) return;
                    setRestoring(true);
                    try {
                      const token = localStorage.getItem("userToken");
                      const response = await fetch(
                        `${API_URL}/patients/${patient.id}/restore`,
                        {
                          method: "POST",
                          headers: {
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                          },
                        }
                      );
                      const err = await response.json().catch(() => ({}));
                      if (!response.ok) {
                        throw new Error(
                          typeof err.detail === "string"
                            ? err.detail
                            : "No se pudo recuperar"
                        );
                      }
                      toast({
                        title: "Paciente recuperado",
                        description: `${patient.nombres} ${patient.apellidos} volvió a la lista activa.`,
                      });
                      onOpenChange(false);
                      onUpdate?.();
                    } catch (e: any) {
                      toast({
                        title: "Error",
                        description: e?.message || "No se pudo recuperar el paciente",
                        variant: "destructive",
                      });
                    } finally {
                      setRestoring(false);
                    }
                  }}
                >
                  {restoring ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Recuperar
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-full"
                  onClick={() => {
                    setPermanentDelete(true);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar definitivamente
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    onEdit?.();
                    onOpenChange(false);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-full"
                  onClick={() => {
                    setPermanentDelete(false);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Mover a papelera
                </Button>
              </>
            )}
          </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeletePatientDialog
        patient={patient}
        open={deleteDialogOpen}
        onOpenChange={(v) => {
          setDeleteDialogOpen(v);
          if (!v) setPermanentDelete(false);
        }}
        permanent={permanentDelete}
        onSuccess={() => {
          onOpenChange(false);
          onUpdate?.();
        }}
      />
    </>
  );
}