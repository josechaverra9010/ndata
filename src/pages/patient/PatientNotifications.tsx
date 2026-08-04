import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PatientLayout } from "@/layouts/PatientLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  Calendar,
  CheckCheck,
  MessageSquare,
  RefreshCw,
  Target,
  Utensils,
} from "lucide-react";
import { formatInColombia } from "@/lib/timezone";

interface NotificationItem {
  id: string;
  source: string;
  type: string;
  title: string;
  message: string;
  date: string;
  created_at?: string;
  priority: string;
  read: boolean;
}

const typeIcons: Record<string, typeof Bell> = {
  appointment: Calendar,
  appointment_reminder: Calendar,
  reminder: Utensils,
  message: MessageSquare,
  progress: Target,
};

export default function PatientNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const patientId = user?.id;

  const headers = () => {
    const token = localStorage.getItem("userToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const qs = filter === "unread" ? "?unread_only=true" : "";
      const res = await fetch(`${API_URL}/patient/${patientId}/notifications/inbox${qs}`, {
        headers: headers(),
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications ?? []);
        setUnreadCount(data.unread_count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [patientId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (item: NotificationItem) => {
    if (!patientId || item.read || item.source !== "stored") {
      navigateForType(item.type);
      return;
    }
    const numId = parseInt(item.id, 10);
    if (Number.isNaN(numId)) {
      navigateForType(item.type);
      return;
    }
    await fetch(`${API_URL}/patient/${patientId}/notifications/${numId}/read`, {
      method: "PATCH",
      headers: headers(),
    });
    load();
    navigateForType(item.type);
  };

  const markAllRead = async () => {
    if (!patientId) return;
    const res = await fetch(`${API_URL}/patient/${patientId}/notifications/read-all`, {
      method: "PATCH",
      headers: headers(),
    });
    if (res.ok) {
      toast({ title: "Notificaciones marcadas como leídas" });
      load();
    }
  };

  const navigateForType = (type: string) => {
    if (type.includes("appointment")) navigate("/patient/appointments");
    else if (type === "reminder") navigate("/patient/meals");
    else if (type === "message") navigate("/patient/messages");
    else if (type === "progress") navigate("/patient/progress");
  };

  const displayed = filter === "unread" ? items.filter((i) => !i.read) : items;

  return (
    <PatientLayout>
      <LoadingGate loading={loading} message="Cargando notificaciones">
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Bell className="h-7 w-7 text-primary" />
                Notificaciones
              </h1>
              <p className="text-muted-foreground mt-1">
                Recordatorios de tu nutricionista y alertas del plan
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {unreadCount} sin leer
                  </Badge>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Actualizar
              </Button>
              {unreadCount > 0 && (
                <Button variant="secondary" size="sm" onClick={markAllRead}>
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Marcar todas
                </Button>
              )}
            </div>
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="unread">Sin leer</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-4 space-y-3">
              {displayed.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    {filter === "unread"
                      ? "No tienes notificaciones sin leer"
                      : "Aún no tienes notificaciones"}
                  </CardContent>
                </Card>
              ) : (
                displayed.map((item) => {
                  const Icon = typeIcons[item.type] || Bell;
                  return (
                    <Card
                      key={item.id}
                      className={`cursor-pointer transition-colors hover:bg-muted/30 ${
                        !item.read ? "border-primary/30 bg-primary/[0.03]" : ""
                      }`}
                      onClick={() => markRead(item)}
                    >
                      <CardContent className="p-4 flex gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            !item.read ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm">{item.title}</p>
                            {!item.read && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {item.message}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-2">
                            {item.created_at
                              ? formatInColombia(item.created_at, "dd MMM yyyy · HH:mm")
                              : item.date}
                          </p>
                        </div>
                        {item.priority === "high" && (
                          <Badge variant="destructive" className="shrink-0 h-fit text-[10px]">
                            Urgente
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">¿De dónde vienen?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>• Recordatorios automáticos de tu nutricionista (comidas, adherencia, citas)</p>
              <p>• Alertas de citas próximas y seguimiento de peso</p>
              <p>• Mensajes importantes del equipo clínico</p>
            </CardContent>
          </Card>
        </div>
      </LoadingGate>
    </PatientLayout>
  );
}
