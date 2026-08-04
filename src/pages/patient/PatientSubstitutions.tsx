import { useCallback, useEffect, useState } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRightLeft, Loader2, Search, Sparkles, ChefHat } from "lucide-react";

interface Alternative {
  name: string;
  portion: string;
  reason: string;
}

interface SuggestionResult {
  ingredient: string;
  found: boolean;
  message?: string;
  category?: string;
  alternatives: Alternative[];
  recipe_suggestions?: Array<{ name: string; reason: string; calories?: number }>;
  ai_note?: string;
}

const REASONS = [
  { value: "no_tengo", label: "No lo tengo" },
  { value: "no_gusta", label: "No me gusta" },
  { value: "alergia", label: "Alergia/intolerancia" },
];

export default function PatientSubstitutions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("no_tengo");
  const [loading, setLoading] = useState(false);
  const [popular, setPopular] = useState<Array<{ ingredient: string; category: string; preview: string }>>([]);
  const [result, setResult] = useState<SuggestionResult | null>(null);

  const patientId = user?.id;

  useEffect(() => {
    if (!patientId) return;
    const token = localStorage.getItem("userToken");
    fetch(`${API_URL}/patient/${patientId}/substitutions/popular`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => setPopular(Array.isArray(d.items) ? d.items : []))
      .catch(() => {});
  }, [patientId]);

  const search = useCallback(async (ingredient: string) => {
    if (!patientId || ingredient.trim().length < 2) return;
    setLoading(true);
    setResult(null);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patient/${patientId}/substitutions/suggest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ingredient: ingredient.trim(), reason }),
      });
      if (!res.ok) throw new Error();
      setResult(await res.json());
    } catch {
      toast({ title: "Error", description: "No se pudo buscar alternativas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [patientId, reason, toast]);

  return (
    <PatientLayout>
      <LoadingGate loading={false}>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ArrowRightLeft className="h-7 w-7 text-primary" />
              Sustituciones Inteligentes
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              ¿No tienes un ingrediente? Encuentra alternativas equivalentes según tu plan
            </p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ej. pollo, arroz, leche..."
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search(query)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <Badge
                    key={r.value}
                    variant={reason === r.value ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setReason(r.value)}
                  >
                    {r.label}
                  </Badge>
                ))}
              </div>
              <Button className="w-full gap-2 rounded-full" disabled={loading || query.trim().length < 2} onClick={() => search(query)}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Buscar alternativas
              </Button>
            </CardContent>
          </Card>

          {popular.length > 0 && !result && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Búsquedas frecuentes</p>
              <div className="flex flex-wrap gap-2">
                {popular.map((p) => (
                  <Button
                    key={p.ingredient}
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-full"
                    onClick={() => {
                      setQuery(p.ingredient);
                      search(p.ingredient);
                    }}
                  >
                    {p.ingredient}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <Card className={result.found ? "border-primary/30" : "border-dashed"}>
                <CardHeader>
                  <CardTitle className="text-base capitalize">{result.ingredient}</CardTitle>
                  <CardDescription>{result.message}</CardDescription>
                  {result.category && <Badge variant="secondary" className="w-fit mt-1">{result.category}</Badge>}
                </CardHeader>
                {result.alternatives.length > 0 && (
                  <CardContent className="space-y-3">
                    {result.alternatives.map((alt) => (
                      <div key={alt.name} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm">{alt.name}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">{alt.portion}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{alt.reason}</p>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>

              {result.recipe_suggestions && result.recipe_suggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ChefHat className="h-4 w-4" />
                      Recetas alternativas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.recipe_suggestions.map((r) => (
                      <div key={r.name} className="text-sm border rounded-lg p-2.5">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.reason}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {result.ai_note && (
                <p className="text-xs text-muted-foreground text-center px-4">{result.ai_note}</p>
              )}
            </div>
          )}
        </div>
      </LoadingGate>
    </PatientLayout>
  );
}
