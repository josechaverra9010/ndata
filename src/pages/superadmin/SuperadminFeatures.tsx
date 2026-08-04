import { useCallback, useEffect, useState } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import {
  Flag,
  Globe,
  Building2,
  Loader2,
  Save,
  Layers,
  Stethoscope,
  Smartphone,
  Watch,
  Trophy,
  Activity,
} from "lucide-react";

interface FeatureFlagDef {
  key: string;
  label: string;
  scope: "patient" | "nutritionist";
}

interface FeatureGroup {
  id: string;
  label: string;
  description: string;
  flags: FeatureFlagDef[];
}

interface OrgRow {
  id: number;
  name: string;
  code?: string;
  overrideCount: number;
}

const GROUP_ICONS: Record<string, typeof Flag> = {
  patient_panel: Layers,
  clinical: Stethoscope,
  pwa: Smartphone,
  wearables: Watch,
  gamification: Trophy,
  nutritionist_hub: Activity,
};

const SCOPE_LABELS: Record<string, string> = {
  patient: "Paciente",
  nutritionist: "Nutricionista",
};

export default function SuperadminFeatures() {
  const token = () => localStorage.getItem("userToken");
  const headers = () => ({
    "Content-Type": "application/json",
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<FeatureGroup[]>([]);
  const [globalFlags, setGlobalFlags] = useState<Record<string, boolean>>({});
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [orgOverrides, setOrgOverrides] = useState<Record<string, boolean | null>>({});
  const [effectiveFlags, setEffectiveFlags] = useState<Record<string, boolean>>({});

  const allKeys = catalog.flatMap((g) => g.flags.map((f) => f.key));

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/superadmin/features`, { headers: headers() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCatalog(data.catalog || []);
      setGlobalFlags(data.globalFlags || {});
      setOrgs(data.organizations || []);
    } catch {
      toast.error("Error al cargar módulos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedOrg) {
      setOrgOverrides({});
      setEffectiveFlags({});
      return;
    }
    fetch(`${API_URL}/superadmin/features/organizations/${selectedOrg}`, { headers: headers() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const ov: Record<string, boolean | null> = {};
        allKeys.forEach((k) => {
          ov[k] = k in (data.organizationOverrides || {}) ? data.organizationOverrides[k] : null;
        });
        setOrgOverrides(ov);
        setEffectiveFlags(data.effectiveFlags || {});
      })
      .catch(() => {});
  }, [selectedOrg, allKeys.length]);

  const saveGlobal = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/features/global`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ flags: globalFlags }),
      });
      if (!res.ok) throw new Error();
      toast.success("Módulos globales actualizados");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const saveOrg = async () => {
    if (!selectedOrg) return;
    setSaving(true);
    try {
      const payload: Record<string, boolean | null> = {};
      allKeys.forEach((k) => {
        if (orgOverrides[k] !== null && orgOverrides[k] !== undefined) {
          payload[k] = !!orgOverrides[k];
        } else {
          payload[k] = null;
        }
      });
      const res = await fetch(`${API_URL}/superadmin/features/organizations/${selectedOrg}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ flags: payload }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEffectiveFlags(data.effectiveFlags || {});
      toast.success("Overrides del tenant guardados");
      loadOverview();
    } catch {
      toast.error("Error al guardar tenant");
    } finally {
      setSaving(false);
    }
  };

  const enabledGlobalCount = allKeys.filter((k) => globalFlags[k] !== false).length;

  if (loading) {
    return (
      <SuperadminLayout>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SuperadminLayout>
    );
  }

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Feature flags y módulos</h1>
            <p className="text-muted-foreground">
              Activa capacidades globalmente o por organización (EPS / tenant)
            </p>
          </div>
          <Badge variant="secondary" className="w-fit gap-1">
            <Globe className="h-3.5 w-3.5" />
            {enabledGlobalCount}/{allKeys.length} activos globalmente
          </Badge>
        </div>

        <Tabs defaultValue="global" className="space-y-4">
          <TabsList>
            <TabsTrigger value="global" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Global
            </TabsTrigger>
            <TabsTrigger value="tenant" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Por organización
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="space-y-4">
            {catalog.map((group) => {
              const Icon = GROUP_ICONS[group.id] || Flag;
              return (
                <Card key={group.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-base">{group.label}</CardTitle>
                        <CardDescription>{group.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {group.flags.map((flag) => (
                      <div
                        key={flag.key}
                        className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{flag.label}</p>
                          <p className="text-xs text-muted-foreground font-mono">{flag.key}</p>
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {SCOPE_LABELS[flag.scope] || flag.scope}
                          </Badge>
                        </div>
                        <Switch
                          checked={globalFlags[flag.key] !== false}
                          onCheckedChange={(v) =>
                            setGlobalFlags({ ...globalFlags, [flag.key]: v })
                          }
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
            <div className="flex justify-end">
              <Button onClick={saveGlobal} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar configuración global
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="tenant" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Override por tenant</CardTitle>
                <CardDescription>
                  Hereda del global, fuerza activado o desactivado por organización
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar organización…" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.name}
                        {o.overrideCount > 0 ? ` (${o.overrideCount} overrides)` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!selectedOrg ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Elige una organización para configurar overrides específicos.
                  </p>
                ) : (
                  <>
                    {catalog.map((group) => (
                      <div key={group.id} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </p>
                        {group.flags.map((flag) => (
                          <div
                            key={flag.key}
                            className="flex flex-col gap-2 rounded-lg border border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-sm font-medium">{flag.label}</p>
                              <p className="text-xs text-muted-foreground">
                                Efectivo:{" "}
                                <span
                                  className={
                                    effectiveFlags[flag.key] !== false
                                      ? "text-emerald-600"
                                      : "text-destructive"
                                  }
                                >
                                  {effectiveFlags[flag.key] !== false ? "Activado" : "Desactivado"}
                                </span>
                              </p>
                            </div>
                            <Select
                              value={
                                orgOverrides[flag.key] === null || orgOverrides[flag.key] === undefined
                                  ? "inherit"
                                  : orgOverrides[flag.key]
                                    ? "on"
                                    : "off"
                              }
                              onValueChange={(v) =>
                                setOrgOverrides({
                                  ...orgOverrides,
                                  [flag.key]: v === "inherit" ? null : v === "on",
                                })
                              }
                            >
                              <SelectTrigger className="w-full sm:w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="inherit">Heredar global</SelectItem>
                                <SelectItem value="on">Forzar ON</SelectItem>
                                <SelectItem value="off">Forzar OFF</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    ))}
                    <Button onClick={saveOrg} disabled={saving} variant="outline" className="gap-2">
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Guardar overrides del tenant
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SuperadminLayout>
  );
}
