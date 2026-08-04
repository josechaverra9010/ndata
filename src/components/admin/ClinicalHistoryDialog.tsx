import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  FileText,
  Download,
  UserRound,
  HeartPulse,
  Pill,
  Ruler,
  UtensilsCrossed,
  Stethoscope,
  ClipboardList,
  CalendarClock,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { todayInColombiaISO } from "@/lib/timezone";
import {
  BioquimicosForm,
  normalizeBioquimicos,
  type BioquimicosData,
} from "@/components/shared/BioquimicosForm";
import {
  buildClinicalHistoryFromPatient,
  calcImc,
  emptyClinicalHistoryForm,
  formatCalculoCaloricoFromPlan,
  formatFoodFrequencyText,
  type ClinicalHistoryForm,
} from "@/lib/clinicalHistoryFromPatient";
import { Recordatorio24hForm } from "@/components/admin/Recordatorio24hForm";
import { FoodFrequencyForm, FOOD_GROUPS } from "@/components/shared/FoodFrequencyForm";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function normalizeFrecuenciaConsumo(raw?: any[] | null) {
  return FOOD_GROUPS.map((grupo) => {
    const existing = Array.isArray(raw) ? raw.find((item) => item?.grupo === grupo) : null;
    return existing ? { grupo, frecuencia: existing.frecuencia || "never" } : { grupo, frecuencia: "never" };
  });
}

export interface ClinicalHistoryPatient {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  edad_formateada?: string | null;
  genero?: string | null;
  direccion?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  peso_actual?: number | null;
  altura?: number | null;
  nivel_actividad?: string | null;
  alergias?: string[] | null;
  preferencias?: string[] | null;
  objetivos_salud?: string | null;
  condiciones_medicas?: string | null;
  alimentos_disgusto?: string | null;
  antecedentes_familiares?: string | null;
  evaluacion_nutricional?: string | null;
  acompanante_nombre?: string | null;
  acompanante_parentesco?: string | null;
  acompanante_telefono?: string | null;
  examenes_bioquimicos?: Partial<BioquimicosData> | null;
  frecuencia_consumo?: any[] | null;
  peso_objetivo?: number | null;
  pal_factor?: number | null;
}

type HistoryForm = ClinicalHistoryForm;

const inputClass =
  "h-10 rounded-xl border-border/70 bg-background/80 shadow-sm transition-colors focus-visible:ring-primary/30";
const textareaClass =
  "rounded-xl border-border/70 bg-background/80 shadow-sm transition-colors focus-visible:ring-primary/30 min-h-[72px]";

function Section({
  title,
  description,
  icon: Icon,
  children,
  tone = "default",
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  tone?: "default" | "accent" | "soft";
}) {
  const toneClass =
    tone === "accent"
      ? "from-primary/10 via-card to-card border-primary/25"
      : tone === "soft"
        ? "from-secondary/30 via-card to-card border-secondary/40"
        : "from-muted/40 via-card to-card border-border/60";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 sm:p-5 shadow-sm",
        toneClass
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
      <div className="relative mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-inner">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-wide text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="relative space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
        {label}
      </Label>
      {children}
    </div>
  );
}

function CheckChip({
  checked,
  label,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all",
        disabled ? "cursor-default opacity-90" : "cursor-pointer",
        checked
          ? "border-primary/40 bg-primary/15 text-foreground shadow-sm"
          : "border-border/70 bg-background/70 text-muted-foreground hover:border-primary/30 hover:bg-muted/50",
        disabled && "hover:border-border/70 hover:bg-background/70"
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => !disabled && onCheckedChange(!!v)}
      />
      <span className="select-none">{label}</span>
    </label>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <div>{children}</div>
    </div>
  );
}

interface ClinicalHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: ClinicalHistoryPatient | null;
}

