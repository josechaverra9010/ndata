import { useState } from "react";
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
} from "lucide-react";
import { Recordatorio24hForm } from "./Recordatorio24hForm";
import { useToast } from "@/hooks/use-toast";
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
}

interface PatientDetailsDialogProps {
  patient: Patient | null; // Permitimos null para evitar errores externos
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
  onEdit?: () => void;
  onViewPlans?: () => void;
  onClinicalHistory?: () => void;
}

const statusStyles: Record<string, string> = {
  activo: "bg-success/10 text-success border-success/20",
  pendiente: "bg-warning/10 text-warning border-warning/20",
  inactivo: "bg-muted text-muted-foreground border-muted",
};

export function PatientDetailsDialog({
  patient,
  open,
  onOpenChange,
  onUpdate,
  onEdit,
  onViewPlans,
  onClinicalHistory,
}: PatientDetailsDialogProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recalls, setRecalls] = useState<any[]>([]);
  const [loadingRecalls, setLoadingRecalls] = useState(false);
  const [showRecallForm, setShowRecallForm] = useState(false);

  // SOLUCIÓN AL ERROR: Si no hay paciente, no renderizamos nada para evitar el crash
  if (!patient) return null;

  // Función para obtener las iniciales del paciente
  const getInitials = (nombres: string, apellidos: string) => {
    return `${nombres?.[0] || ''}${apellidos?.[0] || ''}`.toUpperCase();
  };

  // Función para formatear fechas de forma segura
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "No especificado";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
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

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${patient.id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });

      if (!response.ok) {
        throw new Error("Error al eliminar paciente");
      }

      toast({
        title: "¡Éxito!",
        description: "Paciente eliminado correctamente",
      });

      setDeleteDialogOpen(false);
      onOpenChange(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error deleting patient:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el paciente",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-full flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-16 w-16 border-2 border-primary/20">
                    <AvatarImage src={patient.foto_perfil || ""} alt={`${patient.nombres} ${patient.apellidos}`} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {getInitials(patient.nombres, patient.apellidos)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{patient.nombres} {patient.apellidos}</span>
                      <Badge variant="outline" className={statusStyles[patient.status] || statusStyles.activo}>
                        {patient.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[10px] uppercase font-bold">
                        {patient.edad_formateada || "Edad no registrada"}
                      </Badge>
                      <DialogDescription>
                        Información detallada del paciente
                      </DialogDescription>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onClinicalHistory?.();
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Generar historia clínica
                  </Button>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 gap-y-1">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="health">Salud</TabsTrigger>
              <TabsTrigger value="evaluacion">Evaluación</TabsTrigger>
              <TabsTrigger value="frecuencia">Frecuencia</TabsTrigger>
              <TabsTrigger value="recuerdos" onClick={fetchRecalls}>Recordatorio</TabsTrigger>
              <TabsTrigger value="plans">Planes</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Mail className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <p className="text-sm mt-1">{patient.email}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Phone className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Teléfono</p>
                      <p className="text-sm mt-1">{patient.telefono || "No registrado"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <User className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">ID del Sistema</p>
                      <p className="text-sm mt-1">#{patient.id}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Calendar className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Próxima Cita</p>
                      <p className="text-sm mt-1">{formatDate(patient.proxima_cita)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Activity className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nivel de Actividad</p>
                      <p className="text-sm mt-1 capitalize">{patient.nivel_actividad || "No especificado"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <FileText className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Rol</p>
                      <p className="text-sm mt-1 capitalize">{patient.role}</p>
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
                </div>
              </div>
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

          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
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
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a <strong>{patient.nombres} {patient.apellidos}</strong> y
              todos sus datos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}