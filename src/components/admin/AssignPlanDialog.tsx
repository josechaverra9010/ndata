import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, User, Calendar, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { todayInColombiaISO, addDaysColombiaISO } from "@/lib/timezone";

interface MealPlan {
  id: number;
  name: string;
  description: string;
  calories: number;
  duration: string;
  category: string;
  color: string;
  patients: number;
}

interface Patient {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  foto_perfil?: string;
  peso_actual?: number;
  peso_objetivo?: number;
  nivel_actividad?: string;
}

interface AssignPlanDialogProps {
  plan: MealPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignSuccess: () => void;
}

export function AssignPlanDialog({ plan, open, onOpenChange, onAssignSuccess }: AssignPlanDialogProps) {
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(
    todayInColombiaISO()
  );
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPatients();
      // Auto-calcular fecha de fin si el plan tiene duración específica
      if (plan?.duration && plan.duration.includes("semanas")) {
        const weeks = parseInt(plan.duration.split(" ")[0]);
        if (!Number.isNaN(weeks)) {
          setEndDate(addDaysColombiaISO(weeks * 7));
        }
      }
    }
  }, [open, plan]);

  const fetchPatients = async () => {
    try {
      setLoadingPatients(true);
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (response.ok) {
        const data = await response.json();
        setPatients(data);
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pacientes",
        variant: "destructive",
      });
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !selectedPatientId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/meal-plans/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          patient_id: parseInt(selectedPatientId),
          meal_plan_id: plan.id,
          start_date: startDate,
          end_date: endDate || null,
          notes: notes || null,
        }),
      });

      if (response.ok) {
        toast({
          title: "¡Éxito!",
          description: "Plan asignado correctamente al paciente",
        });
        onAssignSuccess();
        onOpenChange(false);
        resetForm();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo asignar el plan",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error assigning plan:", error);
      toast({
        title: "Error",
        description: "Error al asignar el plan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedPatientId("");
    setSearchQuery("");
    setStartDate(todayInColombiaISO());
    setEndDate("");
    setNotes("");
  };

  const filteredPatients = patients.filter(patient =>
    `${patient.nombres} ${patient.apellidos}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedPatient = patients.find(p => p.id.toString() === selectedPatientId);

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {/*<DialogTitle>Asignar Plan a Paciente</DialogTitle>
          <DialogDescription>
            Selecciona un paciente y configura las fechas para el plan "{plan.name}"
          </DialogDescription>*/}
        </DialogHeader>

        {/* Plan Info */}
        <div className="p-4 rounded-lg border border-border bg-muted/50">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-semibold text-foreground">{plan.name}</h4>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            </div>
            <Badge variant="outline" className={`${plan.color === 'primary' ? 'bg-primary/10 text-primary' : ''}`}>
              {plan.category}
            </Badge>
          </div>
          <div className="flex gap-4 mt-3 text-sm">
            <span className="text-muted-foreground">
              <strong className="text-foreground">{plan.calories}</strong> kcal/día
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">{plan.duration}</strong>
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Selection */}
          <div className="space-y-2">
            <Label htmlFor="patient">Seleccionar Paciente *</Label>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Patient List */}
            <div className="border border-border rounded-lg max-h-[200px] overflow-y-auto">
              {loadingPatients ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  Cargando pacientes...
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  {searchQuery ? "No se encontraron pacientes" : "No hay pacientes disponibles"}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredPatients.map((patient) => (
                    <div
                      key={patient.id}
                      className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${selectedPatientId === patient.id.toString() ? "bg-primary/5 border-l-2 border-primary" : ""
                        }`}
                      onClick={() => setSelectedPatientId(patient.id.toString())}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={patient.foto_perfil} />
                          <AvatarFallback>
                            {patient.nombres[0]}{patient.apellidos[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {patient.nombres} {patient.apellidos}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">{patient.email}</p>
                          {patient.peso_actual && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Peso: {patient.peso_actual}kg
                              {patient.peso_objetivo && ` → ${patient.peso_objetivo}kg`}
                            </p>
                          )}
                        </div>
                        {selectedPatientId === patient.id.toString() && (
                          <div className="h-2 w-2 rounded-full bg-primary"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected Patient Info */}
          {selectedPatient && (
            <div className="p-4 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedPatient.foto_perfil} />
                  <AvatarFallback>
                    {selectedPatient.nombres[0]}{selectedPatient.apellidos[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">
                    {selectedPatient.nombres} {selectedPatient.apellidos}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedPatient.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">
                <Calendar className="inline h-4 w-4 mr-1" />
                Fecha de Inicio *
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">
                <Calendar className="inline h-4 w-4 mr-1" />
                Fecha de Fin
              </Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
              <p className="text-xs text-muted-foreground">
                Opcional - deja vacío si es continuo
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              <FileText className="inline h-4 w-4 mr-1" />
              Notas Adicionales
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="gradient-primary border-0"
              disabled={!selectedPatientId || loading}
            >
              {loading ? "Asignando..." : "Asignar Plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}