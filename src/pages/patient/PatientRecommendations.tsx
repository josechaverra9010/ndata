import { useCallback, useEffect, useState } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { BookOpen, CheckCheck, Sparkles, User } from "lucide-react";
import { formatInColombia } from "@/lib/timezone";

interface Recommendation {
  id: number;
  title: string;
  body: string;
  content_type: string;
  category: string;
  read: boolean;
  created_at?: string;
  nutritionist_name: string;
}

const typeLabels: Record<string, string> = {
  recommendation: "Recomendación",
  message: "Mensaje",
  smart_goal: "Meta SMART",
};

export default function PatientRecommendations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const patientId = user?.id;

  const headers = () => {
    const token = localStorage.getItem("userToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/patient/${patientId}/recommendations`, { headers: headers() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Number(data.unread_count ?? 0));
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar las recomendaciones", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [patientId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: number) => {
    if (!patientId) return;
    try {
      await fetch(`${API_URL}/patient/${patientId}/recommendations/${id}/read`, {
        method: "PATCH",
        headers: headers(),
      });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  };

  const markAllRead = async () => {
    if (!patientId) return;
    try {
      await fetch(`${API_URL}/patient/${patientId}/recommendations/read-all`, {
        method: "PATCH",
        headers: headers(),
      });
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
      setUnreadCount(0);
      toast({ title: "Listo", description: "Todas marcadas como leídas" });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    }
  };

  const openItem = (item: Recommendation) => {
    setExpandedId(expandedId === item.id ? null : item.id);
    if (!item.read) markRead(item.id);
  };

  return (
    <PatientLayout>
      <LoadingGate loading={loading}>
        <div className="animate-fade-in space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <BookOpen className="h-7 w-7 text-primary" />
                Mis Recomendaciones
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Indicaciones personalizadas de tu nutricionista
              </p>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" className="gap-2" onClick={markAllRead}>
                <CheckCheck className="h-4 w-4" />
                Marcar todas leídas ({unreadCount})
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="font-medium text-foreground">Aún no tienes recomendaciones</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  Cuando tu nutricionista te envíe indicaciones desde la consulta, aparecerán aquí.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <Card
                  key={item.id}
                  className={`cursor-pointer transition-all hover:border-primary/30 ${!item.read ? "border-primary/40 bg-primary/[0.02]" : ""}`}
                  onClick={() => openItem(item)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          {!item.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                          {item.title}
                        </CardTitle>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge variant="outline" className="text-[10px]">
                            {typeLabels[item.content_type] || item.content_type}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <User className="h-3 w-3" />
                            {item.nutritionist_name}
                          </Badge>
                          {item.created_at && (
                            <span className="text-[10px] text-muted-foreground self-center">
                              {formatInColombia(item.created_at, "dd MMM yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  {(expandedId === item.id || item.body.length < 120) && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {item.body}
                      </p>
                    </CardContent>
                  )}
                  {expandedId !== item.id && item.body.length >= 120 && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.body}</p>
                      <span className="text-xs text-primary mt-1 inline-block">Ver más</span>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </LoadingGate>
    </PatientLayout>
  );
}
