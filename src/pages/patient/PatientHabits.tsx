import { useCallback, useEffect, useState } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { Activity, Droplets, Footprints, Loader2, Moon, Plus, Save, Smile } from "lucide-react";

interface HabitsData {
  date: string;
  water: { amount_ml: number; target_ml: number; percentage: number };
  habits: {
    sleep_hours?: number | null;
    exercise_minutes?: number;
    stress_level?: number | null;
    digestion_notes?: string | null;
    mood?: string | null;
  };
  week_summary: {
    days_logged: number;
    avg_sleep?: number | null;
    total_exercise_minutes: number;
  };
}

const MOODS = ["😊 Bien", "😐 Regular", "😴 Cansado", "😣 Estresado", "🤢 Mal"];

export default function PatientHabits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingWater, setAddingWater] = useState(false);
  const [data, setData] = useState<HabitsData | null>(null);

  const [sleepHours, setSleepHours] = useState("7");
  const [exerciseMin, setExerciseMin] = useState("30");
  const [stress, setStress] = useState([2]);
  const [digestion, setDigestion] = useState("");
  const [mood, setMood] = useState("");
  const [steps, setSteps] = useState("0");
  const [wearableProgress, setWearableProgress] = useState(0);
  const [wearableGoal, setWearableGoal] = useState(8000);
  const [savingSteps, setSavingSteps] = useState(false);

  const patientId = user?.id;

  const headers = (json = false) => {
    const token = localStorage.getItem("userToken");
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/patient/${patientId}/habits/today`, { headers: headers() });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
      const h = json.habits || {};
      if (h.sleep_hours != null) setSleepHours(String(h.sleep_hours));
      if (h.exercise_minutes != null) setExerciseMin(String(h.exercise_minutes));
      if (h.stress_level != null) setStress([h.stress_level]);
      setDigestion(h.digestion_notes || "");
      setMood(h.mood || "");
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los hábitos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [patientId, toast]);

  const loadWearables = useCallback(async () => {
    if (!patientId) return;
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patient/${patientId}/wearables/today`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const w = await res.json();
        setSteps(String(w.steps ?? 0));
        setWearableProgress(w.progress_pct ?? 0);
        setWearableGoal(w.goal_steps ?? 8000);
      }
    } catch {
      /* optional */
    }
  }, [patientId]);

  useEffect(() => {
    load();
    loadWearables();
  }, [load, loadWearables]);

  const save = async () => {
    if (!patientId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/patient/${patientId}/habits/today`, {
        method: "PUT",
        headers: headers(true),
        body: JSON.stringify({
          sleep_hours: parseFloat(sleepHours) || 0,
          exercise_minutes: parseInt(exerciseMin, 10) || 0,
          stress_level: stress[0],
          digestion_notes: digestion || null,
          mood: mood || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Guardado", description: "Tus hábitos de hoy fueron registrados" });
      load();
    } catch {
      toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveSteps = async () => {
    if (!patientId) return;
    setSavingSteps(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patient/${patientId}/wearables/today`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ steps: parseInt(steps, 10) || 0, source: "manual" }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Pasos guardados" });
      loadWearables();
    } catch {
      toast({ title: "Error", description: "No se pudieron guardar los pasos", variant: "destructive" });
    } finally {
      setSavingSteps(false);
    }
  };

  const addWater = async () => {
    if (!patientId) return;
    setAddingWater(true);
    try {
      const res = await fetch(`${API_URL}/patient/${patientId}/water/add?glass_ml=250`, {
        method: "POST",
        headers: headers(),
      });
      if (!res.ok) throw new Error();
      load();
    } catch {
      toast({ title: "Error", description: "No se pudo registrar el agua", variant: "destructive" });
    } finally {
      setAddingWater(false);
    }
  };

  return (
    <PatientLayout>
      <LoadingGate loading={loading}>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-7 w-7 text-primary" />
              Bienestar y Hábitos
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Registra agua, sueño, ejercicio y cómo te sientes hoy
            </p>
          </div>

          {data && (
            <>
              <Card className="border-sky-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-sky-500" />
                    Hidratación
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold">
                        {(data.water.amount_ml / 1000).toFixed(1)}L
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          / {(data.water.target_ml / 1000).toFixed(1)}L
                        </span>
                      </p>
                    </div>
                    <Button size="sm" className="gap-1 rounded-full" disabled={addingWater} onClick={addWater}>
                      {addingWater ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Vaso (+250ml)
                    </Button>
                  </div>
                  <Progress value={data.water.percentage} className="h-2" />
                </CardContent>
              </Card>

              <Card className="border-emerald-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Footprints className="h-5 w-5 text-emerald-600" />
                    Actividad / Wearables
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Pasos de hoy</Label>
                      <Input type="number" min={0} value={steps} onChange={(e) => setSteps(e.target.value)} />
                    </div>
                    <Button size="sm" disabled={savingSteps} onClick={saveSteps}>
                      {savingSteps ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                    </Button>
                  </div>
                  <Progress value={wearableProgress} className="h-2" />
                  <p className="text-[10px] text-muted-foreground">
                    Meta: {wearableGoal.toLocaleString()} pasos · Registra manualmente o sincroniza desde tu reloj
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Registro de hoy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Moon className="h-4 w-4" />
                        Horas de sueño
                      </Label>
                      <Input type="number" min={0} max={24} step={0.5} value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Activity className="h-4 w-4" />
                        Ejercicio (minutos)
                      </Label>
                      <Input type="number" min={0} value={exerciseMin} onChange={(e) => setExerciseMin(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Nivel de estrés (1 = bajo, 5 = alto)</Label>
                    <Slider value={stress} onValueChange={setStress} min={1} max={5} step={1} />
                    <p className="text-xs text-muted-foreground text-center">{stress[0]}/5</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Smile className="h-4 w-4" />
                      Estado de ánimo
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {MOODS.map((m) => (
                        <Button
                          key={m}
                          type="button"
                          size="sm"
                          variant={mood === m ? "default" : "outline"}
                          className="text-xs"
                          onClick={() => setMood(m)}
                        >
                          {m}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notas digestivas (opcional)</Label>
                    <Textarea
                      placeholder="Ej. hinchazón después del almuerzo..."
                      value={digestion}
                      onChange={(e) => setDigestion(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <Button className="w-full gap-2" disabled={saving} onClick={save}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar hábitos de hoy
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Resumen de la semana</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div>
                    <p className="text-xl font-bold">{data.week_summary.days_logged}</p>
                    <p className="text-xs text-muted-foreground">Días registrados</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{data.week_summary.avg_sleep ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">Sueño prom.</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{data.week_summary.total_exercise_minutes}</p>
                    <p className="text-xs text-muted-foreground">Min. ejercicio</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </LoadingGate>
    </PatientLayout>
  );
}