export function ClinicalHistoryDialog({ open, onOpenChange, patient }: ClinicalHistoryDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<HistoryForm>(emptyClinicalHistoryForm());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [nutritionistName, setNutritionistName] = useState("");
  const [nutritionistLicense, setNutritionistLicense] = useState("");
  const [latestRecall, setLatestRecall] = useState<any | null>(null);
  const [frecuenciaConsumo, setFrecuenciaConsumo] = useState<any[]>(() => normalizeFrecuenciaConsumo(null));
  const [patientSnapshot, setPatientSnapshot] = useState<any | null>(null);
  const [savingFrecuencia, setSavingFrecuencia] = useState(false);

  const set = <K extends keyof HistoryForm>(key: K, value: HistoryForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const footerPreview = useMemo(() => {
    const name = nutritionistName || "Nutricionista";
    const to = nutritionistLicense ? ` — TO: ${nutritionistLicense}` : "";
    return `Generado por: ${name}${to}`;
  }, [nutritionistName, nutritionistLicense]);

  useEffect(() => {
    if (!open || !patient) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("userToken");
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        // Perfil nutricionista (TO)
        try {
          const userData = JSON.parse(localStorage.getItem("userData") || "{}");
          if (userData?.id) {
            const profRes = await fetch(`${API_URL}/admin/profile/${userData.id}`, { headers });
            if (profRes.ok) {
              const prof = await profRes.json();
              if (!cancelled) {
                setNutritionistName(prof.name || userData.name || "");
                setNutritionistLicense(prof.license || "");
              }
            } else if (!cancelled) {
              setNutritionistName(userData.name || "");
            }
          }
        } catch {
          /* ignore */
        }

        // Paciente completo
        let p: any = patient;
        try {
          const pRes = await fetch(`${API_URL}/patients/${patient.id}`, { headers });
          if (pRes.ok) p = await pRes.json();
        } catch {
          /* use list patient */
        }

        // Recordatorio 24h más reciente
        let recallText = "";
        let lastRecall: any = null;
        try {
          const rRes = await fetch(`${API_URL}/patients/${patient.id}/recalls`, { headers });
          if (rRes.ok) {
            const recalls = await rRes.json();
            lastRecall = Array.isArray(recalls) && recalls.length ? recalls[0] : null;
            if (lastRecall) {
              // Resumen se regenera desde el cuadro; dejar texto de respaldo
              recallText = [
                lastRecall.desayuno && `Desayuno: ${typeof lastRecall.desayuno === "string" && lastRecall.desayuno.startsWith("[") ? "(ver cuadro)" : lastRecall.desayuno}`,
                lastRecall.media_manana && `Media mañana: ${typeof lastRecall.media_manana === "string" && lastRecall.media_manana.startsWith("[") ? "(ver cuadro)" : lastRecall.media_manana}`,
                lastRecall.almuerzo && `Almuerzo: ${typeof lastRecall.almuerzo === "string" && lastRecall.almuerzo.startsWith("[") ? "(ver cuadro)" : lastRecall.almuerzo}`,
                lastRecall.media_tarde && `Media tarde: ${typeof lastRecall.media_tarde === "string" && lastRecall.media_tarde.startsWith("[") ? "(ver cuadro)" : lastRecall.media_tarde}`,
                lastRecall.cena && `Cena: ${typeof lastRecall.cena === "string" && lastRecall.cena.startsWith("[") ? "(ver cuadro)" : lastRecall.cena}`,
                lastRecall.observaciones && `Obs.: ${lastRecall.observaciones}`,
              ]
                .filter(Boolean)
                .join("\n");
            }
          }
        } catch {
          /* ignore */
        }
        if (!cancelled) {
          setLatestRecall(lastRecall);
          setPatientSnapshot(p);
          setFrecuenciaConsumo(normalizeFrecuenciaConsumo(p.frecuencia_consumo));
        }

        // Plan activo → cálculo calórico / requerimientos + minuta
        let reqText = "";
        let minuta = "";
        try {
          const plansRes = await fetch(`${API_URL}/patients/${patient.id}/meal-plans`, { headers });
          if (plansRes.ok) {
            const plans = await plansRes.json();
            const active = Array.isArray(plans)
              ? plans.find((x: any) => x.is_active || x.status === "activo") || plans[0]
              : null;
            const plan = active?.meal_plan || active;
            if (plan) {
              reqText = formatCalculoCaloricoFromPlan(plan);
              const f4 = plan.fase_4 || {};
              if (f4.minuta || f4.distribucion) {
                minuta = typeof f4.minuta === "string" ? f4.minuta : JSON.stringify(f4.minuta || f4.distribucion, null, 2);
              }
            }
          }
        } catch {
          /* ignore */
        }

        const next = buildClinicalHistoryFromPatient(p, {
          recallText,
          reqText,
          minuta,
        });

        if (!cancelled) setForm(next);
      } catch (e) {
        console.error(e);
        toast({
          title: "Error",
          description: "No se pudieron precargar todos los datos",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, patient, toast]);

  const handleFrecuenciaChange = (newData: any[]) => {
    setFrecuenciaConsumo(newData);
    set("evaluacion_consumo", formatFoodFrequencyText(newData));
  };

  const handleSaveFrecuencia = async () => {
    if (!patient || !patientSnapshot) return;
    setSavingFrecuencia(true);
    try {
      const token = localStorage.getItem("userToken");
      const fecha =
        typeof patientSnapshot.fecha_nacimiento === "string"
          ? patientSnapshot.fecha_nacimiento.slice(0, 10)
          : patientSnapshot.fecha_nacimiento || null;
      const response = await fetch(`${API_URL}/patients/${patient.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          nombres: patientSnapshot.nombres,
          apellidos: patientSnapshot.apellidos,
          email: patientSnapshot.email,
          telefono: patientSnapshot.telefono ?? null,
          fecha_nacimiento: fecha,
          genero: patientSnapshot.genero ?? null,
          direccion: patientSnapshot.direccion ?? null,
          tipo_documento: patientSnapshot.tipo_documento ?? null,
          numero_documento: patientSnapshot.numero_documento ?? null,
          altura: patientSnapshot.altura ?? null,
          peso_actual: patientSnapshot.peso_actual ?? null,
          peso_objetivo: patientSnapshot.peso_objetivo ?? null,
          nivel_actividad: patientSnapshot.nivel_actividad ?? null,
          pal_factor: patientSnapshot.pal_factor ?? null,
          alergias: patientSnapshot.alergias || [],
          preferencias: patientSnapshot.preferencias || [],
          objetivos_salud: patientSnapshot.objetivos_salud ?? null,
          condiciones_medicas: patientSnapshot.condiciones_medicas ?? null,
          alimentos_disgusto: patientSnapshot.alimentos_disgusto ?? null,
          antecedentes_familiares: patientSnapshot.antecedentes_familiares ?? null,
          evaluacion_nutricional: patientSnapshot.evaluacion_nutricional ?? null,
          frecuencia_consumo: frecuenciaConsumo,
          status: patientSnapshot.status || "activo",
          acompanante_nombre: patientSnapshot.acompanante_nombre ?? null,
          acompanante_parentesco: patientSnapshot.acompanante_parentesco ?? null,
          acompanante_telefono: patientSnapshot.acompanante_telefono ?? null,
          acompanante_email: patientSnapshot.acompanante_email ?? null,
          acompanante_documento: patientSnapshot.acompanante_documento ?? null,
          acompanante_observaciones: patientSnapshot.acompanante_observaciones ?? null,
          programa_eps: patientSnapshot.programa_eps ?? null,
          examenes_bioquimicos: patientSnapshot.examenes_bioquimicos ?? null,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail || `Error ${response.status}`);
      }
      const updated = await response.json();
      setPatientSnapshot(updated);
      set("evaluacion_consumo", formatFoodFrequencyText(frecuenciaConsumo));
      toast({
        title: "Frecuencia guardada",
        description: "Se actualizó la frecuencia de consumo en la ficha del paciente.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error",
        description: e?.message || "No se pudo guardar la frecuencia de consumo",
        variant: "destructive",
      });
    } finally {
      setSavingFrecuencia(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!patient) return;
    setGenerating(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${patient.id}/reports/clinical-history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail || `Error ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = todayInColombiaISO();
      a.download = `historia_clinica_${form.nombre.replace(/\s+/g, "_") || patient.id}_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Historia clínica generada", description: "El PDF se descargará en breve." });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error",
        description: e?.message || "No se pudo generar la historia clínica",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[94vh] p-0 gap-0 overflow-hidden border-border/60 shadow-2xl sm:rounded-2xl">
        <DialogHeader className="relative overflow-hidden border-b border-primary/10 bg-gradient-to-br from-primary/15 via-background to-secondary/20 px-6 pb-4 pt-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 left-1/3 h-28 w-28 rounded-full bg-secondary/30 blur-2xl" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <DialogTitle className="flex items-center gap-2.5 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
                  <FileText className="h-4.5 w-4.5 h-4 w-4" />
                </span>
                Historia Clínica Nutricional
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-relaxed">
                Los datos se consolidan desde la ficha del paciente (solo lectura). Solo puedes editar el apartado de{" "}
                <span className="font-medium text-foreground">Seguimiento</span> antes de generar el PDF.
              </DialogDescription>
            </div>
            {patient ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                  {patient.nombres} {patient.apellidos}
                </Badge>
                {form.numero_historia ? (
                  <Badge variant="outline" className="rounded-full border-primary/30 bg-background/70 px-3 py-1 text-xs">
                    {form.numero_historia}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-28 text-muted-foreground">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <p className="text-sm">Cargando datos del paciente…</p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(94vh-200px)] px-4 py-4 sm:px-6">
            <div className="mx-auto max-w-4xl space-y-4 pb-6">
              <fieldset
                disabled
                className="m-0 min-w-0 space-y-4 border-0 p-0 disabled:opacity-100 [&_input]:bg-muted/35 [&_textarea]:bg-muted/35 [&_input]:cursor-not-allowed [&_textarea]:cursor-not-allowed"
              >
              <Section
                title="Información general"
                description="Identificación y contacto consolidados desde el registro del paciente."
                icon={UserRound}
                tone="accent"
              >
                <Hint>
                  Esta sección es de solo lectura. Los datos provienen de la ficha del paciente; solo el apartado de Seguimiento es editable.
                </Hint>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Fecha">
                    <Input className={inputClass} type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} />
                  </Field>
                  <Field label="Nº historia nutricional">
                    <Input className={inputClass} value={form.numero_historia} onChange={(e) => set("numero_historia", e.target.value)} />
                  </Field>
                  <Field label="Edad">
                    <Input className={inputClass} value={form.edad} onChange={(e) => set("edad", e.target.value)} />
                  </Field>
                  <Field label="Nombre" className="sm:col-span-2">
                    <Input className={inputClass} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
                  </Field>
                  <Field label="Fecha de nacimiento">
                    <Input className={inputClass} type="date" value={form.fecha_nacimiento} onChange={(e) => set("fecha_nacimiento", e.target.value)} />
                  </Field>
                  <Field label="Género">
                    <Input className={inputClass} value={form.genero} onChange={(e) => set("genero", e.target.value)} />
                  </Field>
                  <Field label="Tipo documento">
                    <Input className={inputClass} value={form.tipo_documento} onChange={(e) => set("tipo_documento", e.target.value)} />
                  </Field>
                  <Field label="Nº documento">
                    <Input className={inputClass} value={form.numero_documento} onChange={(e) => set("numero_documento", e.target.value)} />
                  </Field>
                  <Field label="Cuidador / acompañante (si aplica)" className="sm:col-span-3">
                    <Input className={inputClass} value={form.cuidador} onChange={(e) => set("cuidador", e.target.value)} />
                  </Field>
                  <Field label="Programa EPS / PyP (si aplica)" className="sm:col-span-3">
                    <Input className={inputClass} value={form.programa_pyp} onChange={(e) => set("programa_pyp", e.target.value)} />
                  </Field>
                  <Field label="Teléfono fijo">
                    <Input className={inputClass} value={form.telefono_fijo} onChange={(e) => set("telefono_fijo", e.target.value)} />
                  </Field>
                  <Field label="Celular">
                    <Input className={inputClass} value={form.celular} onChange={(e) => set("celular", e.target.value)} />
                  </Field>
                  <Field label="E-mail">
                    <Input className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </Field>
                </div>
              </Section>

              <Section
                title="Información de salud"
                description="Motivo, antecedentes y síntomas gastrointestinales."
                icon={HeartPulse}
              >
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Motivo de consulta">
                    <Textarea className={textareaClass} rows={2} value={form.motivo_consulta} onChange={(e) => set("motivo_consulta", e.target.value)} />
                  </Field>
                  <Field label="Presenta alergias o intolerancia a medicamentos">
                    <Textarea className={textareaClass} rows={2} value={form.enfermedad_actual} onChange={(e) => set("enfermedad_actual", e.target.value)} />
                  </Field>
                  <Field label="Antecedentes personales">
                    <Textarea className={textareaClass} rows={2} value={form.antecedentes_personales} onChange={(e) => set("antecedentes_personales", e.target.value)} />
                  </Field>
                  <Field label="Signos y síntomas gastrointestinales">
                    <Textarea className={textareaClass} rows={2} value={form.signos_sintomas} onChange={(e) => set("signos_sintomas", e.target.value)} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ["constipacion", "Constipación"],
                      ["diarrea", "Diarrea"],
                      ["vomito", "Vómito"],
                      ["reflujo", "Reflujo"],
                    ] as const).map(([key, label]) => (
                      <CheckChip
                        key={key}
                        checked={form[key]}
                        label={label}
                        disabled
                        onCheckedChange={(v) => set(key, v)}
                      />
                    ))}
                  </div>
                  <Field label="Otros síntomas">
                    <Input className={inputClass} value={form.otros_sintomas} onChange={(e) => set("otros_sintomas", e.target.value)} />
                  </Field>
                  <Field label="Antecedentes familiares">
                    <Textarea className={textareaClass} rows={2} value={form.antecedentes_familiares} onChange={(e) => set("antecedentes_familiares", e.target.value)} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ["fam_diabetes", "Diabetes"],
                      ["fam_cardiovascular", "Cardiovascular"],
                      ["fam_hipertension", "Hipertensión"],
                      ["fam_obesidad", "Obesidad"],
                    ] as const).map(([key, label]) => (
                      <CheckChip
                        key={key}
                        checked={form[key]}
                        label={label}
                        disabled
                        onCheckedChange={(v) => set(key, v)}
                      />
                    ))}
                  </div>
                </div>
              </Section>

              <Section
                title="Medicamentos y bioquímicos"
                description="Consumo actual y resultados de laboratorio."
                icon={Pill}
                tone="soft"
              >
                <Field label="Consumo actual de medicamentos y/o suplementos">
                  <Textarea className={textareaClass} rows={3} value={form.medicamentos} onChange={(e) => set("medicamentos", e.target.value)} />
                </Field>

                <div className="space-y-3 rounded-xl border border-border/50 bg-background/60 p-3 sm:p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Datos bioquímicos</h4>
                    <p className="text-xs text-muted-foreground">
                      Precargados desde la ficha (solo lectura).
                    </p>
                  </div>
                  <BioquimicosForm
                    value={normalizeBioquimicos(form)}
                    onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
                    disabled
                  />
                </div>
              </Section>

              <Section
                title="Información antropométrica"
                description="Solo se muestran medidas con información registrada."
                icon={Ruler}
              >
                {(() => {
                  const has = (v: string) => Boolean(v && String(v).trim());
                  const antroFields: Array<{
                    key: keyof HistoryForm;
                    label: string;
                    onChange?: (value: string) => void;
                  }> = [
                    {
                      key: "peso",
                      label: "Peso (kg)",
                      onChange: (value) => {
                        set("peso", value);
                        const imc = calcImc(value, form.talla);
                        if (imc) set("imc", imc);
                      },
                    },
                    {
                      key: "talla",
                      label: "Talla (cm)",
                      onChange: (value) => {
                        set("talla", value);
                        const imc = calcImc(form.peso, value);
                        if (imc) set("imc", imc);
                      },
                    },
                    { key: "peso_objetivo", label: "Peso objetivo (kg)" },
                    { key: "imc", label: "IMC" },
                    { key: "perimetro_cefalico", label: "P. cefálico" },
                    { key: "perimetro_braquial", label: "P. braquial" },
                    { key: "perimetro_cintura", label: "P. cintura" },
                    { key: "pliegue_tricipital", label: "Pliegue tricipital" },
                    { key: "pliegue_subescapular", label: "Pliegue subescapular" },
                  ];
                  const filled = antroFields.filter((f) => has(String(form[f.key] ?? "")));
                  return (
                    <div className="space-y-3">
                      {filled.length === 0 && !has(form.clasificacion_antropometrica) && !has(form.observaciones_antro) ? (
                        <p className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-3 py-4 text-center text-sm italic text-muted-foreground">
                          No hay datos antropométricos registrados.
                        </p>
                      ) : null}
                      {filled.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {filled.map((f) => (
                            <Field key={f.key} label={f.label}>
                              <Input
                                className={cn(inputClass, f.key === "imc" && "font-semibold text-primary")}
                                value={String(form[f.key] ?? "")}
                                onChange={(e) =>
                                  f.onChange
                                    ? f.onChange(e.target.value)
                                    : set(f.key, e.target.value as never)
                                }
                              />
                            </Field>
                          ))}
                        </div>
                      )}
                      {has(form.clasificacion_antropometrica) && (
                        <Field label="Clasificación antropométrica">
                          <Textarea
                            className={textareaClass}
                            rows={2}
                            value={form.clasificacion_antropometrica}
                            onChange={(e) => set("clasificacion_antropometrica", e.target.value)}
                          />
                        </Field>
                      )}
                      {has(form.observaciones_antro) && (
                        <Field label="Observaciones">
                          <Textarea
                            className={textareaClass}
                            rows={2}
                            value={form.observaciones_antro}
                            onChange={(e) => set("observaciones_antro", e.target.value)}
                          />
                        </Field>
                      )}
                    </div>
                  );
                })()}
              </Section>

              <Section
                title="Información alimentaria"
                description="Preferencias, recordatorio 24 h y frecuencia de consumo."
                icon={UtensilsCrossed}
              >
                <Hint>
                  Preferencias, recordatorio y frecuencia provienen del registro (solo lectura).
                </Hint>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Preferencias">
                    <Textarea className={textareaClass} rows={3} value={form.preferencias} onChange={(e) => set("preferencias", e.target.value)} />
                  </Field>
                  <Field label="Rechazos">
                    <Textarea className={textareaClass} rows={3} value={form.rechazos} onChange={(e) => set("rechazos", e.target.value)} />
                  </Field>
                  <Field label="Intolerancias / alergias">
                    <Textarea
                      className={textareaClass}
                      rows={3}
                      value={form.intolerancias}
                      onChange={(e) => set("intolerancias", e.target.value)}
                      placeholder="Ej.: lactosa, gluten, mariscos…"
                    />
                  </Field>
                </div>
                <div className="space-y-2 rounded-xl border border-border/50 bg-background/60 p-3 sm:p-4">
                  <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                    Recordatorio 24 horas
                  </Label>
                  <Recordatorio24hForm
                    patientId={patient!.id}
                    embedded
                    initialRecall={latestRecall}
                    hideActions
                    readOnly
                    onSummaryChange={(summary) => set("recordatorio_24h", summary)}
                    onSuccess={async () => {
                      try {
                        const token = localStorage.getItem("userToken");
                        const rRes = await fetch(`${API_URL}/patients/${patient!.id}/recalls`, {
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
                <div className="space-y-2 rounded-xl border border-border/50 bg-background/60 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                      Frecuencia de consumo de alimentos
                    </Label>
                  </div>
                  <FoodFrequencyForm
                    data={frecuenciaConsumo}
                    onChange={handleFrecuenciaChange}
                    readOnly
                  />
                </div>
                <Field label="Factores de riesgo">
                  <Textarea className={textareaClass} rows={2} value={form.factores_riesgo} onChange={(e) => set("factores_riesgo", e.target.value)} />
                </Field>
              </Section>

              <Section
                title="Diagnóstico nutricional PES"
                description="Problema / Etiología / Signos y síntomas."
                icon={Stethoscope}
                tone="accent"
              >
                <Textarea
                  className={cn(textareaClass, "min-h-[110px]")}
                  rows={4}
                  value={form.diagnostico_pes}
                  onChange={(e) => set("diagnostico_pes", e.target.value)}
                  placeholder="Problema / Etiología / Signos y síntomas"
                />
              </Section>

              <Section
                title="Tratamiento nutricional"
                description="Objetivos, requerimientos, minuta y educación."
                icon={ClipboardList}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Nivel de actividad física" className="sm:col-span-2">
                    <Input className={inputClass} value={form.nivel_actividad} onChange={(e) => set("nivel_actividad", e.target.value)} />
                  </Field>
                  <Field label="Factor PAL">
                    <Input className={inputClass} value={form.pal_factor} onChange={(e) => set("pal_factor", e.target.value)} />
                  </Field>
                </div>
                <Field label="Objetivos">
                  <Textarea className={textareaClass} rows={2} value={form.objetivos} onChange={(e) => set("objetivos", e.target.value)} />
                </Field>
                <Field label="Tipo de dieta y características">
                  <Textarea className={textareaClass} rows={2} value={form.tipo_dieta} onChange={(e) => set("tipo_dieta", e.target.value)} />
                </Field>
                <Field label="Determinación de requerimientos (cálculo calórico)">
                  <Textarea
                    className={cn(textareaClass, "min-h-[160px]")}
                    rows={8}
                    value={form.determinacion_requerimientos}
                    onChange={(e) => set("determinacion_requerimientos", e.target.value)}
                    placeholder="Se precarga con el cálculo calórico del plan activo…"
                  />
                </Field>
                <Field label="Minuta patrón">
                  <Textarea className={textareaClass} rows={3} value={form.minuta_patron} onChange={(e) => set("minuta_patron", e.target.value)} />
                </Field>
                <Field label="Recomendaciones">
                  <Textarea className={textareaClass} rows={3} value={form.recomendaciones} onChange={(e) => set("recomendaciones", e.target.value)} />
                </Field>
                <Field label="Plan de educación nutricional">
                  <Textarea className={textareaClass} rows={2} value={form.plan_educacion} onChange={(e) => set("plan_educacion", e.target.value)} />
                </Field>
              </Section>
              </fieldset>

              <Section
                title="Seguimiento"
                description="Único apartado editable. Completa la próxima cita y criterios de control."
                icon={CalendarClock}
                tone="soft"
              >
                <Hint>
                  Puedes modificar estos campos antes de generar el PDF.
                </Hint>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Próxima cita en (días)">
                    <Input className={inputClass} value={form.proxima_cita_dias} onChange={(e) => set("proxima_cita_dias", e.target.value)} />
                  </Field>
                  <Field label="Fecha próxima cita">
                    <Input className={inputClass} type="date" value={form.proxima_cita_fecha} onChange={(e) => set("proxima_cita_fecha", e.target.value)} />
                  </Field>
                </div>
                <Field label="Criterios a evaluar en la cita de control">
                  <Textarea className={textareaClass} rows={3} value={form.criterios_seguimiento} onChange={(e) => set("criterios_seguimiento", e.target.value)} />
                </Field>
                <Field label="Nota resumida en la historia clínica">
                  <Textarea className={textareaClass} rows={3} value={form.nota_resumida} onChange={(e) => set("nota_resumida", e.target.value)} />
                </Field>
              </Section>

              <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-muted/50 to-background px-4 py-3 text-xs text-muted-foreground">
                Pie de página del PDF:{" "}
                <span className="font-medium text-foreground">{footerPreview}</span>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 border-t border-border/60 bg-muted/30 px-6 py-4 sm:gap-3">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            className="rounded-xl gradient-primary text-primary-foreground shadow-md hover:opacity-95"
            onClick={handleGeneratePdf}
            disabled={loading || generating || !patient}
          >
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Generar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
