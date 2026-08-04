import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/useAuth";
import {
  Bell,
  Moon,
  Sun,
  Smartphone,
  Mail,
  MessageSquare,
  Shield,
  Save,
  Eye,
  EyeOff,
  Lock,
  Monitor,
  Loader2,
  Building2,
  Gift,
  Download,
  Trash2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { API_URL } from "@/config/api";

export default function PatientSettings() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [orgCode, setOrgCode] = useState("");
  const [orgLoading, setOrgLoading] = useState(false);
  const [myOrg, setMyOrg] = useState<{
    id: number;
    name: string;
    code: string;
    benefit_label?: string;
  } | null>(null);

  const [notifications, setNotifications] = useState({
    emailReminders: true,
    pushMeals: true,
    pushAppointments: true,
    smsReminders: false,
    weeklyReport: true,
    tips: true,
  });

  const [appearance, setAppearance] = useState({
    language: "es",
    units: "metric",
    dateFormat: "dd-mm-yyyy"
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [deletionReason, setDeletionReason] = useState("");
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [deletionRequest, setDeletionRequest] = useState<{
    id: number;
    status: string;
    reason?: string;
    created_at?: string;
    scheduled_at?: string | null;
    completed_at?: string | null;
  } | null>(null);

  const DELETION_STATUS_LABELS: Record<string, string> = {
    pending: "En revisión",
    approved: "Aprobada — en proceso",
    rejected: "Rechazada",
    completed: "Completada",
  };

  const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem("userToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleExportMyData = async () => {
    setPrivacyLoading(true);
    try {
      const res = await fetch(`${API_URL}/patient/data-export`, { headers: authHeaders() });
      if (!res.ok) throw new Error("No se pudo exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mis-datos-nutridata.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Datos exportados (Ley 1581)");
    } catch {
      toast.error("Error al exportar tus datos");
    } finally {
      setPrivacyLoading(false);
    }
  };

  const handleDeletionRequest = async () => {
    if (!deletionReason.trim()) {
      toast.error("Indica el motivo de la solicitud");
      return;
    }
    setPrivacyLoading(true);
    try {
      const res = await fetch(`${API_URL}/patient/deletion-request`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deletionReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error");
      toast.success("Solicitud enviada. El equipo la revisará pronto.");
      setDeletionReason("");
      loadDeletionStatus();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al enviar solicitud");
    } finally {
      setPrivacyLoading(false);
    }
  };

  const loadDeletionStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/patient/deletion-request/status`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDeletionRequest(data.has_request ? data.request : null);
      }
    } catch {
      /* ignore */
    }
  };

  const getUserId = () => {
    if (user?.id) return user.id;
    const userData = localStorage.getItem("userData");
    if (userData) {
      const parsed = JSON.parse(userData);
      return parsed.id;
    }
    return null;
  };

  const userId = getUserId();

  useEffect(() => {
    if (userId) {
      loadSettings();
      loadMyOrganization();
      loadDeletionStatus();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const loadMyOrganization = async () => {
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/organizations/me`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        setMyOrg(data.organization || null);
      }
    } catch {
      /* ignore */
    }
  };

  const joinOrganization = async () => {
    if (!orgCode.trim()) {
      toast.error("Ingresa el código de tu organización");
      return;
    }
    setOrgLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/organizations/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: orgCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo afiliar");
      }
      toast.success(data.message || "Afiliado correctamente");
      setOrgCode("");
      setMyOrg(data.organization || null);
    } catch (e: any) {
      toast.error(e?.message || "Error al afiliarse");
    } finally {
      setOrgLoading(false);
    }
  };

  const leaveOrganization = async () => {
    if (!confirm("¿Salir de la organización? Perderás el beneficio asociado.")) return;
    setOrgLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/organizations/me`, {
        method: "DELETE",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo salir");
      }
      toast.success("Saliste de la organización");
      setMyOrg(null);
    } catch (e: any) {
      toast.error(e?.message || "Error");
    } finally {
      setOrgLoading(false);
    }
  };

  const loadSettings = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patient/settings/${userId}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });

      if (!response.ok) {
        throw new Error("Error al cargar configuración");
      }

      const data = await response.json();

      setNotifications(data.notifications);
      setAppearance({
        language: data.appearance.language,
        units: data.appearance.units,
        dateFormat: data.appearance.dateFormat
      });

      if (token) {
        const prefsRes = await fetch(`${API_URL}/patient/${userId}/reminder-preferences`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (prefsRes.ok) {
          const prefs = await prefsRes.json();
          setNotifications((prev) => ({
            ...prev,
            emailReminders: prefs.email_enabled ?? prev.emailReminders,
            pushMeals: prefs.push_enabled ?? prev.pushMeals,
            pushAppointments: prefs.push_enabled ?? prev.pushAppointments,
            smsReminders: prefs.whatsapp_enabled ?? prev.smsReminders,
            weeklyReport: prefs.weekly_report ?? prev.weeklyReport,
            tips: prefs.tips_enabled ?? prev.tips,
          }));
        }
      }

      if (data.appearance.theme) {
        setTheme(data.appearance.theme);
      }
    } catch (error) {
      console.error("Error al cargar configuración:", error);
      toast.error("Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!userId) {
      toast.error("Usuario no identificado");
      return;
    }

    try {
      setSaving(true);

      // Guardar notificaciones
      const token = localStorage.getItem("userToken");
      const notifResponse = await fetch(`${API_URL}/patient/notifications/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(notifications)
      });

      if (!notifResponse.ok) {
        throw new Error("Error al guardar notificaciones");
      }

      await fetch(`${API_URL}/patient/${userId}/reminder-preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          whatsapp_enabled: notifications.smsReminders,
          email_enabled: notifications.emailReminders,
          push_enabled: notifications.pushMeals || notifications.pushAppointments,
          weekly_report: notifications.weeklyReport,
          tips_enabled: notifications.tips,
        }),
      });

      // Guardar apariencia
      const appearanceResponse = await fetch(`${API_URL}/patient/appearance/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          theme: theme,
          language: appearance.language,
          units: appearance.units,
          dateFormat: appearance.dateFormat
        })
      });

      if (!appearanceResponse.ok) {
        throw new Error("Error al guardar apariencia");
      }

      toast.success("Configuración guardada correctamente");
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!userId) {
      toast.error("Usuario no identificado");
      return;
    }

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error("Complete todos los campos");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patient/profile/${userId}/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword,
          confirm_password: passwordData.confirmPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error al cambiar contraseña");
      }

      toast.success("Contraseña actualizada correctamente");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Error al cambiar contraseña");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
          <p className="text-muted-foreground">Personaliza tu experiencia en NutriPlan</p>
        </div>

        <Card className="border-border shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Organización / convenio
            </CardTitle>
            <CardDescription>
              Si tu empresa o clínica tiene convenio con NutriData, ingresa el código para activar tu beneficio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {myOrg ? (
              <div className="rounded-xl border bg-primary/5 border-primary/20 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{myOrg.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      Código: {myOrg.code}
                    </p>
                    {myOrg.benefit_label && (
                      <p className="text-sm mt-2 flex items-center gap-1.5 text-primary">
                        <Gift className="h-4 w-4" />
                        {myOrg.benefit_label}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={orgLoading}
                    onClick={leaveOrganization}
                  >
                    Salir
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                  placeholder="Código de organización (ej. EMPRESA-A1B2)"
                  className="font-mono"
                />
                <Button disabled={orgLoading} onClick={joinOrganization} className="shrink-0">
                  {orgLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Gift className="h-4 w-4 mr-2" />
                  )}
                  Activar beneficio
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Notifications */}
          <Card className="border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" />
                Notificaciones
              </CardTitle>
              <CardDescription>Configura cómo quieres recibir alertas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Recordatorios por email</p>
                      <p className="text-sm text-muted-foreground">Citas y resúmenes semanales</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.emailReminders}
                    onCheckedChange={() => handleNotificationChange("emailReminders")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                      <Smartphone className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Recordatorios de comidas</p>
                      <p className="text-sm text-muted-foreground">Notificación push para cada comida</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.pushMeals}
                    onCheckedChange={() => handleNotificationChange("pushMeals")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                      <Bell className="h-5 w-5 text-info" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Recordatorios de citas</p>
                      <p className="text-sm text-muted-foreground">24h y 1h antes de tu cita</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.pushAppointments}
                    onCheckedChange={() => handleNotificationChange("pushAppointments")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                      <MessageSquare className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">SMS de recordatorio</p>
                      <p className="text-sm text-muted-foreground">Mensajes de texto para citas</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.smsReminders}
                    onCheckedChange={() => handleNotificationChange("smsReminders")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                      <Mail className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Reporte semanal</p>
                      <p className="text-sm text-muted-foreground">Resumen de tu progreso cada domingo</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.weeklyReport}
                    onCheckedChange={() => handleNotificationChange("weeklyReport")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Bell className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Consejos y tips</p>
                      <p className="text-sm text-muted-foreground">Notificaciones con consejos nutricionales</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.tips}
                    onCheckedChange={() => handleNotificationChange("tips")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card className="border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sun className="h-5 w-5 text-primary" />
                Apariencia
              </CardTitle>
              <CardDescription>Personaliza la interfaz a tu gusto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Tema</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme === "light"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                      }`}
                  >
                    <Sun className={`h-6 w-6 ${theme === "light" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${theme === "light" ? "text-foreground" : "text-muted-foreground"}`}>Claro</span>
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme === "dark"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                      }`}
                  >
                    <Moon className={`h-6 w-6 ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${theme === "dark" ? "text-foreground" : "text-muted-foreground"}`}>Oscuro</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="language">Idioma</Label>
                <Select value={appearance.language} onValueChange={(v) => setAppearance({ ...appearance, language: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">🇪🇸 Español</SelectItem>
                    <SelectItem value="en">🇺🇸 English</SelectItem>
                    <SelectItem value="pt">🇧🇷 Português</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="units">Unidades de medida</Label>
                <Select value={appearance.units} onValueChange={(v) => setAppearance({ ...appearance, units: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona unidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric">Métrico (kg, cm)</SelectItem>
                    <SelectItem value="imperial">Imperial (lb, ft)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="dateFormat">Formato de fecha</Label>
                <Select value={appearance.dateFormat} onValueChange={(v) => setAppearance({ ...appearance, dateFormat: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona formato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd-mm-yyyy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="mm-dd-yyyy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="border-border shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Seguridad
              </CardTitle>
              <CardDescription>Protege tu cuenta y datos personales</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Cambiar Contraseña
                  </h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Contraseña actual</Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showPassword ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Nueva contraseña</Label>
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      />
                    </div>
                    <Button variant="outline" className="w-full" onClick={handleChangePassword} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {saving ? "Actualizando..." : "Actualizar Contraseña"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-foreground">Sesiones Activas</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Smartphone className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Este dispositivo</p>
                          <p className="text-xs text-muted-foreground">Chrome en Windows • Madrid, España</p>
                        </div>
                      </div>
                      <span className="text-xs text-success">Activo ahora</span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <Smartphone className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">iPhone 14</p>
                          <p className="text-xs text-muted-foreground">Safari en iOS • Hace 2 días</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        Cerrar
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full text-destructive hover:text-destructive">
                    Cerrar todas las sesiones
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacidad Ley 1581 */}
          <Card className="border-border shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Privacidad y datos personales
              </CardTitle>
              <CardDescription>
                Derechos ARCO — Ley 1581 de 2012 (Habeas Data Colombia)
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Exportar mis datos
                </h4>
                <p className="text-sm text-muted-foreground">
                  Descarga una copia de tu perfil, planes, métricas y consentimientos en JSON.
                </p>
                <Button variant="outline" onClick={handleExportMyData} disabled={privacyLoading}>
                  {privacyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Descargar mis datos
                </Button>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Solicitar eliminación
                </h4>
                <p className="text-sm text-muted-foreground">
                  Solicita la eliminación/anonymización de tu cuenta. Revisión manual por el equipo.
                </p>
                {deletionRequest && (
                  <div className="rounded-lg border p-3 bg-muted/40 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">Tu solicitud</span>
                      <Badge
                        variant={
                          deletionRequest.status === "rejected"
                            ? "destructive"
                            : deletionRequest.status === "completed"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {DELETION_STATUS_LABELS[deletionRequest.status] || deletionRequest.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recibirás una notificación in-app (y correo si está configurado) cuando cambie el estado.
                    </p>
                    {deletionRequest.created_at && (
                      <p className="text-xs text-muted-foreground">
                        Enviada: {new Date(deletionRequest.created_at).toLocaleDateString("es-CO")}
                      </p>
                    )}
                  </div>
                )}
                {!deletionRequest || deletionRequest.status === "rejected" ? (
                  <>
                <Textarea
                  rows={3}
                  placeholder="Motivo de la solicitud..."
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                />
                <Button variant="destructive" onClick={handleDeletionRequest} disabled={privacyLoading}>
                  Enviar solicitud
                </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ya tienes una solicitud activa. Revisa tus notificaciones para actualizaciones.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} size="lg" className="gap-2" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Guardando..." : "Guardar Configuración"}
          </Button>
        </div>
      </div>
    </PatientLayout>
  );
}