import { useCallback, useEffect, useState } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { ClipboardList, ShoppingCart } from "lucide-react";

interface ShoppingItem {
  name: string;
  category: string;
  category_label: string;
  occurrences: number;
  meals: string[];
}

interface ShoppingCategory {
  id: string;
  label: string;
  items: ShoppingItem[];
}

interface ShoppingData {
  has_plan: boolean;
  plan_name?: string;
  week?: number;
  total_items?: number;
  message?: string;
  categories: ShoppingCategory[];
}

export default function PatientShoppingList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ShoppingData | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const patientId = user?.id;
  const storageKey = `shopping-checked-${patientId}`;

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patient/${patientId}/shopping-list`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      toast({ title: "Error", description: "No se pudo cargar la lista de compras", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [patientId, toast]);

  useEffect(() => {
    load();
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setChecked(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, [load, storageKey]);

  const toggle = (name: string) => {
    setChecked((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const total = data?.total_items ?? 0;
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <PatientLayout>
      <LoadingGate loading={loading}>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShoppingCart className="h-7 w-7 text-primary" />
              Lista de Compras
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Ingredientes de tu menú semanal, agrupados por categoría
            </p>
          </div>

          {data?.has_plan && (
            <div className="flex flex-wrap gap-2">
              {data.plan_name && (
                <Badge variant="secondary" className="rounded-full">
                  {data.plan_name}
                </Badge>
              )}
              {data.week && (
                <Badge variant="outline" className="rounded-full">
                  Semana {data.week}
                </Badge>
              )}
              {total > 0 && (
                <Badge className="rounded-full bg-primary/10 text-primary border-0">
                  {done}/{total} marcados
                </Badge>
              )}
            </div>
          )}

          {!data?.has_plan ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="font-medium">{data?.message || "No tienes un plan activo"}</p>
              </CardContent>
            </Card>
          ) : data.categories.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground">
                {data.message || "No hay ingredientes en el menú de esta semana."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.categories.map((cat) => (
                <Card key={cat.id} className="border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      {cat.label}
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {cat.items.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {cat.items.map((item) => (
                      <label
                        key={item.name}
                        className="flex items-start gap-3 rounded-lg border border-border/50 p-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <Checkbox
                          checked={!!checked[item.name]}
                          onCheckedChange={() => toggle(item.name)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${checked[item.name] ? "line-through text-muted-foreground" : ""}`}>
                            {item.name}
                          </p>
                          {item.occurrences > 1 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Aparece {item.occurrences} veces
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </LoadingGate>
    </PatientLayout>
  );
}
