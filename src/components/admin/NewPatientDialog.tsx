import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_URL } from "@/config/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Activity, HeartPulse, ClipboardList, Users, FlaskConical, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FoodFrequencyForm, FOOD_GROUPS } from "@/components/shared/FoodFrequencyForm";
import {
  BioquimicosForm,
  emptyBioquimicos,
  normalizeBioquimicos,
  type BioquimicosData,
} from "@/components/shared/BioquimicosForm";
import {
  Recordatorio24hForm,
  buildRecallApiPayload,
  emptyRecallState,
  recallHasContent,
  type RecallFormState,
} from "@/components/admin/Recordatorio24hForm";
import { todayInColombiaISO } from "@/lib/timezone";
import {
  compactDatosClinicos,
  emptyDatosClinicos,
  normalizeDatosClinicos,
  type DatosClinicos,
} from "@/lib/datosClinicos";

interface NewPatientDialogProps {
  patient?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PatientFormData {
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
  fecha_nacimiento: string;
  genero: string;
  direccion: string;
  tipo_documento: string;
  numero_documento: string;
  password: string;
  // Nuevos campos
  altura: string;
  peso_actual: string;
  peso_objetivo: string;
  nivel_actividad: string;
  pal_factor: string; // Nuevo campo manual
  alergias: string;
  preferencias: string;
  objetivos_salud: string;
  condiciones_medicas: string;
  alimentos_disgusto: string;
  antecedentes_familiares: string;
  evaluacion_nutricional: string;
  frecuencia_consumo: any[];
  status: string;
  acompanante_nombre: string;
  acompanante_parentesco: string;
  acompanante_telefono: string;
  acompanante_email: string;
  acompanante_documento: string;
  acompanante_observaciones: string;
  programa_eps: string;
  examenes_bioquimicos: BioquimicosData;
  datos_clinicos: DatosClinicos;
}

const initialFormData: PatientFormData = {
  nombres: "",
  apellidos: "",
  email: "",
  telefono: "",
  fecha_nacimiento: "",
  genero: "",
  direccion: "",
  tipo_documento: "CC",
  numero_documento: "",
  password: "",
  altura: "",
  peso_actual: "",
  peso_objetivo: "",
  nivel_actividad: "Moderado (1.7 - 1.99)",
  pal_factor: "1.76", // Valor por defecto para Moderado
  alergias: "",
  preferencias: "",
  objetivos_salud: "",
  condiciones_medicas: "",
  alimentos_disgusto: "",
  antecedentes_familiares: "",
  evaluacion_nutricional: "",
  frecuencia_consumo: [],
  status: "activo",
  acompanante_nombre: "",
  acompanante_parentesco: "",
  acompanante_telefono: "",
  acompanante_email: "",
  acompanante_documento: "",
  acompanante_observaciones: "",
  programa_eps: "",
  examenes_bioquimicos: emptyBioquimicos(),
  datos_clinicos: emptyDatosClinicos(),
};



export function NewPatientDialog({ patient, open, onOpenChange, onSuccess }: NewPatientDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<PatientFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<PatientFormData>>({});
  const [recallDraft, setRecallDraft] = useState<RecallFormState>(() => emptyRecallState());
  const [latestRecall, setLatestRecall] = useState<any | null>(null);

  const isEditing = !!patient;

  useEffect(() => {
    if (patient && open) {
      setFormData({
        nombres: patient.nombres || "",
        apellidos: patient.apellidos || "",
        email: patient.email || "",
        telefono: patient.telefono || "",
        fecha_nacimiento: patient.fecha_nacimiento || "",
        genero: patient.genero || "",
        direccion: patient.direccion || "",
        tipo_documento: patient.tipo_documento || "CC",
        numero_documento: patient.numero_documento || "",
        password: "", // No editar contraseña por defecto
        altura: patient.altura?.toString() || "",
        peso_actual: patient.peso_actual?.toString() || "",
        peso_objetivo: patient.peso_objetivo?.toString() || "",
        nivel_actividad: patient.nivel_actividad || "Moderado (1.7 - 1.99)",
        pal_factor: patient.pal_factor ? patient.pal_factor.toString() : (patient.nivel_actividad && patient.nivel_actividad.includes("Sed") ? "1.53" : "1.76"),
        alergias: Array.isArray(patient.alergias) ? patient.alergias.join(", ") : (patient.alergias || ""),
        preferencias: Array.isArray(patient.preferencias) ? patient.preferencias.join(", ") : (patient.preferencias || ""),
        objetivos_salud: patient.objetivos_salud || "",
        condiciones_medicas: patient.condiciones_medicas || "",
        alimentos_disgusto: patient.alimentos_disgusto || "",
        antecedentes_familiares: patient.antecedentes_familiares || "",
        evaluacion_nutricional: patient.evaluacion_nutricional || "",
        frecuencia_consumo: FOOD_GROUPS.map(grupo => {
          const existingItem = Array.isArray(patient.frecuencia_consumo)
            ? patient.frecuencia_consumo.find(item => item.grupo === grupo)
            : null;
          return existingItem || { grupo, frecuencia: "never" };
        }),
        status: patient.status || "activo",
        acompanante_nombre: patient.acompanante_nombre || "",
        acompanante_parentesco: patient.acompanante_parentesco || "",
        acompanante_telefono: patient.acompanante_telefono || "",
        acompanante_email: patient.acompanante_email || "",
        acompanante_documento: patient.acompanante_documento || "",
        acompanante_observaciones: patient.acompanante_observaciones || "",
        programa_eps: patient.programa_eps || "",
        examenes_bioquimicos: normalizeBioquimicos(patient.examenes_bioquimicos),
        datos_clinicos: normalizeDatosClinicos(patient.datos_clinicos),
      });
      // Cargar recordatorio 24h más reciente
      (async () => {
        try {
          const token = localStorage.getItem("userToken");
          const rRes = await fetch(`${API_URL}/patients/${patient.id}/recalls`, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          if (rRes.ok) {
            const recalls = await rRes.json();
            const last = Array.isArray(recalls) && recalls.length ? recalls[0] : null;
            setLatestRecall(last);
          } else {
            setLatestRecall(null);
          }
        } catch {
          setLatestRecall(null);
        }
      })();
    } else if (!open) {
      setFormData({
        ...initialFormData,
        examenes_bioquimicos: emptyBioquimicos(),
        datos_clinicos: emptyDatosClinicos(),
        frecuencia_consumo: FOOD_GROUPS.map(grupo => ({ grupo, frecuencia: "never" }))
      });
      setErrors({});
      setRecallDraft(emptyRecallState());
      setLatestRecall(null);
    }
  }, [patient, open]);

  const age = useMemo(() => {
    if (!formData.fecha_nacimiento) return null;
    const today = new Date();
    const birthDate = new Date(formData.fecha_nacimiento);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }, [formData.fecha_nacimiento]);

  const imc = useMemo(() => {
    const peso = parseFloat(formData.peso_actual);
    const altura = parseFloat(formData.altura);

    if (!peso || !altura || altura <= 0) return "";

    const alturaMetros = altura / 100;
    const calculo = peso / (alturaMetros * alturaMetros);
    return calculo.toFixed(2);
  }, [formData.peso_actual, formData.altura]);

  const handleChange = (field: keyof PatientFormData, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };

      // Auto-calcular PAL si cambia el nivel de actividad
      if (field === "nivel_actividad") {
        let newPal = prev.pal_factor;
        if (value.includes("Sedentario")) newPal = "1.53";
        else if (value.includes("Moderado")) newPal = "1.76";
        else if (value.includes("Vigoroso")) newPal = "2.25";

        newData.pal_factor = newPal;
      }

      return newData;
    });
    // Limpiar error del campo cuando el usuario escribe
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const setClinico = <K extends keyof DatosClinicos>(key: K, value: DatosClinicos[K]) => {
    setFormData((prev) => ({
      ...prev,
      datos_clinicos: { ...prev.datos_clinicos, [key]: value },
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<PatientFormData> = {};

    if (!formData.nombres.trim()) {
      newErrors.nombres = "El nombre es requerido";
    }

    if (!formData.apellidos.trim()) {
      newErrors.apellidos = "El apellido es requerido";
    }

    if (!formData.email.trim()) {
      newErrors.email = "El email es requerido";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email inválido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: "Error de validación",
        description: "Por favor completa los campos requeridos correctamente",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const url = isEditing ? `${API_URL}/patients/${patient.id}` : `${API_URL}/patients`;
      const method = isEditing ? "PUT" : "POST";

      const token = localStorage.getItem("userToken");
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          nombres: formData.nombres.trim(),
          apellidos: formData.apellidos.trim(),
          email: formData.email.trim().toLowerCase(),
          telefono: formData.telefono.trim() || null,
          fecha_nacimiento: formData.fecha_nacimiento || null,
          genero: formData.genero || null,
          direccion: formData.direccion.trim() || null,
          tipo_documento: formData.tipo_documento,
          numero_documento: formData.numero_documento.trim() || null,
          password: formData.password.trim() || null,
          // Nuevos campos
          altura: formData.altura ? parseFloat(formData.altura) : null,
          peso_actual: formData.peso_actual ? parseFloat(formData.peso_actual) : null,
          peso_objetivo: formData.peso_objetivo ? parseFloat(formData.peso_objetivo) : null,
          nivel_actividad: formData.nivel_actividad,
          pal_factor: formData.pal_factor ? parseFloat(formData.pal_factor) : null,
          alergias: formData.alergias.split(',').map(s => s.trim()).filter(s => s !== ""),
          preferencias: formData.preferencias.split(',').map(s => s.trim()).filter(s => s !== ""),
          objetivos_salud: formData.objetivos_salud.trim() || null,
          condiciones_medicas: formData.condiciones_medicas.trim() || null,
          alimentos_disgusto: formData.alimentos_disgusto.trim() || null,
          antecedentes_familiares: formData.antecedentes_familiares.trim() || null,
          evaluacion_nutricional: formData.evaluacion_nutricional.trim() || null,
          frecuencia_consumo: formData.frecuencia_consumo,
          status: formData.status || "activo",
          acompanante_nombre: formData.acompanante_nombre.trim() || null,
          acompanante_parentesco: formData.acompanante_parentesco.trim() || null,
          acompanante_telefono: formData.acompanante_telefono.trim() || null,
          acompanante_email: formData.acompanante_email.trim() || null,
          acompanante_documento: formData.acompanante_documento.trim() || null,
          acompanante_observaciones: formData.acompanante_observaciones.trim() || null,
          programa_eps: formData.programa_eps.trim() || null,
          examenes_bioquimicos: formData.examenes_bioquimicos,
          datos_clinicos: compactDatosClinicos(formData.datos_clinicos),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail = data?.detail;
        const message =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join(" · ")
              : `Error al ${isEditing ? "actualizar" : "crear"} paciente`;
        throw new Error(message);
      }

      // Al crear, guardar recordatorio 24h si se completó en la pestaña
      const newPatientId = data?.id ?? patient?.id;
      if (!isEditing && newPatientId && recallHasContent(recallDraft)) {
        try {
          await fetch(`${API_URL}/patients/${newPatientId}/recalls`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(buildRecallApiPayload(recallDraft)),
          });
        } catch (recallErr) {
          console.error("Error saving recall after patient create:", recallErr);
          toast({
            title: "Paciente creado",
            description: "El paciente se creó, pero no se pudo guardar el recordatorio 24 h. Puedes completarlo al editar.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "¡Éxito!",
        description: `Paciente ${formData.nombres} ${formData.apellidos} ${isEditing ? 'actualizado' : 'creado'} correctamente`,
      });

      // Resetear formulario
      setFormData(initialFormData);
      setRecallDraft(emptyRecallState());
      setLatestRecall(null);
      setErrors({});
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating patient:", error);
      toast({
        title: "Error",
        description: error.message || `No se pudo ${isEditing ? 'actualizar' : 'crear'} el paciente. Verifica los datos e intenta nuevamente.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormData);
    setRecallDraft(emptyRecallState());
    setLatestRecall(null);
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Paciente" : "Nuevo Paciente"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Actualiza la información del paciente."
              : "Completa la información básica del paciente. Los campos marcados con * son obligatorios."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7 mb-6 h-auto gap-1">
              <TabsTrigger value="personal" className="flex gap-2 text-xs sm:text-sm">
                <User className="h-4 w-4" />
                Personal
              </TabsTrigger>
              <TabsTrigger value="bioquimico" className="flex gap-2 text-xs sm:text-sm">
                <FlaskConical className="h-4 w-4" />
                Bioquímico
              </TabsTrigger>
              <TabsTrigger value="fisico" className="flex gap-2 text-xs sm:text-sm">
                <Activity className="h-4 w-4" />
                Físico
              </TabsTrigger>
              <TabsTrigger value="salud" className="flex gap-2 text-xs sm:text-sm">
                <HeartPulse className="h-4 w-4" />
                Salud
              </TabsTrigger>
              <TabsTrigger value="recordatorio" className="flex gap-2 text-xs sm:text-sm">
                <Clock className="h-4 w-4" />
                Recordatorio 24h
              </TabsTrigger>
              <TabsTrigger value="frecuencia" className="flex gap-2 text-xs sm:text-sm">
                <Activity className="h-4 w-4" />
                Frecuencia
              </TabsTrigger>
              <TabsTrigger value="evaluacion" className="flex gap-2 text-xs sm:text-sm">
                <ClipboardList className="h-4 w-4" />
                Evaluación
              </TabsTrigger>
            </TabsList>

            {/* Pestaña: Información Personal */}
            <TabsContent value="personal" className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nombres">
                    Nombres <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nombres"
                    value={formData.nombres}
                    onChange={(e) => handleChange("nombres", e.target.value)}
                    className={errors.nombres ? "border-destructive" : ""}
                    disabled={loading}
                  />
                  {errors.nombres && (
                    <p className="text-xs text-destructive">{errors.nombres}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apellidos">
                    Apellidos <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="apellidos"
                    value={formData.apellidos}
                    onChange={(e) => handleChange("apellidos", e.target.value)}
                    className={errors.apellidos ? "border-destructive" : ""}
                    disabled={loading}
                  />
                  {errors.apellidos && (
                    <p className="text-xs text-destructive">{errors.apellidos}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className={errors.email ? "border-destructive" : ""}
                    disabled={loading}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefono">Celular</Label>
                  <Input
                    id="telefono"
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => handleChange("telefono", e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono_fijo">Teléfono fijo</Label>
                <Input
                  id="telefono_fijo"
                  type="tel"
                  value={formData.datos_clinicos.telefono_fijo}
                  onChange={(e) => setClinico("telefono_fijo", e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                    {age !== null && (
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {age} años
                      </span>
                    )}
                  </div>
                  <Input
                    id="fecha_nacimiento"
                    type="date"
                    value={formData.fecha_nacimiento}
                    onChange={(e) => handleChange("fecha_nacimiento", e.target.value)}
                    disabled={loading}
                    max={todayInColombiaISO()}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="genero">Género</Label>
                  <Select
                    value={formData.genero}
                    onValueChange={(value) => handleChange("genero", value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="genero">
                      <SelectValue placeholder="Selecciona género" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Femenino">Femenino</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => handleChange("direccion", e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tipo_documento">Tipo de Documento</Label>
                  <Select
                    value={formData.tipo_documento}
                    onValueChange={(value) => handleChange("tipo_documento", value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="tipo_documento">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CC">Cédula de Ciudadanía (CC)</SelectItem>
                      <SelectItem value="CE">Cédula de Extranjería (CE)</SelectItem>
                      <SelectItem value="TI">Tarjeta de Identidad (TI)</SelectItem>
                      <SelectItem value="PAS">Pasaporte (PAS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numero_documento">Número de Documento</Label>
                  <Input
                    id="numero_documento"
                    value={formData.numero_documento}
                    onChange={(e) => handleChange("numero_documento", e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña (Opcional)</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Si se deja en blanco, la contraseña por defecto será "password123"
                </p>
              </div>

              <div className="space-y-2">
                <Label>Estado del paciente</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => handleChange("status", v)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Acompañante / cuidador</p>
                    <p className="text-xs text-muted-foreground">
                      Información opcional. Útil para pediatría, adultos mayores o pacientes que asisten con alguien.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="acompanante_nombre">Nombre del acompañante</Label>
                    <Input
                      id="acompanante_nombre"
                      value={formData.acompanante_nombre}
                      onChange={(e) => handleChange("acompanante_nombre", e.target.value)}
                      disabled={loading}
                      placeholder="Ej. María Pérez"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acompanante_parentesco">Parentesco / relación</Label>
                    <Select
                      value={formData.acompanante_parentesco || undefined}
                      onValueChange={(v) => handleChange("acompanante_parentesco", v)}
                      disabled={loading}
                    >
                      <SelectTrigger id="acompanante_parentesco">
                        <SelectValue placeholder="Selecciona (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Madre">Madre</SelectItem>
                        <SelectItem value="Padre">Padre</SelectItem>
                        <SelectItem value="Hijo/a">Hijo/a</SelectItem>
                        <SelectItem value="Cónyuge">Cónyuge</SelectItem>
                        <SelectItem value="Hermano/a">Hermano/a</SelectItem>
                        <SelectItem value="Abuelo/a">Abuelo/a</SelectItem>
                        <SelectItem value="Tutor">Tutor</SelectItem>
                        <SelectItem value="Cuidador">Cuidador</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="acompanante_telefono">Teléfono del acompañante</Label>
                    <Input
                      id="acompanante_telefono"
                      type="tel"
                      value={formData.acompanante_telefono}
                      onChange={(e) => handleChange("acompanante_telefono", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acompanante_email">Email del acompañante</Label>
                    <Input
                      id="acompanante_email"
                      type="email"
                      value={formData.acompanante_email}
                      onChange={(e) => handleChange("acompanante_email", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acompanante_documento">Documento del acompañante</Label>
                  <Input
                    id="acompanante_documento"
                    value={formData.acompanante_documento}
                    onChange={(e) => handleChange("acompanante_documento", e.target.value)}
                    disabled={loading}
                    placeholder="Opcional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acompanante_observaciones">Observaciones</Label>
                  <Textarea
                    id="acompanante_observaciones"
                    rows={2}
                    value={formData.acompanante_observaciones}
                    onChange={(e) => handleChange("acompanante_observaciones", e.target.value)}
                    disabled={loading}
                    placeholder="Notas adicionales (opcional)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="programa_eps">Programa al que pertenece a su EPS (si aplica)</Label>
                <Input
                  id="programa_eps"
                  value={formData.programa_eps}
                  onChange={(e) => handleChange("programa_eps", e.target.value)}
                  disabled={loading}
                  placeholder="Ej. hipertensión, diabetes, materno perinatal…"
                />
              </div>
            </TabsContent>

            <TabsContent value="bioquimico" className="space-y-4 pt-4">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Exámenes bioquímicos</p>
                  <p className="text-xs text-muted-foreground">
                    Opcional. Estos valores se cargarán automáticamente al generar la historia clínica.
                  </p>
                </div>
                <BioquimicosForm
                  value={formData.examenes_bioquimicos}
                  onChange={(next) => setFormData((prev) => ({ ...prev, examenes_bioquimicos: next }))}
                  disabled={loading}
                />
              </div>
            </TabsContent>

            {/* Pestaña: Datos Físicos */}
            <TabsContent value="fisico" className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="altura">Altura (cm)</Label>
                  <Input
                    id="altura"
                    type="number"
                    step="0.1"
                    value={formData.altura}
                    onChange={(e) => handleChange("altura", e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="peso_actual">Peso Actual (kg)</Label>
                  <Input
                    id="peso_actual"
                    type="number"
                    step="0.1"
                    value={formData.peso_actual}
                    onChange={(e) => handleChange("peso_actual", e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="peso_objetivo">Peso Objetivo (kg)</Label>
                  <Input
                    id="peso_objetivo"
                    type="number"
                    step="0.1"
                    value={formData.peso_objetivo}
                    onChange={(e) => handleChange("peso_objetivo", e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imc">IMC</Label>
                  <Input
                    id="imc"
                    value={imc}
                    readOnly
                    className="bg-muted font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nivel_actividad">Nivel de Actividad</Label>
                <Select
                  value={formData.nivel_actividad}
                  onValueChange={(value) => handleChange("nivel_actividad", value)}
                  disabled={loading}
                >
                  <SelectTrigger id="nivel_actividad">
                    <SelectValue placeholder="Selecciona nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sedentario (1.4 - 1.69)">Sedentario (1.4 - 1.69)</SelectItem>
                    <SelectItem value="Moderado (1.7 - 1.99)">Moderado (1.7 - 1.99)</SelectItem>
                    <SelectItem value="Vigoroso (2.0 - 2.4)">Vigoroso (2.0 - 2.4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pal_factor">Factor de Actividad (PAL)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="pal_factor"
                    type="number"
                    step="0.001"
                    value={formData.pal_factor}
                    onChange={(e) => handleChange("pal_factor", e.target.value)}
                    disabled={loading}
                    className="w-1/3"
                  />
                  <p className="text-xs text-muted-foreground flex-1">
                    Este valor se calcula automáticamente según el nivel de actividad, pero puedes ajustarlo manualmente si es necesario.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferencias">Preferencias Alimentarias (Separadas por comas)</Label>
                <Input
                  id="preferencias"
                  value={formData.preferencias}
                  onChange={(e) => handleChange("preferencias", e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alimentos_disgusto">Rechazos alimentarios</Label>
                <Textarea
                  id="alimentos_disgusto"
                  value={formData.alimentos_disgusto}
                  onChange={(e) => handleChange("alimentos_disgusto", e.target.value)}
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Antropometría adicional</p>
                  <p className="text-xs text-muted-foreground">Opcional. Se incluye en la historia clínica.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="perimetro_cefalico">Perímetro cefálico</Label>
                    <Input
                      id="perimetro_cefalico"
                      value={formData.datos_clinicos.perimetro_cefalico}
                      onChange={(e) => setClinico("perimetro_cefalico", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="perimetro_braquial">Perímetro braquial</Label>
                    <Input
                      id="perimetro_braquial"
                      value={formData.datos_clinicos.perimetro_braquial}
                      onChange={(e) => setClinico("perimetro_braquial", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="perimetro_cintura">Perímetro de cintura</Label>
                    <Input
                      id="perimetro_cintura"
                      value={formData.datos_clinicos.perimetro_cintura}
                      onChange={(e) => setClinico("perimetro_cintura", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pliegue_tricipital">Pliegue tricipital</Label>
                    <Input
                      id="pliegue_tricipital"
                      value={formData.datos_clinicos.pliegue_tricipital}
                      onChange={(e) => setClinico("pliegue_tricipital", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pliegue_subescapular">Pliegue subescapular</Label>
                    <Input
                      id="pliegue_subescapular"
                      value={formData.datos_clinicos.pliegue_subescapular}
                      onChange={(e) => setClinico("pliegue_subescapular", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clasificacion_antropometrica">Clasificación antropométrica</Label>
                  <Textarea
                    id="clasificacion_antropometrica"
                    rows={2}
                    value={formData.datos_clinicos.clasificacion_antropometrica}
                    onChange={(e) => setClinico("clasificacion_antropometrica", e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observaciones_antro">Observaciones antropométricas</Label>
                  <Textarea
                    id="observaciones_antro"
                    rows={2}
                    value={formData.datos_clinicos.observaciones_antro}
                    onChange={(e) => setClinico("observaciones_antro", e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Pestaña: Perfil de Salud */}
            <TabsContent value="salud" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="motivo_consulta">Motivo de consulta</Label>
                <Textarea
                  id="motivo_consulta"
                  value={formData.datos_clinicos.motivo_consulta}
                  onChange={(e) => setClinico("motivo_consulta", e.target.value)}
                  disabled={loading}
                  rows={2}
                  placeholder="Si se deja vacío, se usarán los objetivos de salud"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alergias">Alergias alimentarias (separadas por comas)</Label>
                <Input
                  id="alergias"
                  value={formData.alergias}
                  onChange={(e) => handleChange("alergias", e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="enfermedad_actual">Presenta alergias o intolerancia a medicamentos</Label>
                <Textarea
                  id="enfermedad_actual"
                  value={formData.datos_clinicos.enfermedad_actual}
                  onChange={(e) => setClinico("enfermedad_actual", e.target.value)}
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="condiciones_medicas">Condiciones Médicas</Label>
                <Textarea
                  id="condiciones_medicas"
                  value={formData.condiciones_medicas}
                  onChange={(e) => handleChange("condiciones_medicas", e.target.value)}
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="antecedentes_personales">Antecedentes personales</Label>
                <Textarea
                  id="antecedentes_personales"
                  value={formData.datos_clinicos.antecedentes_personales}
                  onChange={(e) => setClinico("antecedentes_personales", e.target.value)}
                  disabled={loading}
                  rows={2}
                  placeholder="Si se deja vacío, se usarán las alergias registradas"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signos_sintomas">Signos y síntomas gastrointestinales</Label>
                <Textarea
                  id="signos_sintomas"
                  value={formData.datos_clinicos.signos_sintomas}
                  onChange={(e) => setClinico("signos_sintomas", e.target.value)}
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="flex flex-wrap gap-4">
                {(
                  [
                    ["constipacion", "Constipación"],
                    ["diarrea", "Diarrea"],
                    ["vomito", "Vómito"],
                    ["reflujo", "Reflujo"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={formData.datos_clinicos[key]}
                      onCheckedChange={(v) => setClinico(key, !!v)}
                      disabled={loading}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="otros_sintomas">Otros síntomas</Label>
                <Input
                  id="otros_sintomas"
                  value={formData.datos_clinicos.otros_sintomas}
                  onChange={(e) => setClinico("otros_sintomas", e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="antecedentes_familiares">Antecedentes Familiares</Label>
                <Textarea
                  id="antecedentes_familiares"
                  value={formData.antecedentes_familiares}
                  onChange={(e) => handleChange("antecedentes_familiares", e.target.value)}
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="flex flex-wrap gap-4">
                {(
                  [
                    ["fam_diabetes", "Diabetes"],
                    ["fam_cardiovascular", "Cardiovascular"],
                    ["fam_hipertension", "Hipertensión"],
                    ["fam_obesidad", "Obesidad"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={formData.datos_clinicos[key]}
                      onCheckedChange={(v) => setClinico(key, !!v)}
                      disabled={loading}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="medicamentos">Medicamentos / suplementos</Label>
                <Textarea
                  id="medicamentos"
                  value={formData.datos_clinicos.medicamentos}
                  onChange={(e) => setClinico("medicamentos", e.target.value)}
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="factores_riesgo">Factores de riesgo</Label>
                <Textarea
                  id="factores_riesgo"
                  value={formData.datos_clinicos.factores_riesgo}
                  onChange={(e) => setClinico("factores_riesgo", e.target.value)}
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="objetivos_salud">Objetivos de Salud</Label>
                <Textarea
                  id="objetivos_salud"
                  value={formData.objetivos_salud}
                  onChange={(e) => handleChange("objetivos_salud", e.target.value)}
                  disabled={loading}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="recordatorio" className="space-y-4 pt-4">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Recordatorio de 24 horas</p>
                  <p className="text-xs text-muted-foreground">
                    {isEditing
                      ? "Completa o actualiza el consumo del día anterior. Puedes guardarlo en la ficha con el botón del cuadro."
                      : "Completa el consumo del día anterior. Se guardará automáticamente al crear el paciente."}
                  </p>
                </div>
                <Recordatorio24hForm
                  patientId={isEditing ? patient.id : null}
                  embedded
                  initialRecall={isEditing ? latestRecall : null}
                  hideActions={!isEditing}
                  onFormDataChange={setRecallDraft}
                  onSuccess={async () => {
                    if (!isEditing || !patient?.id) return;
                    try {
                      const token = localStorage.getItem("userToken");
                      const rRes = await fetch(`${API_URL}/patients/${patient.id}/recalls`, {
                        headers: {
                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                      });
                      if (rRes.ok) {
                        const recalls = await rRes.json();
                        setLatestRecall(Array.isArray(recalls) && recalls.length ? recalls[0] : null);
                      }
                    } catch {
                      /* ignore */
                    }
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="frecuencia" className="space-y-4 pt-4">
              <FoodFrequencyForm
                data={formData.frecuencia_consumo}
                onChange={(newData) => setFormData(prev => ({ ...prev, frecuencia_consumo: newData }))}
              />
            </TabsContent>

            {/* Pestaña: Evaluación Nutricional */}
            <TabsContent value="evaluacion" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="diagnostico_pes">Diagnóstico nutricional PES</Label>
                <Textarea
                  id="diagnostico_pes"
                  value={formData.datos_clinicos.diagnostico_pes}
                  onChange={(e) => setClinico("diagnostico_pes", e.target.value)}
                  disabled={loading}
                  rows={3}
                  placeholder="Si se deja vacío, se usará la evaluación nutricional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo_dieta">Tipo de dieta y características</Label>
                <Textarea
                  id="tipo_dieta"
                  value={formData.datos_clinicos.tipo_dieta}
                  onChange={(e) => setClinico("tipo_dieta", e.target.value)}
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recomendaciones">Recomendaciones</Label>
                <Textarea
                  id="recomendaciones"
                  value={formData.datos_clinicos.recomendaciones}
                  onChange={(e) => setClinico("recomendaciones", e.target.value)}
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan_educacion">Plan de educación nutricional</Label>
                <Textarea
                  id="plan_educacion"
                  value={formData.datos_clinicos.plan_educacion}
                  onChange={(e) => setClinico("plan_educacion", e.target.value)}
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="proxima_cita_dias">Próxima cita en (días)</Label>
                  <Input
                    id="proxima_cita_dias"
                    value={formData.datos_clinicos.proxima_cita_dias}
                    onChange={(e) => setClinico("proxima_cita_dias", e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proxima_cita_fecha">Fecha próxima cita</Label>
                  <Input
                    id="proxima_cita_fecha"
                    type="date"
                    value={formData.datos_clinicos.proxima_cita_fecha}
                    onChange={(e) => setClinico("proxima_cita_fecha", e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="criterios_seguimiento">Criterios a evaluar en seguimiento</Label>
                <Textarea
                  id="criterios_seguimiento"
                  value={formData.datos_clinicos.criterios_seguimiento}
                  onChange={(e) => setClinico("criterios_seguimiento", e.target.value)}
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nota_resumida">Nota resumida</Label>
                <Textarea
                  id="nota_resumida"
                  value={formData.datos_clinicos.nota_resumida}
                  onChange={(e) => setClinico("nota_resumida", e.target.value)}
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evaluacion_nutricional">Evaluación Nutricional Detallada</Label>
                <Textarea
                  id="evaluacion_nutricional"
                  value={formData.evaluacion_nutricional}
                  onChange={(e) => handleChange("evaluacion_nutricional", e.target.value)}
                  disabled={loading}
                  className="min-h-[200px] resize-none"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gradient-primary">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Guardando..." : "Creando..."}
                </>
              ) : (
                isEditing ? "Guardar cambios" : "Crear Paciente"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}