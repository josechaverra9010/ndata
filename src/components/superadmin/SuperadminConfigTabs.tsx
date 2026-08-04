import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import {
  Flag,
  Server,
  Wrench,
  Download,
  Upload,
  Loader2,
  Save,
  ArrowRight,
  Layers,
} from "lucide-react";

interface RuntimeConfig {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_password_set?: boolean;
  from_email?: string;
  base_url?: string;
  frontend_url?: string;
  max_upload_mb?: number;
  allowed_origins?: string;
  environment?: string;
}

export function SuperadminConfigTabs() {
  const navigate = useNavigate();
  const token = () => localStorage.getItem("userToken");
  const headers = () => ({
    "Content-Type": "application/json",
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
  });

  const [loading, setLoading] = useState(true);
  const [runtime, setRuntime] = useState<RuntimeConfig>({});
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const configRes = await fetch(`${API_URL}/superadmin/config`, { headers: headers() });
      if (configRes.ok) {
        const data = await configRes.json();
        setRuntime(data.runtimeConfig || {});
        setMaintenanceMode(!!data.maintenanceMode);
        setMaintenanceMessage(data.maintenanceMessage || "");
      }
    } catch {
      toast.error("Error al cargar configuración");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveRuntime = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/config/runtime`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify(runtime),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRuntime(data.runtimeConfig || runtime);
      toast.success("Variables de entorno actualizadas");
    } catch {
      toast.error("Error al guardar variables");
    } finally {
      setSaving(false);
    }
  };

  const saveMaintenance = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/config/maintenance`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({
          maintenance_mode: maintenanceMode,
          maintenance_message: maintenanceMessage,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(maintenanceMode ? "Modo mantenimiento activado" : "Mantenimiento desactivado");
    } catch {
      toast.error("Error al guardar mantenimiento");
    } finally {
      setSaving(false);
    }
  };

  const downloadBackup = async () => {
    try {
      const res = await fetch(`${API_URL}/superadmin/config/backup`, { headers: headers() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nutridata-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup descargado");
    } catch {
      toast.error("Error al exportar");
    }
  };

  const restoreBackup = async (file: File) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch(`${API_URL}/superadmin/config/restore`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success("Configuración restaurada");
      load();
    } catch {
      toast.error("Error al restaurar (revisa el JSON)");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="runtime" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="runtime" className="gap-1.5">
          <Server className="h-3.5 w-3.5" /> Variables
        </TabsTrigger>
        <TabsTrigger value="flags" className="gap-1.5">
          <Flag className="h-3.5 w-3.5" /> Módulos
        </TabsTrigger>
        <TabsTrigger value="maintenance" className="gap-1.5">
          <Wrench className="h-3.5 w-3.5" /> Mantenimiento
        </TabsTrigger>
        <TabsTrigger value="backup" className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Backup
        </TabsTrigger>
      </TabsList>

      <TabsContent value="flags">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Feature flags y módulos
            </CardTitle>
            <CardDescription>
              Activa o desactiva fases del panel paciente, Clínica CO, PWA, wearables, gamificación y centro
              avanzado — por org, sin redeploy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              La gestión unificada vive en <strong>Módulos / Flags</strong>. Desde Config solo accedes al panel
              canónico (global + overrides por tenant + vista efectiva).
            </p>
            <Button onClick={() => navigate("/superadmin/features")} className="gap-2">
              Ir a Módulos / Flags
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="runtime">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Variables de entorno (runtime)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Entorno de plataforma</Label>
              <Select
                value={runtime.environment || "production"}
                onValueChange={(v) => setRuntime({ ...runtime, environment: v })}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Visible en /api/public/platform-status · Las keys partner sandbox solo acceden a orgs sandbox.
              </p>
            </div>
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input
                value={runtime.smtp_host || ""}
                onChange={(e) => setRuntime({ ...runtime, smtp_host: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP Port</Label>
              <Input
                type="number"
                value={runtime.smtp_port ?? 587}
                onChange={(e) => setRuntime({ ...runtime, smtp_port: parseInt(e.target.value, 10) })}
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP User</Label>
              <Input
                value={runtime.smtp_user || ""}
                onChange={(e) => setRuntime({ ...runtime, smtp_user: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP Password {runtime.smtp_password_set ? "(configurada)" : ""}</Label>
              <Input
                type="password"
                placeholder={runtime.smtp_password_set ? "••••••••" : ""}
                onChange={(e) => setRuntime({ ...runtime, smtp_password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input
                value={runtime.from_email || ""}
                onChange={(e) => setRuntime({ ...runtime, from_email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>BASE_URL</Label>
              <Input
                value={runtime.base_url || ""}
                onChange={(e) => setRuntime({ ...runtime, base_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>FRONTEND_URL</Label>
              <Input
                value={runtime.frontend_url || ""}
                onChange={(e) => setRuntime({ ...runtime, frontend_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Máx. upload (MB)</Label>
              <Input
                type="number"
                value={runtime.max_upload_mb ?? 5}
                onChange={(e) => setRuntime({ ...runtime, max_upload_mb: parseInt(e.target.value, 10) })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ALLOWED_ORIGINS (CORS, separados por coma)</Label>
              <Input
                value={runtime.allowed_origins || ""}
                onChange={(e) => setRuntime({ ...runtime, allowed_origins: e.target.value })}
                placeholder="http://localhost:8080,https://app.ejemplo.com"
              />
            </div>
            <div className="md:col-span-2">
              <Button onClick={saveRuntime} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" /> Guardar variables
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Los cambios aplican sin reiniciar el servidor. Las variables del archivo .env siguen como fallback.
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="maintenance">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modo mantenimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Activar mantenimiento</p>
                <p className="text-sm text-muted-foreground">
                  Bloquea acceso a todos excepto superadmins
                </p>
              </div>
              <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
            </div>
            <div className="space-y-2">
              <Label>Mensaje personalizado</Label>
              <Textarea
                rows={4}
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="Estamos realizando mejoras. Vuelve en unos minutos."
              />
            </div>
            <Button onClick={saveMaintenance} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" /> Guardar mantenimiento
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="backup">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backup y restore de configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporta o restaura: ajustes del sistema, feature flags, runtime config y overrides por organización.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={downloadBackup} className="gap-2">
                <Download className="h-4 w-4" /> Descargar backup JSON
              </Button>
              <label>
                <Button variant="outline" asChild className="gap-2 cursor-pointer">
                  <span>
                    <Upload className="h-4 w-4" /> Restaurar desde JSON
                  </span>
                </Button>
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) restoreBackup(f);
                  }}
                />
              </label>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
