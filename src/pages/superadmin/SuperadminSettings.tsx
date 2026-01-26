import { useState, useEffect } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Bell,
  Mail,
  Database,
  Lock,
  Globe,
  Save,
<<<<<<< HEAD
  Loader2
=======
  Loader2,
  Camera,
  User
>>>>>>> 0a998de141157deef767b39ad403d0e8eb2668a3
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { API_URL } from "@/config/api";
<<<<<<< HEAD

export default function SuperadminSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
=======
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function SuperadminSettings() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [avatar, setAvatar] = useState<string>("");

>>>>>>> 0a998de141157deef767b39ad403d0e8eb2668a3
  const [settings, setSettings] = useState({
    siteName: "NutriData",
    supportEmail: "soporte@NutriData.com",
    maxUsersPerOrg: 100,
    maxPatientsPerNutritionist: 50,
    enableRegistration: true,
    requireEmailVerification: true,
    enableTwoFactor: false,
    maintenanceMode: false,
    emailNotifications: true,
    slackNotifications: false,
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
      const response = await fetch(`${API_URL}/superadmin/settings/${userId}`);

      if (!response.ok) {
        throw new Error("Error al cargar configuración");
      }

      const data = await response.json();
      setSettings(data);
      
      // Cargar perfil del usuario para obtener avatar
      if (userId) {
        const profileResponse = await fetch(`${API_URL}/admin/profile/${userId}`);
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setAvatar(profileData.avatar || "");
        }
      }
    } catch (error) {
      console.error("Error al cargar configuración:", error);
      toast.error("Error al cargar la configuración del sistema");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId) {
      toast.error("Usuario no identificado");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tamaño (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo es demasiado grande. Máximo 2MB");
      return;
    }

    // Validar tipo
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato no válido. Use JPG, PNG o GIF");
      return;
    }

    try {
      setUploadingPhoto(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/admin/profile/${userId}/upload-avatar`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error al subir foto");
      }

      if (data.success) {
        setAvatar(data.avatar_url);
        // Actualizar el contexto de autenticación
        if (user) {
          const updatedUser = { ...user, avatar: data.avatar_url };
          setUser(updatedUser);
          localStorage.setItem("userData", JSON.stringify(updatedUser));
          window.dispatchEvent(new Event("userUpdated"));
        }
        toast.success("Foto actualizada correctamente");
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Error al subir foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSave = async () => {
    if (!userId) {
      toast.error("Usuario no identificado");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/superadmin/settings/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error al guardar configuración");
      }

      toast.success("Configuración del sistema actualizada");
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SuperadminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SuperadminLayout>
    );
  }

  return (
    <SuperadminLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configuración del Sistema</h1>
          <p className="text-muted-foreground">Ajustes globales de la plataforma</p>
        </div>

        {/* Profile Photo */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <User className="h-5 w-5" />
              Foto de Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatar} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {getInitials(user?.name || "SA")}
                </AvatarFallback>
              </Avatar>
              <div>
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/jpeg,image/jpg,image/png,image/gif"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  {uploadingPhoto ? "Subiendo..." : "Cambiar foto"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  JPG, PNG o GIF. Máximo 2MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Configuración General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre del Sitio</Label>
                <Input
                  value={settings.siteName}
                  onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email de Soporte</Label>
                <Input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Máx. usuarios por organización</Label>
                <Input
                  type="number"
                  value={settings.maxUsersPerOrg}
                  onChange={(e) => setSettings({ ...settings, maxUsersPerOrg: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Máx. pacientes por nutricionista</Label>
                <Input
                  type="number"
                  value={settings.maxPatientsPerNutritionist}
                  onChange={(e) => setSettings({ ...settings, maxPatientsPerNutritionist: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Seguridad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Permitir Registro Público</p>
                <p className="text-sm text-muted-foreground">Los usuarios pueden crear cuentas sin invitación</p>
              </div>
              <Switch
                checked={settings.enableRegistration}
                onCheckedChange={(checked) => setSettings({ ...settings, enableRegistration: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Verificación de Email</p>
                <p className="text-sm text-muted-foreground">Requerir verificación de email al registrarse</p>
              </div>
              <Switch
                checked={settings.requireEmailVerification}
                onCheckedChange={(checked) => setSettings({ ...settings, requireEmailVerification: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Autenticación de Dos Factores</p>
                <p className="text-sm text-muted-foreground">Habilitar 2FA para todos los usuarios</p>
              </div>
              <Switch
                checked={settings.enableTwoFactor}
                onCheckedChange={(checked) => setSettings({ ...settings, enableTwoFactor: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Modo Mantenimiento</p>
                <p className="text-sm text-muted-foreground">Bloquear acceso excepto a superadmins</p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) => setSettings({ ...settings, maintenanceMode: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Notificaciones por Email</p>
                  <p className="text-sm text-muted-foreground">Recibir alertas del sistema por email</p>
                </div>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Integración Slack</p>
                  <p className="text-sm text-muted-foreground">Enviar alertas a canal de Slack</p>
                </div>
              </div>
              <Switch
                checked={settings.slackNotifications}
                onCheckedChange={(checked) => setSettings({ ...settings, slackNotifications: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50 bg-card">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Zona de Peligro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10">
              <div>
                <p className="font-medium text-foreground">Restablecer Sistema</p>
                <p className="text-sm text-muted-foreground">Eliminar todos los datos y configuraciones</p>
              </div>
              <Button variant="destructive">Restablecer</Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} className="gradient-primary border-0" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Guardando..." : "Guardar Configuración"}
          </Button>
        </div>
      </div>
    </SuperadminLayout>
  );
}
