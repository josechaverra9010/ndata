import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FoodFrequencyForm, FOOD_GROUPS } from "@/components/shared/FoodFrequencyForm";
import { Recordatorio24hForm } from "@/components/admin/Recordatorio24hForm";
import { Camera, Save, User, Loader2, Clock, ClipboardList, Utensils, Activity } from "lucide-react";
import { API_URL } from "@/config/api";
import { resolveMediaUrl } from "@/lib/media";
import { useAuth } from "@/hooks/useAuth";
import { normalizeDatosClinicos, type DatosClinicos } from "@/lib/datosClinicos";
import { isHeadCircumferenceAgeEligible } from "@/lib/pediatricGrowthUtils";

const formatListOrText = (value: string[] | string | null | undefined) => {
  if (value == null || value === "") return "No registrado";
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "No registrado";
  }
  return String(value);
};

const ReadOnlyField = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="space-y-1">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="text-sm whitespace-pre-wrap">{value?.trim() ? value : "No registrado"}</p>
  </div>
);

export default function PatientProfile() {
  const navigate = useNavigate();

  // Estados para el formulario
  const [formData, setFormData] = useState({
    nombres: "",
    apellidos: "",
    email: "",
    telefono: "",
    fecha_nacimiento: "",
    genero: "",
    direccion: "",
    foto_perfil: "",
    altura: "",
    peso_actual: "",
    peso_objetivo: "",
    nivel_actividad: "",
    objetivos_salud: "",
    condiciones_medicas: "",
    alimentos_disgusto: "",
    edad_formateada: "",
    frecuencia_consumo: [] as any[],
    tipo_documento: "",
    numero_documento: "",
    programa_eps: "",
    pal_factor: "" as string | number,
    antecedentes_familiares: "",
    evaluacion_nutricional: "",
    acompanante_nombre: "",
    acompanante_parentesco: "",
    acompanante_telefono: "",
    acompanante_email: "",
    alergias: [] as string[],
    preferencias: [] as string[],
    datos_clinicos: null as DatosClinicos | null,
  });

  const [recalls, setRecalls] = useState<any[]>([]);
  const [loadingRecalls, setLoadingRecalls] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);


  const { user, isLoading: isAuthLoading } = useAuth();

  // Cargar datos iniciales
  useEffect(() => {
    if (isAuthLoading || !user?.id) return;
    const token = localStorage.getItem("userToken");
    setLoadingProfile(true);
    fetch(`${API_URL}/patients/${user.id}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((res) => {
        if (!res.ok) throw new Error("profile");
        return res.json();
      })
      .then((data) => {
        setFormData({
          nombres: data.nombres || "",
          apellidos: data.apellidos || "",
          email: data.email || "",
          telefono: data.telefono || "",
          fecha_nacimiento: data.fecha_nacimiento || "",
          genero: data.genero || "",
          direccion: data.direccion || "",
          foto_perfil: data.foto_perfil || "",
          altura: data.altura != null ? String(data.altura) : "",
          peso_actual: data.peso_actual != null ? String(data.peso_actual) : "",
          peso_objetivo: data.peso_objetivo != null ? String(data.peso_objetivo) : "",
          nivel_actividad: data.nivel_actividad || "",
          objetivos_salud: data.objetivos_salud || "",
          condiciones_medicas: data.condiciones_medicas || "",
          alimentos_disgusto: data.alimentos_disgusto || "",
          edad_formateada: data.edad_formateada || "",
          frecuencia_consumo:
            Array.isArray(data.frecuencia_consumo) && data.frecuencia_consumo.length > 0
              ? data.frecuencia_consumo
              : FOOD_GROUPS.map((grupo) => ({ grupo, frecuencia: "never" })),
          tipo_documento: data.tipo_documento || "",
          numero_documento: data.numero_documento || "",
          programa_eps: data.programa_eps || "",
          pal_factor: data.pal_factor != null ? data.pal_factor : "",
          antecedentes_familiares: data.antecedentes_familiares || "",
          evaluacion_nutricional: data.evaluacion_nutricional || "",
          acompanante_nombre: data.acompanante_nombre || "",
          acompanante_parentesco: data.acompanante_parentesco || "",
          acompanante_telefono: data.acompanante_telefono || "",
          acompanante_email: data.acompanante_email || "",
          alergias: Array.isArray(data.alergias) ? data.alergias : [],
          preferencias: Array.isArray(data.preferencias) ? data.preferencias : [],
          datos_clinicos: normalizeDatosClinicos(data.datos_clinicos),
        });
      })
      .catch(() => toast.error("Error al cargar datos de perfil"))
      .finally(() => setLoadingProfile(false));
  }, [isAuthLoading, user?.id]);

  const fetchRecalls = async () => {
    if (!user?.id) return;
    setLoadingRecalls(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${user.id}/recalls`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRecalls(data);
      }
    } catch (error) {
      console.error("Error fetching recalls:", error);
    } finally {
      setLoadingRecalls(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchRecalls();
  }, [user?.id]);

  const handlePhotoClick = () => fileInputRef.current?.click();


  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validación de tamaño (2MB)
      if (file.size > 2 * 1024 * 1024) {
        return toast.error("La imagen es muy pesada (máximo 2MB)");
      }

      setUploadingPhoto(true);
      const photoData = new FormData();
      photoData.append("file", file);

      try {
        const token = localStorage.getItem("userToken");
        const response = await fetch(`${API_URL}/patient/${user?.id}/upload-avatar`, {
          method: "POST",
          headers: {
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: photoData,
        });
        const result = await response.json();
        if (result.success) {
          setFormData(prev => ({ ...prev, foto_perfil: result.foto_url }));
          // Actualizar el contexto de autenticación
          if (user) {
            const updatedUser = { ...user, avatar: result.foto_url };
            localStorage.setItem("userData", JSON.stringify(updatedUser));
            window.dispatchEvent(new Event("userUpdated"));
          }
          toast.success("Foto actualizada");
        } else {
          toast.error("Error al subir la foto");
        }
      } catch (error) {
        toast.error("Error al subir la foto");
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSave = async () => {
    setLoading(true);
    const profileData = {
      ...formData,
      altura: formData.altura ? parseFloat(formData.altura.toString()) : null,
      peso_actual: formData.peso_actual ? parseFloat(formData.peso_actual.toString()) : null,
      peso_objetivo: formData.peso_objetivo ? parseFloat(formData.peso_objetivo.toString()) : null,
      alergias: formData.alergias,
      preferencias: formData.preferencias,
      alimentos_disgusto: formData.alimentos_disgusto || null,
    };

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/profile/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...profileData,
          frecuencia_consumo: formData.frecuencia_consumo
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Actualizar localStorage para compatibilidad si es necesario, pero preferir contexto
        localStorage.setItem("userData", JSON.stringify({ ...user, profile_complete: result.profile_complete }));
        toast.success("Perfil actualizado correctamente");
        if (result.profile_complete) {
          toast.info("Perfil completo. Ya puedes navegar libremente.");
          navigate("/dashboard");
        }
      }
    } catch (error) {
      toast.error("Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PatientLayout>
      <div className="space-y-4 lg:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/*<div>
            <h1 className="text-xl lg:text-3xl font-bold text-foreground">Mi Perfil</h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-1">Gestiona tu información personal y completa tus evaluaciones</p>
          </div>*/}
          <Button onClick={handleSave} disabled={loading} className="gap-2 w-full sm:w-auto gradient-primary">
            <Save className="h-4 w-4" />
            {loading ? "Guardando..." : "Guardar Perfil"}
          </Button>
        </div>

        {loadingProfile ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-6 h-auto gap-1">
            <TabsTrigger value="personal" className="flex gap-2">
              <User className="h-4 w-4" />
              Personal
            </TabsTrigger>
            <TabsTrigger value="fisico" className="flex gap-2">
              <Activity className="h-4 w-4" />
              Físico
            </TabsTrigger>
            <TabsTrigger value="hábitos" className="flex gap-2">
              <Utensils className="h-4 w-4" />
              Hábitos
            </TabsTrigger>
            <TabsTrigger value="recordatorio" className="flex gap-2">
              <Clock className="h-4 w-4" />
              Recordatorio 24h
            </TabsTrigger>
            <TabsTrigger value="ficha" className="flex gap-2">
              <ClipboardList className="h-4 w-4" />
              Ficha clínica
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Profile Photo Card */}
              <Card className="md:col-span-1">
                <CardHeader><CardTitle className="text-sm">Tu Foto</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center">
                  <div className="relative group">
                    <Avatar className="h-40 w-40 border-4 border-primary/10">
                      <AvatarImage src={resolveMediaUrl(formData.foto_perfil)} />
                      <AvatarFallback className="bg-secondary">
                        <User className="h-16 w-16 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={handlePhotoClick}
                      disabled={uploadingPhoto}
                      className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
                    >
                      {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
                  </div>
                  <p className="mt-4 text-lg font-bold">{formData.nombres} {formData.apellidos}</p>
                  {formData.edad_formateada && (
                    <Badge variant="secondary" className="mt-2 bg-primary/5 text-primary border-primary/10 px-3 py-1">
                      {formData.edad_formateada}
                    </Badge>
                  )}
                </CardContent>
              </Card>

              {/* Personal Info Card */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Información Básica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nombres">Nombre</Label>
                      <Input id="nombres" value={formData.nombres} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apellidos">Apellidos</Label>
                      <Input id="apellidos" value={formData.apellidos} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={formData.email} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefono">Teléfono</Label>
                      <Input id="telefono" value={formData.telefono} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                      <Input id="fecha_nacimiento" type="date" value={formData.fecha_nacimiento} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="genero">Género</Label>
                      <Select value={formData.genero} onValueChange={(val) => setFormData({ ...formData, genero: val })}>
                        <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
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
                    <Input id="direccion" value={formData.direccion} onChange={handleInputChange} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                    <ReadOnlyField
                      label="Tipo de documento"
                      value={formData.tipo_documento}
                    />
                    <ReadOnlyField label="Número de documento" value={formData.numero_documento} />
                    <ReadOnlyField label="Programa EPS" value={formData.programa_eps} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="fisico" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    Composición Corporal
                    <Badge variant="outline" className="text-[10px] font-normal">Sincronizado con Seguimiento</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="altura" className="text-xs">Altura (cm)</Label>
                      <Input id="altura" type="number" value={formData.altura} onChange={handleInputChange} className="h-12 text-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="peso_actual" className="text-xs">Peso actual (kg)</Label>
                      <Input id="peso_actual" type="number" value={formData.peso_actual} onChange={handleInputChange} className="h-12 text-lg font-semibold text-primary" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="peso_objetivo" className="text-xs">Peso Objetivo (kg)</Label>
                      <Input id="peso_objetivo" type="number" value={formData.peso_objetivo} onChange={handleInputChange} className="h-12 text-lg font-semibold text-green-600" />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 mt-2">
                    <p className="text-xs font-medium text-primary mb-1">Peso de Referencia (Peso Ref)</p>
                    <p className="text-2xl font-bold">
                      {formData.peso_objetivo || "---"} <span className="text-sm font-normal text-muted-foreground">kg</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      * El peso objetivo se utiliza como referencia para todos tus cálculos nutricionales y de frecuencia.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nivel_actividad">Nivel de actividad física</Label>
                    <Select value={formData.nivel_actividad} onValueChange={(val) => setFormData({ ...formData, nivel_actividad: val })}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sedentaria">Sedentaria (Poco o nada)</SelectItem>
                        <SelectItem value="Ligera">Ligera (1-3 días/semana)</SelectItem>
                        <SelectItem value="Moderada">Moderada (3-5 días/semana)</SelectItem>
                        <SelectItem value="Fuerte">Fuerte (6-7 días/semana)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.pal_factor !== "" && formData.pal_factor != null ? (
                    <ReadOnlyField label="Factor de actividad (PAL)" value={String(formData.pal_factor)} />
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Antecedentes y Objetivos</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="objetivos_salud">Tus Objetivos Principales</Label>
                    <Textarea id="objetivos_salud" value={formData.objetivos_salud} onChange={handleInputChange} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="condiciones_medicas">Condiciones o Diagnósticos Médicos</Label>
                    <Textarea id="condiciones_medicas" value={formData.condiciones_medicas} onChange={handleInputChange} rows={3} />
                  </div>
                  <ReadOnlyField label="Antecedentes familiares" value={formData.antecedentes_familiares} />
                  <ReadOnlyField label="Evaluación nutricional (nutricionista)" value={formData.evaluacion_nutricional} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="hábitos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-primary" />
                  Frecuencia de Consumo de Alimentos
                </CardTitle>
                <CardDescription>Indica con qué frecuencia consumes los siguientes grupos de alimentos (Peso Ref: {formData.peso_objetivo || "?"} kg)</CardDescription>
              </CardHeader>
              <CardContent>
                <FoodFrequencyForm
                  data={formData.frecuencia_consumo}
                  onChange={(newData) => setFormData(prev => ({ ...prev, frecuencia_consumo: newData }))}
                />
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-sm">Alergias e intolerancias</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm">{formatListOrText(formData.alergias)}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Registradas por tu nutricionista. Si necesitas corregirlas, contacta a tu equipo.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Preferencias alimentarias</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm">{formatListOrText(formData.preferencias)}</p>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-sm">Rechazos alimentarios</CardTitle></CardHeader>
                <CardContent>
                  <ReadOnlyField label="" value={formData.alimentos_disgusto} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ficha" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Información registrada en consulta</CardTitle>
                <CardDescription>
                  Datos que tu nutricionista ingresó al crear tu ficha. Para cambios, coordina con tu nutricionista.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(formData.acompanante_nombre || formData.acompanante_telefono) && (
                  <div className="grid gap-4 sm:grid-cols-2 rounded-lg border p-4 bg-muted/20">
                    <ReadOnlyField label="Acompañante" value={formData.acompanante_nombre} />
                    <ReadOnlyField label="Parentesco" value={formData.acompanante_parentesco} />
                    <ReadOnlyField label="Teléfono acompañante" value={formData.acompanante_telefono} />
                    <ReadOnlyField label="Email acompañante" value={formData.acompanante_email} />
                  </div>
                )}
                {formData.datos_clinicos && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ReadOnlyField label="Motivo de consulta" value={formData.datos_clinicos.motivo_consulta} />
                    <ReadOnlyField label="Enfermedad actual" value={formData.datos_clinicos.enfermedad_actual} />
                    <ReadOnlyField label="Medicamentos" value={formData.datos_clinicos.medicamentos} />
                    <ReadOnlyField label="Diagnóstico PES" value={formData.datos_clinicos.diagnostico_pes} />
                    <ReadOnlyField label="Tipo de dieta indicada" value={formData.datos_clinicos.tipo_dieta} />
                    <ReadOnlyField label="Recomendaciones" value={formData.datos_clinicos.recomendaciones} />
                    {isHeadCircumferenceAgeEligible(formData.fecha_nacimiento) &&
                    formData.datos_clinicos.perimetro_cefalico ? (
                      <ReadOnlyField
                        label="Perímetro cefálico (cm)"
                        value={formData.datos_clinicos.perimetro_cefalico}
                      />
                    ) : null}
                    <ReadOnlyField label="Perímetro braquial (cm)" value={formData.datos_clinicos.perimetro_braquial} />
                    <ReadOnlyField label="Perímetro cintura (cm)" value={formData.datos_clinicos.perimetro_cintura} />
                    <ReadOnlyField
                      label="Clasificación antropométrica"
                      value={formData.datos_clinicos.clasificacion_antropometrica}
                    />
                  </div>
                )}
                {!formData.datos_clinicos?.motivo_consulta &&
                  !formData.acompanante_nombre &&
                  !formData.evaluacion_nutricional && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Aún no hay datos clínicos extendidos en tu ficha.
                    </p>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recordatorio" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-primary" />
                      Registrar Ingesta (Peso Ref: {formData.peso_objetivo || "?"} kg)
                    </CardTitle>
                    <CardDescription>Completa lo que has consumido en las últimas 24 horas usando este formato profesional.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Recordatorio24hForm
                      patientId={Number(user?.id) || 0}
                      onSuccess={() => {
                        toast.success("Recordatorio guardado correctamente");
                        fetchRecalls();
                      }}
                      onCancel={() => { }}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      Tus Últimos Registros
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                      {loadingRecalls ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
                      ) : recalls.length > 0 ? (
                        recalls.slice(0, 5).map((r) => (
                          <div key={r.id} className="p-3 rounded border border-border bg-muted/10">
                            <p className="font-semibold text-sm">{r.date}</p>
                            <p className="text-[10px] text-muted-foreground mt-1 truncate">
                              {r.observaciones || "Sin observaciones"}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground text-sm py-8">No tienes registros previos.</p>
                      )
                      }
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        )}
      </div>
    </PatientLayout>
  );
}