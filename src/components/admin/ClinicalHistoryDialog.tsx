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
import { Separator } from "@/components/ui/separator";
import { Loader2, FileText, Download } from "lucide-react";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";

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
}

type HistoryForm = {
  fecha: string;
  numero_historia: string;
  nombre: string;
  fecha_nacimiento: string;
  edad: string;
  cuidador: string;
  telefono_fijo: string;
  celular: string;
  email: string;
  nivel_educativo: string;
  estrato: string;
  seguridad_social: string;
  programa_pyp: string;
  nivel_actividad: string;
  motivo_consulta: string;
  enfermedad_actual: string;
  antecedentes_personales: string;
  signos_sintomas: string;
  constipacion: boolean;
  diarrea: boolean;
  vomito: boolean;
  reflujo: boolean;
  otros_sintomas: string;
  antecedentes_familiares: string;
  fam_diabetes: boolean;
  fam_cardiovascular: boolean;
  fam_hipertension: boolean;
  fam_obesidad: boolean;
  fam_otros: string;
  medicamentos: string;
  bioquimicos: string;
  peso: string;
  talla: string;
  perimetro_cefalico: string;
  perimetro_braquial: string;
  perimetro_cintura: string;
  pliegue_tricipital: string;
  pliegue_subescapular: string;
  imc: string;
  clasificacion_antropometrica: string;
  observaciones_antro: string;
  preferencias: string;
  rechazos: string;
  intolerancias: string;
  recordatorio_24h: string;
  analisis_cuantitativo: string;
  evaluacion_consumo: string;
  factores_riesgo: string;
  diagnostico_pes: string;
  objetivos: string;
  tipo_dieta: string;
  determinacion_requerimientos: string;
  formula_sintetica_inicial: string;
  formula_desarrollada: string;
  formula_sintetica_final: string;
  minuta_patron: string;
  ejemplo_menu: string;
  recomendaciones: string;
  plan_educacion: string;
  proxima_cita_dias: string;
  proxima_cita_fecha: string;
  criterios_seguimiento: string;
  nota_resumida: string;
};

const emptyForm = (): HistoryForm => ({
  fecha: new Date().toISOString().slice(0, 10),
  numero_historia: "",
  nombre: "",
  fecha_nacimiento: "",
  edad: "",
  cuidador: "",
  telefono_fijo: "",
  celular: "",
  email: "",
  nivel_educativo: "",
  estrato: "",
  seguridad_social: "",
  programa_pyp: "",
  nivel_actividad: "",
  motivo_consulta: "",
  enfermedad_actual: "",
  antecedentes_personales: "",
  signos_sintomas: "",
  constipacion: false,
  diarrea: false,
  vomito: false,
  reflujo: false,
  otros_sintomas: "",
  antecedentes_familiares: "",
  fam_diabetes: false,
  fam_cardiovascular: false,
  fam_hipertension: false,
  fam_obesidad: false,
  fam_otros: "",
  medicamentos: "No reporta.",
  bioquimicos: "",
  peso: "",
  talla: "",
  perimetro_cefalico: "",
  perimetro_braquial: "",
  perimetro_cintura: "",
  pliegue_tricipital: "",
  pliegue_subescapular: "",
  imc: "",
  clasificacion_antropometrica: "",
  observaciones_antro: "",
  preferencias: "",
  rechazos: "",
  intolerancias: "",
  recordatorio_24h: "",
  analisis_cuantitativo: "",
  evaluacion_consumo: "",
  factores_riesgo: "",
  diagnostico_pes: "",
  objetivos: "",
  tipo_dieta: "",
  determinacion_requerimientos: "",
  formula_sintetica_inicial: "",
  formula_desarrollada: "",
  formula_sintetica_final: "",
  minuta_patron: "",
  ejemplo_menu: "",
  recomendaciones: "",
  plan_educacion: "",
  proxima_cita_dias: "",
  proxima_cita_fecha: "",
  criterios_seguimiento: "",
  nota_resumida: "",
});

