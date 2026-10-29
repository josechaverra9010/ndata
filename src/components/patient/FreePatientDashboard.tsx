import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "@/config/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  Target,
  Sparkles,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Utensils,
  ArrowRight,
  Scale,
} from "lucide-react";

interface CalorieGuide {
  ready: boolean;
  missing?: string[];
  message?: string | null;
  peso_actual_kg?: number;
  peso_ideal_kg?: number;
  calories_burned_daily?: number;
  calories_to_consume?: number;
  goal?: string;
  note?: string | null;
  formula?: string;
  nivel_actividad?: string;
}

interface MealSuggestion {
  title: string;
  meal_moment: string;
  calories: number;
  protein_g?: number;
  description?: string;
  ingredients?: string[];
  why?: string;
  ai_generated?: boolean;
}

interface Props {
  firstName: string;
}

export function FreePatientDashboard({ firstName }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guide, setGuide] = useState<CalorieGuide | null>(null);
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const token = localStorage.getItem("userToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(
        `${API_URL}/patient/free/meal-suggestions${refresh ? "?refresh=true" : ""}`,
        { headers }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : data.detail?.message || "No se pudo cargar tu guía gratuita"
        );
      }
      setGuide(data.guide || null);
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setAiEnabled(data.ai_enabled !== false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const goalLabel =
    guide?.goal === "bajar"
      ? "Bajar de peso"
      : guide?.goal === "subir"
        ? "Subir de peso"
        : "Mantener peso";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.08] p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80 mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Plan Gratis
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight capitalize">
          Hola, {firstName}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
          Aquí ves cuánto quemas, cuánto debes consumir para tu peso ideal y dos
          sugerencias de comida generadas con IA. El plan nutricional completo
          está en Esencial o Plus.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{error}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => load(false)}>
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {guide && !guide.ready && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Completa tu perfil
            </CardTitle>
            <CardDescription>
              {guide.message ||
                "Necesitamos tu peso, altura, fecha de nacimiento y género para calcular calorías."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/patient/profile">Ir a mi perfil</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {guide?.ready && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-orange-500/20 shadow-card overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-500 to-amber-400" />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-600" />
                  Calorías que quemas normalmente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">
                  {guide.calories_burned_daily}
                  <span className="text-base font-medium text-muted-foreground ml-1">kcal/día</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Estimación de tu gasto diario (TDEE) con tu peso actual y actividad
                  {guide.nivel_actividad ? ` (${guide.nivel_actividad})` : ""}.
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/20 shadow-card overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 to-lime-400" />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-600" />
                  Debes consumir para tu peso ideal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">
                  {guide.calories_to_consume}
                  <span className="text-base font-medium text-muted-foreground ml-1">kcal/día</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Scale className="h-3 w-3" />
                    Ideal: {guide.peso_ideal_kg} kg
                  </Badge>
                  <Badge variant="outline">{goalLabel}</Badge>
                </div>
                {guide.note && (
                  <p className="text-xs text-muted-foreground mt-2">{guide.note}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                2 sugerencias de comida
              </h2>
              <p className="text-xs text-muted-foreground">
                {aiEnabled
                  ? "Generadas con IA según tu meta calórica (no son un plan nutricional)."
                  : "Sugerencias de respaldo (IA no disponible ahora)."}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={refreshing}
              onClick={() => load(true)}
              className="gap-2"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Nuevas sugerencias
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {suggestions.map((s, idx) => (
              <Card key={`${s.title}-${idx}`} className="flex flex-col shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="secondary" className="mb-2">
                        {s.meal_moment || "Comida"}
                      </Badge>
                      <CardTitle className="text-base">{s.title}</CardTitle>
                    </div>
                    <Badge className="shrink-0 tabular-nums">{s.calories} kcal</Badge>
                  </div>
                  {s.description && (
                    <CardDescription className="text-sm">{s.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {!!s.ingredients?.length && (
                    <ul className="text-sm space-y-1">
                      {s.ingredients.map((ing) => (
                        <li key={ing} className="flex gap-2">
                          <span className="text-primary">•</span>
                          <span>{ing}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.why && (
                    <p className="text-xs text-muted-foreground border-t pt-3">{s.why}</p>
                  )}
                  {s.protein_g ? (
                    <p className="text-xs text-muted-foreground">Proteína aprox.: {s.protein_g} g</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
            {suggestions.length === 0 && !error && (
              <Card className="md:col-span-2">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Aún no hay sugerencias. Prueba el botón «Nuevas sugerencias».
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-sm">¿Quieres tu plan y comidas del nutricionista?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Con Esencial o Plus desbloqueas plan nutricional, menú del día, citas y más.
            </p>
          </div>
          <Button asChild size="sm" className="gap-1 shrink-0">
            <Link to="/patient/billing">
              Ver planes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
