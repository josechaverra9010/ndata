import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  Loader2
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
    } else {
      setLoading(false);
    }
  }, [userId]);

  const loadSettings = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/patient/settings/${userId}`);

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
      const notifResponse = await fetch(`${API_URL}/patient/notifications/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifications)
      });

      if (!notifResponse.ok) {
        throw new Error("Error al guardar notificaciones");
      }

      // Guardar apariencia
      const appearanceResponse = await fetch(`${API_URL}/patient/appearance/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
      const response = await fetch(`${API_URL}/patient/profile/${userId}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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