function calcImc(peso?: number | null, alturaCm?: number | null): string {
  if (!(peso && alturaCm && alturaCm > 0)) return "";
  const m = alturaCm / 100;
  return (peso / (m * m)).toFixed(2);
}

function formatDob(raw?: string | null): string {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(raw).slice(0, 10);
  }
}

function joinList(v?: string[] | string | null): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  return String(v);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-bold tracking-wide text-primary uppercase">{title}</h3>
      <Separator />
      {children}
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
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
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
  const [form, setForm] = useState<HistoryForm>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [nutritionistName, setNutritionistName] = useState("");
  const [nutritionistLicense, setNutritionistLicense] = useState("");

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
        try {
          const rRes = await fetch(`${API_URL}/patients/${patient.id}/recalls`, { headers });
          if (rRes.ok) {
            const recalls = await rRes.json();
            const last = Array.isArray(recalls) && recalls.length ? recalls[0] : null;
            if (last) {
              recallText = [
                last.desayuno && `Desayuno: ${last.desayuno}`,
                last.media_manana && `Media mañana: ${last.media_manana}`,
                last.almuerzo && `Almuerzo: ${last.almuerzo}`,
                last.media_tarde && `Media tarde: ${last.media_tarde}`,
                last.cena && `Cena: ${last.cena}`,
                last.snack_nocturno && `Algo/nocturno: ${last.snack_nocturno}`,
                last.observaciones && `Obs.: ${last.observaciones}`,
              ]
                .filter(Boolean)
                .join("\n");
            }
          }
        } catch {
          /* ignore */
        }

        // Plan activo → macros / requerimiento
        let reqText = "";
        let formulaInicial = "";
        let formulaDesarrollada = "";
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
              const f1 = plan.fase_1 || {};
              const f2 = plan.fase_2 || {};
              const f3 = plan.fase_3 || {};
              const f4 = plan.fase_4 || {};
              const kcal = f1.requerimiento_energetico || plan.calories || "";
              reqText = [
                kcal ? `Requerimiento energético: ${kcal} kcal` : "",
                f2.proteinas_gramos ? `Proteínas: ${f2.proteinas_gramos} g (${f2.proteinas_amdr || ""}%)` : "",
                f2.grasas_gramos ? `Grasas: ${f2.grasas_gramos} g (${f2.grasas_amdr || ""}%)` : "",
                f2.cho_gramos || f2.carbohidratos_gramos
                  ? `CHOs: ${f2.cho_gramos || f2.carbohidratos_gramos} g`
                  : "",
              ]
                .filter(Boolean)
                .join("\n");
              formulaInicial = reqText;
              if (f3.grupos || f3.grupos_alimentos) {
                const grupos = f3.grupos || f3.grupos_alimentos;
                formulaDesarrollada = Object.entries(grupos)
                  .map(([k, v]: any) => `${k}: ${v?.porciones ?? v ?? ""} porciones`)
                  .join("\n");
              }
              if (f4.minuta || f4.distribucion) {
                minuta = typeof f4.minuta === "string" ? f4.minuta : JSON.stringify(f4.minuta || f4.distribucion, null, 2);
              }
            }
          }
        } catch {
          /* ignore */
        }

        const fam = String(p.antecedentes_familiares || "").toLowerCase();
        const next: HistoryForm = {
          ...emptyForm(),
          fecha: new Date().toISOString().slice(0, 10),
          numero_historia: `HN-${p.id}-${new Date().getFullYear()}`,
          nombre: `${p.nombres || ""} ${p.apellidos || ""}`.trim(),
          fecha_nacimiento: formatDob(p.fecha_nacimiento),
          edad: p.edad_formateada || "",
          celular: p.telefono || "",
          email: p.email || "",
          nivel_actividad: p.nivel_actividad || "",
          enfermedad_actual: p.condiciones_medicas || "",
          antecedentes_personales: joinList(p.alergias) ? `Alergias: ${joinList(p.alergias)}` : "",
          antecedentes_familiares: p.antecedentes_familiares || "",
          fam_diabetes: fam.includes("diabetes"),
          fam_cardiovascular: fam.includes("cardio") || fam.includes("corazón") || fam.includes("corazon"),
          fam_hipertension: fam.includes("hipertens"),
          fam_obesidad: fam.includes("obesidad") || fam.includes("sobrepeso"),
          peso: p.peso_actual != null ? String(p.peso_actual) : "",
          talla: p.altura != null ? String(p.altura) : "",
          imc: calcImc(p.peso_actual, p.altura),
          preferencias: joinList(p.preferencias),
          rechazos: p.alimentos_disgusto || "",
          intolerancias: joinList(p.alergias),
          recordatorio_24h: recallText,
          diagnostico_pes: p.evaluacion_nutricional || "",
          objetivos: p.objetivos_salud || "",
          determinacion_requerimientos: reqText,
          formula_sintetica_inicial: formulaInicial,
          formula_desarrollada: formulaDesarrollada,
          formula_sintetica_final: formulaInicial,
          minuta_patron: minuta,
          nota_resumida: p.evaluacion_nutricional || "",
        };

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
      const dateStr = new Date().toISOString().slice(0, 10);
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
      <DialogContent className="max-w-4xl max-h-[92vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Formato Historia Clínica Nutricional
          </DialogTitle>
          <DialogDescription>
            Datos precargados del paciente. Completa o ajusta los campos y genera el PDF.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando datos del paciente…
          </div>
        ) : (
          <ScrollArea className="h-[calc(92vh-180px)] px-6 py-4">
            <div className="space-y-4 pb-4">
              <Section title="Información general">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Fecha"><Input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
                  <Field label="Nº historia nutricional"><Input value={form.numero_historia} onChange={(e) => set("numero_historia", e.target.value)} /></Field>
                  <Field label="Edad"><Input value={form.edad} onChange={(e) => set("edad", e.target.value)} /></Field>
                  <Field label="Nombre" className="sm:col-span-2"><Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} /></Field>
                  <Field label="Fecha de nacimiento"><Input type="date" value={form.fecha_nacimiento} onChange={(e) => set("fecha_nacimiento", e.target.value)} /></Field>
                  <Field label="Cuidador (si aplica)" className="sm:col-span-3"><Input value={form.cuidador} onChange={(e) => set("cuidador", e.target.value)} /></Field>
                  <Field label="Teléfono fijo"><Input value={form.telefono_fijo} onChange={(e) => set("telefono_fijo", e.target.value)} /></Field>
                  <Field label="Celular"><Input value={form.celular} onChange={(e) => set("celular", e.target.value)} /></Field>
                  <Field label="E-mail"><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
                  <Field label="Nivel educativo"><Input value={form.nivel_educativo} onChange={(e) => set("nivel_educativo", e.target.value)} /></Field>
                  <Field label="Estrato socioeconómico"><Input value={form.estrato} onChange={(e) => set("estrato", e.target.value)} /></Field>
                  <Field label="Seguridad social"><Input value={form.seguridad_social} onChange={(e) => set("seguridad_social", e.target.value)} /></Field>
                  <Field label="Programa de promoción y prevención" className="sm:col-span-3"><Input value={form.programa_pyp} onChange={(e) => set("programa_pyp", e.target.value)} /></Field>
                  <Field label="Nivel de actividad física" className="sm:col-span-3"><Input value={form.nivel_actividad} onChange={(e) => set("nivel_actividad", e.target.value)} /></Field>
                </div>
              </Section>

              <Section title="Información de salud">
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Motivo de consulta"><Textarea rows={2} value={form.motivo_consulta} onChange={(e) => set("motivo_consulta", e.target.value)} /></Field>
                  <Field label="Sufre alguna enfermedad actualmente"><Textarea rows={2} value={form.enfermedad_actual} onChange={(e) => set("enfermedad_actual", e.target.value)} /></Field>
                  <Field label="Antecedentes personales"><Textarea rows={2} value={form.antecedentes_personales} onChange={(e) => set("antecedentes_personales", e.target.value)} /></Field>
                  <Field label="Signos y síntomas"><Textarea rows={2} value={form.signos_sintomas} onChange={(e) => set("signos_sintomas", e.target.value)} /></Field>
                  <div className="flex flex-wrap gap-4">
                    {([
                      ["constipacion", "Constipación"],
                      ["diarrea", "Diarrea"],
                      ["vomito", "Vómito"],
                      ["reflujo", "Reflujo"],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={form[key]} onCheckedChange={(v) => set(key, !!v)} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Field label="Otros síntomas"><Input value={form.otros_sintomas} onChange={(e) => set("otros_sintomas", e.target.value)} /></Field>
                  <Field label="Antecedentes familiares"><Textarea rows={2} value={form.antecedentes_familiares} onChange={(e) => set("antecedentes_familiares", e.target.value)} /></Field>
                  <div className="flex flex-wrap gap-4">
                    {([
                      ["fam_diabetes", "Diabetes"],
                      ["fam_cardiovascular", "Cardiovascular"],
                      ["fam_hipertension", "Hipertensión"],
                      ["fam_obesidad", "Obesidad"],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={form[key]} onCheckedChange={(v) => set(key, !!v)} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Field label="Otros familiares"><Input value={form.fam_otros} onChange={(e) => set("fam_otros", e.target.value)} /></Field>
                </div>
              </Section>

              <Section title="Medicamentos / suplementos y datos bioquímicos">
                <Field label="Consumo actual de medicamentos y/o suplementos">
                  <Textarea rows={3} value={form.medicamentos} onChange={(e) => set("medicamentos", e.target.value)} />
                </Field>
                <Field label="Datos bioquímicos (Hb, Hto, glicemia, lípidos, etc.)">
                  <Textarea rows={3} value={form.bioquimicos} onChange={(e) => set("bioquimicos", e.target.value)} />
                </Field>
              </Section>

              <Section title="Información antropométrica">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="Peso (kg)"><Input value={form.peso} onChange={(e) => {
                    set("peso", e.target.value);
                    const imc = calcImc(parseFloat(e.target.value), parseFloat(form.talla));
                    if (imc) set("imc", imc);
                  }} /></Field>
                  <Field label="Talla (cm)"><Input value={form.talla} onChange={(e) => {
                    set("talla", e.target.value);
                    const imc = calcImc(parseFloat(form.peso), parseFloat(e.target.value));
                    if (imc) set("imc", imc);
                  }} /></Field>
                  <Field label="IMC"><Input value={form.imc} onChange={(e) => set("imc", e.target.value)} /></Field>
                  <Field label="P. cefálico"><Input value={form.perimetro_cefalico} onChange={(e) => set("perimetro_cefalico", e.target.value)} /></Field>
                  <Field label="P. braquial"><Input value={form.perimetro_braquial} onChange={(e) => set("perimetro_braquial", e.target.value)} /></Field>
                  <Field label="P. cintura"><Input value={form.perimetro_cintura} onChange={(e) => set("perimetro_cintura", e.target.value)} /></Field>
                  <Field label="Pliegue tricipital"><Input value={form.pliegue_tricipital} onChange={(e) => set("pliegue_tricipital", e.target.value)} /></Field>
                  <Field label="Pliegue subescapular"><Input value={form.pliegue_subescapular} onChange={(e) => set("pliegue_subescapular", e.target.value)} /></Field>
                </div>
                <Field label="Clasificación antropométrica"><Textarea rows={2} value={form.clasificacion_antropometrica} onChange={(e) => set("clasificacion_antropometrica", e.target.value)} /></Field>
                <Field label="Observaciones"><Textarea rows={2} value={form.observaciones_antro} onChange={(e) => set("observaciones_antro", e.target.value)} /></Field>
              </Section>

              <Section title="Información alimentaria">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Preferencias"><Textarea rows={3} value={form.preferencias} onChange={(e) => set("preferencias", e.target.value)} /></Field>
                  <Field label="Rechazos"><Textarea rows={3} value={form.rechazos} onChange={(e) => set("rechazos", e.target.value)} /></Field>
                  <Field label="Intolerancias"><Textarea rows={3} value={form.intolerancias} onChange={(e) => set("intolerancias", e.target.value)} /></Field>
                </div>
                <Field label="Recordatorio 24 horas"><Textarea rows={5} value={form.recordatorio_24h} onChange={(e) => set("recordatorio_24h", e.target.value)} /></Field>
                <Field label="Análisis cuantitativo de consumo"><Textarea rows={3} value={form.analisis_cuantitativo} onChange={(e) => set("analisis_cuantitativo", e.target.value)} /></Field>
                <Field label="Evaluación consumo de alimentos"><Textarea rows={3} value={form.evaluacion_consumo} onChange={(e) => set("evaluacion_consumo", e.target.value)} /></Field>
                <Field label="Factores de riesgo"><Textarea rows={2} value={form.factores_riesgo} onChange={(e) => set("factores_riesgo", e.target.value)} /></Field>
              </Section>

              <Section title="Diagnóstico nutricional PES">
                <Textarea rows={4} value={form.diagnostico_pes} onChange={(e) => set("diagnostico_pes", e.target.value)} placeholder="Problema / Etiología / Signos y síntomas" />
              </Section>

              <Section title="Tratamiento nutricional">
                <Field label="Objetivos"><Textarea rows={2} value={form.objetivos} onChange={(e) => set("objetivos", e.target.value)} /></Field>
                <Field label="Tipo de dieta y características"><Textarea rows={2} value={form.tipo_dieta} onChange={(e) => set("tipo_dieta", e.target.value)} /></Field>
                <Field label="Determinación de requerimientos"><Textarea rows={3} value={form.determinacion_requerimientos} onChange={(e) => set("determinacion_requerimientos", e.target.value)} /></Field>
                <Field label="Fórmula sintética inicial"><Textarea rows={3} value={form.formula_sintetica_inicial} onChange={(e) => set("formula_sintetica_inicial", e.target.value)} /></Field>
                <Field label="Fórmula desarrollada"><Textarea rows={3} value={form.formula_desarrollada} onChange={(e) => set("formula_desarrollada", e.target.value)} /></Field>
                <Field label="Fórmula sintética final"><Textarea rows={3} value={form.formula_sintetica_final} onChange={(e) => set("formula_sintetica_final", e.target.value)} /></Field>
                <Field label="Minuta patrón"><Textarea rows={3} value={form.minuta_patron} onChange={(e) => set("minuta_patron", e.target.value)} /></Field>
                <Field label="Ejemplo de menú"><Textarea rows={3} value={form.ejemplo_menu} onChange={(e) => set("ejemplo_menu", e.target.value)} /></Field>
                <Field label="Recomendaciones"><Textarea rows={3} value={form.recomendaciones} onChange={(e) => set("recomendaciones", e.target.value)} /></Field>
                <Field label="Plan de educación nutricional"><Textarea rows={2} value={form.plan_educacion} onChange={(e) => set("plan_educacion", e.target.value)} /></Field>
              </Section>

              <Section title="Seguimiento">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Próxima cita en (días)"><Input value={form.proxima_cita_dias} onChange={(e) => set("proxima_cita_dias", e.target.value)} /></Field>
                  <Field label="Fecha próxima cita"><Input type="date" value={form.proxima_cita_fecha} onChange={(e) => set("proxima_cita_fecha", e.target.value)} /></Field>
                </div>
                <Field label="Criterios a evaluar en la cita de control">
                  <Textarea rows={3} value={form.criterios_seguimiento} onChange={(e) => set("criterios_seguimiento", e.target.value)} />
                </Field>
                <Field label="Nota resumida en la historia clínica">
                  <Textarea rows={3} value={form.nota_resumida} onChange={(e) => set("nota_resumida", e.target.value)} />
                </Field>
              </Section>

              <p className="text-xs text-muted-foreground border rounded-md p-3 bg-muted/40">
                Pie de página del PDF: <span className="font-medium text-foreground">{footerPreview}</span>
              </p>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="px-6 py-4 border-t gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={handleGeneratePdf} disabled={loading || generating || !patient}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Generar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
