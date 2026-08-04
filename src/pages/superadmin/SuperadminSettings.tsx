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
  Loader2,
  Camera,
  User,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { API_URL } from "@/config/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SuperadminConfigTabs } from "@/components/superadmin/SuperadminConfigTabs";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=2000&q=80";

export default function SuperadminSettings() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingHero, setSavingHero] = useState(false);
  const [avatar, setAvatar] = useState<string>("");
  const [heroImage, setHeroImage] = useState(DEFAULT_HERO);
  const [heroUrlDraft, setHeroUrlDraft] = useState("");
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState(DEFAULT_HERO);

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
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/superadmin/settings/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error("Error al cargar configuraci?n");
      }

      const data = await response.json();
      const { heroImage: heroFromApi, ...rest } = data;
      setSettings({
        siteName: rest.siteName ?? "NutriData",
        supportEmail: rest.supportEmail ?? "soporte@NutriData.com",
        maxUsersPerOrg: rest.maxUsersPerOrg ?? 100,
        maxPatientsPerNutritionist: rest.maxPatientsPerNutritionist ?? 50,
        enableRegistration: !!rest.enableRegistration,
        requireEmailVerification: !!rest.requireEmailVerification,
        enableTwoFactor: !!rest.enableTwoFactor,
        maintenanceMode: !!rest.maintenanceMode,
        emailNotifications: !!rest.emailNotifications,
        slackNotifications: !!rest.slackNotifications,
      });
      const hero = heroFromApi || DEFAULT_HERO;
      setHeroImage(hero);
      setHeroPreview(hero);
      setHeroUrlDraft(hero.startsWith("http") ? hero : "");
      
      // Cargar perfil del usuario para obtener avatar
      if (userId) {
        const profileResponse = await fetch(`${API_URL}/admin/profile/${userId}`);
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setAvatar(profileData.avatar || "");
        }
      }
    } catch (error) {
      console.error("Error al cargar configuraci?n:", error);
      toast.error("Error al cargar la configuraci?n del sistema");
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

    // Validar tama?o (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo es demasiado grande. M?ximo 2MB");
      return;
    }

    // Validar tipo
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato no v?lido. Use JPG, PNG o GIF");
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
        // Actualizar el contexto de autenticaci?n
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

  const handleSaveHero = async () => {
    try {
      setSavingHero(true);
      const token = localStorage.getItem("userToken");
      const body = new FormData();
      if (heroFile) body.append("image", heroFile);
      if (heroUrlDraft.trim()) body.append("image_url", heroUrlDraft.trim());
      if (!heroFile && !heroUrlDraft.trim()) {
        toast.error("Elige una imagen o pega una URL");
        return;
      }

      const res = await fetch(`${API_URL}/superadmin/home/hero`, {
        method: "PUT",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo actualizar el hero");

      const next = data.heroImage || DEFAULT_HERO;
      setHeroImage(next);
      setHeroPreview(next);
      setHeroFile(null);
      toast.success("Imagen del hero actualizada");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error al guardar el hero");
    } finally {
      setSavingHero(false);
    }
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
        headers: {
          "Content-Type": "application/json",
          ...(localStorage.getItem("userToken")
            ? { Authorization: `Bearer ${localStorage.getItem("userToken")}` }
            : {}),
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error al guardar configuraci?n");
      }

      toast.success("Configuraci?n del sistema actualizada");
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Error al guardar configuraci?n");
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
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configuración del Sistema</h1>
          <p className="text-muted-foreground">Feature flags, variables, mantenimiento y ajustes globales</p>
        </div>

        <SuperadminConfigTabs />

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
                  JPG, PNG o GIF. M?ximo 2MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hero Home */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Imagen del Hero (Home)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cambia a placer la imagen de fondo del hero de la pagina de inicio publica.
            </p>
            <div className="aspect-[21/9] w-full overflow-hidden rounded-xl border border-border bg-muted">
              <img
                src={heroPreview || heroImage}
                alt="Vista previa del hero"
                className="h-full w-full object-cover"
                onError={() => setHeroPreview(DEFAULT_HERO)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>URL de la imagen</Label>
                <Input
                  value={heroUrlDraft}
                  onChange={(e) => {
                    setHeroUrlDraft(e.target.value);
                    if (e.target.value.trim()) {
                      setHeroPreview(e.target.value.trim());
                      setHeroFile(null);
                    }
                  }}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>Subir archivo</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setHeroFile(file);
                    if (file) setHeroPreview(URL.createObjectURL(file));
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveHero} disabled={savingHero} className="gap-2">
                {savingHero ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar hero
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setHeroUrlDraft(DEFAULT_HERO);
                  setHeroPreview(DEFAULT_HERO);
                  setHeroFile(null);
                }}
              >
                Restaurar por defecto
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Configuracion General
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
                <Label>M?x. usuarios por organizaci?n</Label>
                <Input
                  type="number"
                  value={settings.maxUsersPerOrg}
                  onChange={(e) => setSettings({ ...settings, maxUsersPerOrg: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>M?x. pacientes por nutricionista</Label>
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
                <p className="font-medium text-foreground">Permitir Registro P?blico</p>
                <p className="text-sm text-muted-foreground">Los usuarios pueden crear cuentas sin invitaci?n</p>
              </div>
              <Switch
                checked={settings.enableRegistration}
                onCheckedChange={(checked) => setSettings({ ...settings, enableRegistration: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Verificaci?n de Email</p>
                <p className="text-sm text-muted-foreground">Requerir verificaci?n de email al registrarse</p>
              </div>
              <Switch
                checked={settings.requireEmailVerification}
                onCheckedChange={(checked) => setSettings({ ...settings, requireEmailVerification: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Autenticaci?n de Dos Factores</p>
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
                <p className="text-sm text-muted-foreground">
                  También configurable en la pestaña Mantenimiento (con mensaje personalizado)
                </p>
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
                  <p className="font-medium text-foreground">Integraci?n Slack</p>
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

        {/* Danger Zone — backup en pestaña Backup */}
        <Card className="border-muted bg-card">
          <CardHeader>
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-base">
              <Lock className="h-5 w-5" />
              Respaldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Usa la pestaña <strong>Backup</strong> arriba para exportar o restaurar la configuración completa.
            </p>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} className="gradient-primary border-0" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Guardando..." : "Guardar Configuraci?n"}
          </Button>
        </div>
      </div>
    </SuperadminLayout>
  );
}
