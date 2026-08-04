import { useCallback, useEffect, useState } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { Award, Flame, Loader2, Star, Target, Trophy } from "lucide-react";

interface Challenge {
  key: string;
  title: string;
  description: string;
  target: number;
  current: number;
  progress_pct: number;
  completed: boolean;
  claimed: boolean;
  points: number;
  icon: string;
}

interface Achievement {
  id: number;
  title: string;
  description?: string;
  achieved_date: string;
  icon: string;
}

export default function PatientChallenges() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [claiming, setClaiming] = useState<string | null>(null);

  const patientId = user?.id;

  const headers = () => {
    const token = localStorage.getItem("userToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/patient/${patientId}/challenges`, { headers: headers() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChallenges(Array.isArray(data.challenges) ? data.challenges : []);
      setAchievements(Array.isArray(data.achievements) ? data.achievements : []);
      setStreakDays(Number(data.streak_days ?? 0));
      setTotalPoints(Number(data.total_points ?? 0));
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los retos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [patientId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async (key: string) => {
    if (!patientId) return;
    setClaiming(key);
    try {
      const res = await fetch(`${API_URL}/patient/${patientId}/challenges/${key}/claim`, {
        method: "POST",
        headers: headers(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "No se pudo reclamar");
      }
      const data = await res.json();
      toast({ title: "¡Reto completado!", description: `+${data.points} puntos — ${data.title}` });
      load();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo reclamar el reto",
        variant: "destructive",
      });
    } finally {
      setClaiming(null);
    }
  };

  return (
    <PatientLayout>
      <LoadingGate loading={loading}>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Trophy className="h-7 w-7 text-primary" />
              Retos y Logros
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Completa retos semanales y mantén tu racha de registro
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-primary/20 bg-primary/[0.03]">
              <CardContent className="pt-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{streakDays}</p>
                  <p className="text-xs text-muted-foreground">Días de racha</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <Star className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalPoints}</p>
                  <p className="text-xs text-muted-foreground">Puntos ganados</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <Award className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{achievements.length}</p>
                  <p className="text-xs text-muted-foreground">Insignias</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Retos activos
            </h2>
            {challenges.map((ch) => (
              <Card key={ch.key} className={ch.completed && !ch.claimed ? "border-emerald-500/40" : ""}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{ch.title}</p>
                      <p className="text-sm text-muted-foreground">{ch.description}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">+{ch.points} pts</Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {ch.current}/{ch.target}
                        </Badge>
                      </div>
                    </div>
                    {ch.claimed ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-0">Reclamado</Badge>
                    ) : ch.completed ? (
                      <Button size="sm" disabled={claiming === ch.key} onClick={() => claim(ch.key)}>
                        {claiming === ch.key ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reclamar"}
                      </Button>
                    ) : null}
                  </div>
                  <Progress value={ch.progress_pct} className="h-2" />
                </CardContent>
              </Card>
            ))}
          </div>

          {achievements.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold">Mis insignias</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {achievements.map((a) => (
                  <Card key={a.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        {a.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{a.achieved_date}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </LoadingGate>
    </PatientLayout>
  );
}
