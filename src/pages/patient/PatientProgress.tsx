import { useState, useEffect } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { TrendingUp, TrendingDown, Scale, Ruler, Target, Award, Calendar, Plus, Loader2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Line, LineChart as RechartsLineChart } from "recharts";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

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
    weight: any[];
    body_composition: any[];
  };
  achievements: any[];
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
    date: new Date().toISOString().split('T')[0],
    weight: "",
    body_fat: "",
    muscle: "",
    water: "",
    waist: "",
    hip: "",
    chest: "",
    arm: "",
    notes: ""
  });

  useEffect(() => {
    if (!isAuthLoading && patientId) {
      fetchProgressData();
    }
  }, [isAuthLoading, patientId]);

  const fetchProgressData = async () => {
    try {
      const response = await fetch(`${API_URL}/patient/${patientId}/progress`);
      if (!response.ok) throw new Error("Error fetching progress");
      const data = await response.json();
      setProgressData(data);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar tus datos de progreso",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMetric = async () => {
    if (!metricForm.weight) {
      toast({
        title: "Error",
        description: "El peso es obligatorio",
        variant: "destructive"
      });
      return;
    }

    setSavingStatus(true);
    try {
      const response = await fetch(`${API_URL}/patient/${patientId}/progress/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          notes: metricForm.notes || null
        })
      });

      if (!response.ok) throw new Error("Error saving metric");

      toast({
        title: "¡Éxito!",
        description: "Progreso registrado correctamente",
      });

      setIsAddModalOpen(false);
      setMetricForm({
        date: new Date().toISOString().split('T')[0],
        weight: "",
        body_fat: "",
        muscle: "",
        water: "",
        waist: "",
        hip: "",
        chest: "",
        arm: "",
        notes: ""
      });
      fetchProgressData();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el progreso",
        variant: "destructive"
      });
    } finally {
      setSavingStatus(false);
    }
  };

  // IMC Calculation
  const calculateIMC = (weight: number) => {
    if (!user?.altura) return null;
    const heightM = user.altura / 100;
    return (weight / (heightM * heightM)).toFixed(1);
  };

  if (loading || isAuthLoading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  if (!progressData || !progressData.has_data) {
    return (
      <PatientLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <Scale className="h-16 w-16 text-muted-foreground/30" />
          <div className="text-center">
            <h2 className="text-xl font-bold">Aún no hay datos de progreso</h2>
            <p className="text-muted-foreground mt-2">Tu nutricionista registrará tus mediciones durante las consultas.</p>
          </div>
        </div>
      </PatientLayout>
    );
  }

  const { summary, body_composition, charts, achievements } = progressData;

  function renderAddModal() {
    return (
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Progreso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={metricForm.date}
                  onChange={(e) => setMetricForm({ ...metricForm, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Peso (kg) *</Label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={metricForm.weight}
                  onChange={(e) => setMetricForm({ ...metricForm, weight: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Grasa %</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={metricForm.body_fat}
                  onChange={(e) => setMetricForm({ ...metricForm, body_fat: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Músculo %</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={metricForm.muscle}
                  onChange={(e) => setMetricForm({ ...metricForm, muscle: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Agua %</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={metricForm.water}
                  onChange={(e) => setMetricForm({ ...metricForm, water: e.target.value })}
                />
              </div>
            </div>

            <div className="separator flex items-center gap-2 py-2">
              <div className="h-px bg-border flex-1"></div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Medidas (cm)</span>
              <div className="h-px bg-border flex-1"></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Cintura</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={metricForm.waist}
                  onChange={(e) => setMetricForm({ ...metricForm, waist: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Cadera</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={metricForm.hip}
                  onChange={(e) => setMetricForm({ ...metricForm, hip: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Pecho</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={metricForm.chest}
                  onChange={(e) => setMetricForm({ ...metricForm, chest: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Brazo</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={metricForm.arm}
                  onChange={(e) => setMetricForm({ ...metricForm, arm: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="¿Cómo te sentiste hoy?"
                value={metricForm.notes}
                onChange={(e) => setMetricForm({ ...metricForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleAddMetric}
              disabled={savingStatus}
              className="gradient-primary"
            >
              {savingStatus ? "Guardando..." : "Guardar Registro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const imc = calculateIMC(summary.current_weight);
  const getIMCBadge = (val: number) => {
    if (val < 18.5) return <Badge variant="destructive">Bajo peso</Badge>;
    if (val < 25) return <Badge variant="secondary" className="bg-success/20 text-success border-success/20">Normal</Badge>;
    if (val < 30) return <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/20">Sobrepeso</Badge>;
    return <Badge variant="destructive">Obesidad</Badge>;
  };

  return (
    <PatientLayout>
      <div className="space-y-4 lg:space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold text-foreground">Mi Progreso</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm lg:text-base text-muted-foreground">Tu evolución detallada</p>
            {summary.edad_formateada && (
              <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[10px] uppercase font-bold">
                {summary.edad_formateada}
              </Badge>
            )}
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <Card className="border-border shadow-card">
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate">Peso Actual</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground">{summary.current_weight} kg</p>
                  <div className={`flex items-center gap-1 text-xs lg:text-sm mt-1 ${summary.weight_change <= 0 ? 'text-success' : 'text-info'}`}>
                    {summary.weight_change <= 0 ? <TrendingDown className="h-3 w-3 lg:h-4 lg:w-4" /> : <TrendingUp className="h-3 w-3 lg:h-4 lg:w-4" />}
                    {summary.weight_change > 0 ? '+' : ''}{summary.weight_change} kg
                  </div>
                </div>
                <div className="flex h-9 w-9 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Scale className="h-4 w-4 lg:h-6 lg:w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-card">
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate">IMC</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground">{imc || "---"}</p>
                  <div className="mt-1">{imc ? getIMCBadge(parseFloat(imc)) : null}</div>
                </div>
                <div className="flex h-9 w-9 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                  <Ruler className="h-4 w-4 lg:h-6 lg:w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-card">
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate">Meta</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground">{summary.goal_weight} kg</p>
                  <p className="text-[10px] lg:text-xs text-muted-foreground mt-1">
                    Faltan {Math.abs(summary.goal_weight - summary.current_weight).toFixed(1)} kg
                  </p>
                </div>
                <div className="flex h-9 w-9 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                  <Target className="h-4 w-4 lg:h-6 lg:w-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-card">
            <CardContent className="p-3 lg:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate">Progreso</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground">{summary.progress_percentage}%</p>
                  <Progress value={summary.progress_percentage} className="mt-2 h-1 lg:h-1.5 w-16 lg:w-20" />
                </div>
                <div className="flex h-9 w-9 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-success/10">
                  {summary.trend === 'down' ? <TrendingDown className="h-4 w-4 lg:h-6 lg:w-6 text-success" /> : <TrendingUp className="h-4 w-4 lg:h-6 lg:w-6 text-info" />}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Weight Chart */}
          <Card className="lg:col-span-2 border-border shadow-card">
            <CardHeader className="pb-3 lg:pb-6">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <Scale className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Evolución del Peso
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">Últimos registros</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250} className="lg:!h-[300px]">
                <AreaChart data={charts.weight}>
                  <defs>
                    <linearGradient id="colorPeso" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(145, 63%, 42%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(145, 63%, 42%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="hsl(150, 10%, 45%)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(150, 10%, 45%)" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} width={30} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Area type="monotone" dataKey="value" stroke="hsl(145, 63%, 42%)" strokeWidth={2} fillOpacity={1} fill="url(#colorPeso)" name="Peso (kg)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card className="border-border shadow-card">
            <CardHeader className="pb-3 lg:pb-6">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <Award className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Logros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 lg:space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {achievements.length > 0 ? achievements.map((achievement, index) => (
                <div key={index} className="flex items-center gap-2 lg:gap-3 p-2 lg:p-3 rounded-lg bg-muted/30 border border-border transition-all duration-200 hover:bg-muted/50">
                  <span className="text-xl lg:text-2xl">{achievement.icon || "🏆"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs lg:text-sm font-medium text-foreground truncate">{achievement.title}</p>
                    <p className="text-[10px] lg:text-xs text-muted-foreground">{achievement.date}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground italic text-sm">
                  Pronto verás aquí tus reconocimientos
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Measurements and Body Comp */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <Card className="border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Ruler className="h-4 w-4 text-primary" />
                Medidas Corporales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Cintura", value: body_composition.waist, icon: <Scale className="h-3 w-3" /> },
                  { label: "Cadera", value: body_composition.hip, icon: <Scale className="h-3 w-3" /> },
                  { label: "Pecho", value: body_composition.chest, icon: <Scale className="h-3 w-3" /> },
                  { label: "Brazo", value: body_composition.arm, icon: <Scale className="h-3 w-3" /> },
                ].map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-border bg-card/50">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-xl font-bold mt-1">
                      {item.value || "---"} <span className="text-xs font-normal text-muted-foreground">cm</span>
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" />
                Composición
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={charts.body_composition}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} width={25} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "10px" }} />
                    <Line type="monotone" dataKey="body_fat" stroke="hsl(var(--destructive))" name="Grasa %" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="muscle" stroke="hsl(145, 63%, 42%)" name="Músculo %" strokeWidth={2} dot={{ r: 3 }} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PatientLayout >
  );
}
