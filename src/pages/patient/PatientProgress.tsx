import { useState, useEffect } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Ruler,
  Target,
  Award,
  Plus,
  Loader2,
  Sparkles,
  Droplets,
  Activity,
  CalendarDays,
  Minus,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
} from "recharts";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { todayInColombiaISO, formatInColombia } from "@/lib/timezone";

interface ProgressData {
  has_data: boolean;
  summary: {
    current_weight: number;
    initial_weight: number;
    goal_weight: number;
    weight_change: number;
    progress_percentage: number;
    trend: string;
    edad_formateada?: string;
    last_update: string;
  };
  body_composition: {
    body_fat: number | null;
    muscle: number | null;
    water: number | null;
    waist: number | null;
    hip: number | null;
    chest: number | null;
    arm: number | null;
  };
  charts: {
    weight: Array<{ date: string; value: number }>;
    body_composition: Array<{ date: string; body_fat?: number; muscle?: number; water?: number }>;
  };
  achievements: Array<{
    icon?: string;
    title: string;
    date?: string;
    description?: string;
  }>;
}

function imcCategory(val: number) {
  if (val < 18.5) {
    return {
      label: "Bajo peso",
      className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-transparent",
    };
  }
  if (val < 25) {
    return {
      label: "Normal",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
    };
  }
  if (val < 30) {
    return {
      label: "Sobrepeso",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent",
    };
  }
  return {
    label: "Obesidad",
    className: "bg-destructive/15 text-destructive border-transparent",
  };
}

function formatDisplayDate(value?: string) {
  if (!value) return null;
  return formatInColombia(value) || value;
}

