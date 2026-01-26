import { useState, useEffect } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/useAuth";
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  CreditCard,
  Building,
  Mail,
  Phone,
  Camera,
  Save,
  Moon,
  Sun,
  Monitor,
  Loader2
} from "lucide-react";

import { API_URL } from "@/config/api";

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Obtener el usuario autenticado desde el contexto
  const { user } = useAuth();

  // Si no hay usuario, obtenerlo del localStorage como fallback
  const getUserId = () => {
    if (user?.id) return user.id;

    const userData = localStorage.getItem("userData");
    if (userData) {
      const parsed = JSON.parse(userData);
      return parsed.id;
    }

    // Si no hay nada, intentar decodificar el token
    const token = localStorage.getItem("userToken");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.id;
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }

    return null;
  };

  const userId = getUserId();

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    specialty: "",
    license: "",
    bio: "",
    address: "",
    avatar: ""
  });

  const [notifications, setNotifications] = useState({
    emailAppointments: true,
    emailMessages: true,
    emailMarketing: false,
    pushAppointments: true,
    pushMessages: true,
    smsReminders: true
  });

  const { theme, setTheme } = useTheme();

  const [appearance, setAppearance] = useState({
    language: "es",
    dateFormat: "dd/MM/yyyy",
    timeFormat: "24h"
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [billing, setBilling] = useState<any>(null);

  // Cargar configuración al montar el componente
  useEffect(() => {
    if (userId) {
      loadSettings();
    } else {
      toast.error("No se pudo identificar al usuario");
      setLoading(false);
    }
  }, [userId]);

  const loadSettings = async () => {
    if (!userId) {
      toast.error("ID de usuario no válido");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/admin/settings/complete/${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("userToken")}`
        }
      });

      if (!response.ok) {
        throw new Error("Error al cargar configuración");
      }

      const data = await response.json();

      setProfile(data.profile);
      setNotifications(data.notifications);
      setAppearance({
        language: data.appearance.language,
        dateFormat: data.appearance.dateFormat,
        timeFormat: data.appearance.timeFormat
      });

      // Aplicar el tema guardado
      if (data.appearance.theme) {
        setTheme(data.appearance.theme);
      }

      // Cargar información de facturación
      loadBilling();
    } catch (error) {
      console.error("Error al cargar configuración:", error);
      toast.error("Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const loadBilling = async () => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_URL}/admin/billing/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setBilling(data);
      }
    } catch (error) {
      console.error("Error al cargar facturación:", error);
    }
  };

  const handleSaveProfile = async () => {
    if (!userId) {
      toast.error("Usuario no identificado");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`${API_URL}/admin/profile/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(profile)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error al actualizar perfil");
      }

      if (data.success) {
        toast.success("Perfil actualizado correctamente");
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Error al actualizar perfil");
    } finally {
      setSaving(false);
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
        setProfile({ ...profile, avatar: data.avatar_url });
        // Actualizar el contexto de autenticación
        if (user) {
          const updatedUser = { ...user, avatar: data.avatar_url };
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

      const response = await fetch(`${API_URL}/admin/profile/${userId}/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
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

      if (data.success) {
        toast.success("Contraseña actualizada correctamente");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        });
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Error al cambiar contraseña");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!userId) {
      toast.error("Usuario no identificado");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`${API_URL}/admin/notifications/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(notifications)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error al guardar preferencias");
      }

      if (data.success) {
        toast.success("Preferencias de notificaciones guardadas");
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Error al guardar preferencias");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAppearance = async () => {
    if (!userId) {
      toast.error("Usuario no identificado");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`${API_URL}/admin/appearance/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          theme: theme,
          language: appearance.language,
          dateFormat: appearance.dateFormat,
          timeFormat: appearance.timeFormat
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error al guardar preferencias");
      }

      if (data.success) {
        toast.success("Preferencias de apariencia guardadas");
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Error al guardar preferencias");
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!userId) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">No se pudo cargar la información del usuario</p>
            <Button onClick={() => window.location.reload()}>Recargar página</Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground">Gestiona tu cuenta y preferencias</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notificaciones
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              Apariencia
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Facturación
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información Personal</CardTitle>
                <CardDescription>Actualiza tu información de perfil</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile.avatar} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {getInitials(profile.name || "AN")}
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

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre completo</Label>
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={profile.phone || ""}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specialty">Especialidad</Label>
                    <Input
                      id="specialty"
                      value={profile.specialty || ""}
                      onChange={(e) => setProfile({ ...profile, specialty: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license">Número de licencia</Label>
                    <Input
                      id="license"
                      value={profile.license || ""}
                      onChange={(e) => setProfile({ ...profile, license: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input
                      id="address"
                      value={profile.address || ""}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Biografía</Label>
                  <Textarea
                    id="bio"
                    value={profile.bio || ""}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    rows={4}
                  />
                </div>

                <Button onClick={handleSaveProfile} className="gap-2" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Seguridad
                </CardTitle>
                <CardDescription>Gestiona tu contraseña y seguridad</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Contraseña actual</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    />
                  </div>
                  <div />
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nueva contraseña</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleChangePassword}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Cambiando...
                    </>
                  ) : (
                    "Cambiar contraseña"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Notificaciones por Email
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Citas</p>
                    <p className="text-sm text-muted-foreground">Recibe emails sobre nuevas citas y recordatorios</p>
                  </div>
                  <Switch
                    checked={notifications.emailAppointments}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, emailAppointments: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Mensajes</p>
                    <p className="text-sm text-muted-foreground">Notificaciones de nuevos mensajes de pacientes</p>
                  </div>
                  <Switch
                    checked={notifications.emailMessages}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, emailMessages: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Marketing</p>
                    <p className="text-sm text-muted-foreground">Novedades y actualizaciones del producto</p>
                  </div>
                  <Switch
                    checked={notifications.emailMarketing}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, emailMarketing: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notificaciones Push
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Citas</p>
                    <p className="text-sm text-muted-foreground">Alertas push para citas próximas</p>
                  </div>
                  <Switch
                    checked={notifications.pushAppointments}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, pushAppointments: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Mensajes</p>
                    <p className="text-sm text-muted-foreground">Alertas de mensajes nuevos</p>
                  </div>
                  <Switch
                    checked={notifications.pushMessages}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, pushMessages: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  SMS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Recordatorios SMS</p>
                    <p className="text-sm text-muted-foreground">Enviar recordatorios SMS a pacientes</p>
                  </div>
                  <Switch
                    checked={notifications.smsReminders}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, smsReminders: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSaveNotifications} className="gap-2" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Guardando..." : "Guardar preferencias"}
            </Button>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tema</CardTitle>
                <CardDescription>Personaliza la apariencia de la aplicación</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:w-2/3">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    className="h-24 flex-col gap-2"
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="h-6 w-6" />
                    Claro
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    className="h-24 flex-col gap-2"
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="h-6 w-6" />
                    Oscuro
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Regional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Select
                      value={appearance.language}
                      onValueChange={(v) => setAppearance({ ...appearance, language: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="pt">Português</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Formato de fecha</Label>
                    <Select
                      value={appearance.dateFormat}
                      onValueChange={(v) => setAppearance({ ...appearance, dateFormat: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                        <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Formato de hora</Label>
                    <Select
                      value={appearance.timeFormat}
                      onValueChange={(v) => setAppearance({ ...appearance, timeFormat: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">24 horas</SelectItem>
                        <SelectItem value="12h">12 horas (AM/PM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSaveAppearance} className="gap-2" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Guardando..." : "Guardar preferencias"}
            </Button>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Plan Actual
                </CardTitle>
              </CardHeader>
              <CardContent>
                {billing && (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div>
                      <h3 className="text-lg font-semibold">{billing.plan.name}</h3>
                      <p className="text-sm text-muted-foreground">{billing.plan.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        €{billing.plan.price}
                        <span className="text-sm font-normal text-muted-foreground">/mes</span>
                      </p>
                      <Button variant="outline" size="sm" className="mt-2">
                        Cambiar plan
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Método de Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {billing?.payment_method && (
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-16 rounded bg-muted flex items-center justify-center text-xs font-medium">
                        {billing.payment_method.brand}
                      </div>
                      <div>
                        <p className="font-medium">
                          •••• •••• •••• {billing.payment_method.last4}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Expira {billing.payment_method.expiry}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">Editar</Button>
                  </div>
                )}
                <Button variant="outline" className="w-full">
                  Añadir método de pago
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Historial de Facturación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {billing?.invoices?.map((invoice: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium">{invoice.date}</p>
                        <p className="text-sm text-muted-foreground">€{invoice.amount.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-green-600 capitalize">
                          {invoice.status === "paid" ? "Pagado" : invoice.status}
                        </span>
                        <Button variant="ghost" size="sm">Descargar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