export default function PatientProgress() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const patientId = user?.id;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [metricForm, setMetricForm] = useState({
    date: todayInColombiaISO(),
    weight: "",
    body_fat: "",
    muscle: "",
    water: "",
    waist: "",
    hip: "",
    chest: "",
    arm: "",
    notes: "",
  });

  useEffect(() => {
    if (!isAuthLoading && patientId) {
      fetchProgressData();
    }
  }, [isAuthLoading, patientId]);

  const fetchProgressData = async () => {
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patient/${patientId}/progress`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error("Error fetching progress");
      const data = await response.json();
      setProgressData(data);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar tus datos de progreso",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetMetricForm = () => {
    setMetricForm({
      date: todayInColombiaISO(),
      weight: "",
      body_fat: "",
      muscle: "",
      water: "",
      waist: "",
      hip: "",
      chest: "",
      arm: "",
      notes: "",
    });
  };

  const handleAddMetric = async () => {
    if (!metricForm.weight) {
      toast({
        title: "Error",
        description: "El peso es obligatorio",
        variant: "destructive",
      });
      return;
    }

    setSavingStatus(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patient/${patientId}/progress/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          patient_id: patientId,
          date: metricForm.date,
          weight: parseFloat(metricForm.weight),
          body_fat: metricForm.body_fat ? parseFloat(metricForm.body_fat) : null,
          muscle: metricForm.muscle ? parseFloat(metricForm.muscle) : null,
          water: metricForm.water ? parseFloat(metricForm.water) : null,
          waist: metricForm.waist ? parseFloat(metricForm.waist) : null,
          hip: metricForm.hip ? parseFloat(metricForm.hip) : null,
          chest: metricForm.chest ? parseFloat(metricForm.chest) : null,
          arm: metricForm.arm ? parseFloat(metricForm.arm) : null,
          notes: metricForm.notes || null,
        }),
      });

      if (!response.ok) throw new Error("Error saving metric");

      toast({
        title: "¡Éxito!",
        description: "Progreso registrado correctamente",
      });

      setIsAddModalOpen(false);
      resetMetricForm();
      fetchProgressData();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el progreso",
        variant: "destructive",
      });
    } finally {
      setSavingStatus(false);
    }
  };

  const calculateIMC = (weight: number) => {
    const altura = (user as { altura?: number } | null)?.altura;
    if (!altura) return null;
    const heightM = altura / 100;
    if (!heightM) return null;
    return (weight / (heightM * heightM)).toFixed(1);
  };

  const renderAddModal = () => (
    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Registrar progreso</DialogTitle>
          <DialogDescription>
            Guarda tu medición del día. El peso es obligatorio; el resto es opcional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                className="rounded-xl"
                value={metricForm.date}
                onChange={(e) => setMetricForm({ ...metricForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Peso (kg) *</Label>
              <Input
                type="number"
                step="0.1"
                className="rounded-xl"
                placeholder="72.5"
                value={metricForm.weight}
                onChange={(e) => setMetricForm({ ...metricForm, weight: e.target.value })}
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
              Composición corporal
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Grasa %</Label>
                <Input
                  type="number"
                  step="0.1"
                  className="rounded-xl"
                  value={metricForm.body_fat}
                  onChange={(e) => setMetricForm({ ...metricForm, body_fat: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Músculo %</Label>
                <Input
                  type="number"
                  step="0.1"
                  className="rounded-xl"
                  value={metricForm.muscle}
                  onChange={(e) => setMetricForm({ ...metricForm, muscle: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Agua %</Label>
                <Input
                  type="number"
                  step="0.1"
                  className="rounded-xl"
                  value={metricForm.water}
                  onChange={(e) => setMetricForm({ ...metricForm, water: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 py-1">
            <div className="h-px bg-border flex-1" />
            <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">
              Medidas (cm)
            </span>
            <div className="h-px bg-border flex-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["waist", "Cintura"],
              ["hip", "Cadera"],
              ["chest", "Pecho"],
              ["arm", "Brazo"],
            ].map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number"
                  step="0.1"
                  className="rounded-xl"
                  value={metricForm[key as keyof typeof metricForm]}
                  onChange={(e) => setMetricForm({ ...metricForm, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              className="rounded-xl resize-none"
              rows={3}
              placeholder="Cómo te sentiste, cambio de rutina…"
              value={metricForm.notes}
              onChange={(e) => setMetricForm({ ...metricForm, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="rounded-full" onClick={() => setIsAddModalOpen(false)}>
            Cancelar
          </Button>
          <Button className="rounded-full" onClick={handleAddMetric} disabled={savingStatus}>
            {savingStatus ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar registro"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (loading || isAuthLoading) {
    return (
      <PatientLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando tu progreso…</p>
        </div>
      </PatientLayout>
    );
  }

  const hasProgressData = !!(progressData && progressData.has_data);

  if (!hasProgressData) {
    return (
      <PatientLayout>
        <div className="space-y-5 lg:space-y-7 animate-fade-in">
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.08] p-5 sm:p-6 shadow-card">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Panel del paciente
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Mi Progreso</h1>
              <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-xl">
                Sigue tu evolución de peso, medidas y composición corporal.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-16 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-4">
              <Scale className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Aún no hay datos de progreso</h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm">
              Registra tu primera medición o espera a que tu nutricionista la cargue en consulta.
            </p>
            <Button className="rounded-full mt-5 gap-2" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Registrar primera medición
            </Button>
          </div>
          {renderAddModal()}
        </div>
      </PatientLayout>
    );
  }

  const { summary, body_composition, charts, achievements } = progressData!;
  const imc = calculateIMC(summary.current_weight);
  const imcMeta = imc ? imcCategory(parseFloat(imc)) : null;
  const remainingKg = Math.abs(summary.goal_weight - summary.current_weight);
  const lostTowardGoal = summary.initial_weight - summary.current_weight;
  const progressPct = Math.max(0, Math.min(100, summary.progress_percentage ?? 0));
  const weightChangePositive = summary.weight_change > 0;
  const weightChangeNeutral = summary.weight_change === 0;
  const lastUpdateLabel = formatDisplayDate(summary.last_update);

  const compositionBars = [
    {
      label: "Grasa",
      value: body_composition.body_fat,
      color: "bg-rose-500",
      track: "bg-rose-500/15",
      text: "text-rose-600 dark:text-rose-400",
    },
    {
      label: "Músculo",
      value: body_composition.muscle,
      color: "bg-emerald-500",
      track: "bg-emerald-500/15",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Agua",
      value: body_composition.water,
      color: "bg-sky-500",
      track: "bg-sky-500/15",
      text: "text-sky-600 dark:text-sky-400",
    },
  ] as const;

  const measureItems = [
    { label: "Cintura", value: body_composition.waist, tone: "from-primary/12 to-primary/5 text-primary" },
    { label: "Cadera", value: body_composition.hip, tone: "from-violet-500/12 to-violet-500/5 text-violet-600 dark:text-violet-400" },
    { label: "Pecho", value: body_composition.chest, tone: "from-amber-500/12 to-amber-500/5 text-amber-600 dark:text-amber-400" },
    { label: "Brazo", value: body_composition.arm, tone: "from-sky-500/12 to-sky-500/5 text-sky-600 dark:text-sky-400" },
  ];

  return (
    <PatientLayout>
      <div className="space-y-5 lg:space-y-7 animate-fade-in">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-emerald-500/[0.08] p-5 sm:p-6 shadow-card">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-14 left-1/4 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Panel del paciente
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Mi Progreso</h1>
              <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-xl">
                Tu evolución de peso, IMC, medidas y logros en un solo vistazo.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {summary.edad_formateada && (
                  <Badge
                    variant="secondary"
                    className="rounded-full bg-primary/10 text-primary border-0 text-[10px] uppercase font-bold tracking-wide"
                  >
                    {summary.edad_formateada}
                  </Badge>
                )}
                {lastUpdateLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
                    <CalendarDays className="h-3.5 w-3.5 text-primary/70" />
                    Actualizado: {lastUpdateLabel}
                  </span>
                )}
              </div>
            </div>

            <Button className="gap-2 w-full sm:w-auto rounded-full shadow-sm" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Registrar medición
            </Button>
          </div>

          {/* Goal progress strip */}
          <div className="relative mt-5 rounded-2xl border border-border/60 bg-background/55 p-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  Avance hacia tu meta
                </p>
                <p className="text-sm text-foreground mt-0.5">
                  <span className="font-semibold tabular-nums">{summary.current_weight} kg</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="font-semibold tabular-nums text-primary">{summary.goal_weight} kg</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-foreground">{progressPct}%</p>
                <p className="text-[11px] text-muted-foreground">
                  Faltan {remainingKg.toFixed(1)} kg
                </p>
              </div>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>Inicio: {summary.initial_weight} kg</span>
              <span>
                {lostTowardGoal >= 0 ? "Bajaste" : "Subiste"} {Math.abs(lostTowardGoal).toFixed(1)} kg
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card backdrop-blur-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  Peso actual
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {summary.current_weight}
                  <span className="text-sm font-medium text-muted-foreground ml-1">kg</span>
                </p>
                <div
                  className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium ${
                    weightChangeNeutral
                      ? "text-muted-foreground"
                      : weightChangePositive
                        ? "text-sky-600 dark:text-sky-400"
                        : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {weightChangeNeutral ? (
                    <Minus className="h-3.5 w-3.5" />
                  ) : weightChangePositive ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {summary.weight_change > 0 ? "+" : ""}
                  {summary.weight_change} kg
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center">
                <Scale className="h-[18px] w-[18px]" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card backdrop-blur-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">IMC</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{imc || "—"}</p>
                {imcMeta && (
                  <Badge className={`mt-1.5 rounded-full text-[10px] ${imcMeta.className}`}>
                    {imcMeta.label}
                  </Badge>
                )}
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Ruler className="h-[18px] w-[18px]" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card backdrop-blur-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Meta</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {summary.goal_weight}
                  <span className="text-sm font-medium text-muted-foreground ml-1">kg</span>
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Faltan <span className="font-semibold text-foreground">{remainingKg.toFixed(1)} kg</span>
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <Target className="h-[18px] w-[18px]" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card backdrop-blur-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  Progreso
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{progressPct}%</p>
                <Progress value={progressPct} className="mt-2.5 h-1.5 w-full max-w-[5.5rem]" />
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                {summary.trend === "down" ? (
                  <TrendingDown className="h-[18px] w-[18px]" />
                ) : (
                  <TrendingUp className="h-[18px] w-[18px]" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
          {/* Weight Chart */}
          <Card className="lg:col-span-2 border-border/70 shadow-card overflow-hidden rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04]">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Scale className="h-4 w-4" />
                </span>
                Evolución del peso
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm mt-1">
                Últimos registros de peso corporal
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 lg:p-5">
              {charts.weight?.length ? (
                <ResponsiveContainer width="100%" height={250} className="lg:!h-[300px]">
                  <AreaChart data={charts.weight}>
                    <defs>
                      <linearGradient id="colorPeso" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(145, 63%, 42%)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(145, 63%, 42%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.7} />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(150, 10%, 45%)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(150, 10%, 45%)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      domain={["dataMin - 2", "dataMax + 2"]}
                      width={32}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "12px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(145, 63%, 42%)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorPeso)"
                      name="Peso (kg)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground text-sm">
                  <Activity className="h-8 w-8 mb-2 opacity-40" />
                  Sin suficientes puntos para graficar
                </div>
              )}
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card className="border-border/70 shadow-card overflow-hidden rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-amber-500/[0.05]">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Award className="h-4 w-4" />
                  </span>
                  Logros
                </CardTitle>
                {achievements.length > 0 && (
                  <Badge variant="secondary" className="rounded-full tabular-nums">
                    {achievements.length}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 max-h-[320px] overflow-y-auto custom-scrollbar">
              {achievements.length > 0 ? (
                achievements.map((achievement, index) => (
                  <div
                    key={`${achievement.title}-${index}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/70 bg-gradient-to-br from-muted/40 to-transparent transition-all duration-200 hover:border-amber-500/30 hover:bg-amber-500/[0.04]"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-xl ring-1 ring-amber-500/15">
                      {achievement.icon || "🏆"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{achievement.title}</p>
                      {achievement.date && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{achievement.date}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 px-3">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/70">
                    <Award className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Sin logros todavía</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pronto verás aquí tus reconocimientos
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Measurements + composition */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
          <Card className="border-border/70 shadow-card overflow-hidden rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-violet-500/[0.04]">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Ruler className="h-4 w-4" />
                </span>
                Medidas corporales
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm mt-1">Últimas circunferencias registradas</CardDescription>
            </CardHeader>
            <CardContent className="p-4 lg:p-5">
              <div className="grid grid-cols-2 gap-3">
                {measureItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-border"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                      <div
                        className={`h-8 w-8 rounded-lg bg-gradient-to-br ${item.tone} flex items-center justify-center`}
                      >
                        <Ruler className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-foreground">
                      {item.value ?? "—"}
                      <span className="text-xs font-medium text-muted-foreground ml-1">cm</span>
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-card overflow-hidden rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-rose-500/[0.04]">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <Droplets className="h-4 w-4" />
                </span>
                Composición corporal
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm mt-1">
                Grasa, músculo y evolución reciente
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 lg:p-5 space-y-5">
              <div className="space-y-3">
                {compositionBars.map((bar) => (
                  <div key={bar.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-medium ${bar.text}`}>{bar.label}</span>
                      <span className="text-xs font-semibold tabular-nums text-foreground">
                        {bar.value != null ? `${bar.value}%` : "—"}
                      </span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${bar.track}`}>
                      <div
                        className={`h-full rounded-full ${bar.color} transition-all duration-700`}
                        style={{ width: `${Math.max(0, Math.min(100, Number(bar.value) || 0))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-[180px] rounded-xl border border-border/60 bg-muted/20 p-2">
                {charts.body_composition?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={charts.body_composition}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} width={28} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          fontSize: "11px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="body_fat"
                        stroke="hsl(0, 72%, 55%)"
                        name="Grasa %"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="muscle"
                        stroke="hsl(145, 63%, 42%)"
                        name="Músculo %"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                    <TrendingUp className="h-6 w-6 opacity-40" />
                    Sin datos de composición aún
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {renderAddModal()}
      </div>
    </PatientLayout>
  );
}
