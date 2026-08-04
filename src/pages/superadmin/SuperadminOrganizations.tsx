import { useEffect, useMemo, useState } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  MoreVertical,
  Building2,
  Users,
  Trash2,
  Edit,
  Eye,
  Gift,
  Copy,
  UserPlus,
  MapPin,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { API_URL } from "@/config/api";

interface Organization {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  code: string;
  description?: string | null;
  status: string;
  benefit_type: string;
  benefit_value?: string | null;
  benefit_description?: string | null;
  benefit_label?: string;
  eps_program?: string | null;
  max_patients?: number | null;
  max_nutritionists?: number | null;
  enabled_modules?: string[];
  logo_url?: string | null;
  primary_color?: string | null;
  contract_start?: string | null;
  contract_end?: string | null;
  sla_tier?: string;
  sla_tier_label?: string;
  is_sandbox?: boolean;
  patients_used?: number;
  nutritionists_used?: number;
  members_count?: number;
  patients_count?: number;
  nutritionists_count?: number;
  created_at?: string;
  members?: OrgMember[];
}

interface OrgMember {
  membership_id: number;
  user_id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  joined_at?: string;
}

interface BenefitCodeRow {
  id: number;
  code: string;
  label?: string;
  benefit_label?: string;
  max_uses?: number | null;
  uses_count: number;
  uses_remaining?: number | null;
  expires_at?: string | null;
  is_expired?: boolean;
  status: string;
}

const MODULE_OPTIONS = [
  { id: "appointments", label: "Citas" },
  { id: "meal_tracking", label: "Seguimiento alimentario" },
  { id: "clinical_colombia", label: "Clínica Colombia" },
  { id: "specialty_plans", label: "Planes especialidad" },
  { id: "analytics", label: "Analytics / adherencia" },
  { id: "organizations", label: "Organizaciones" },
];

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  code: "",
  description: "",
  status: "activo",
  benefit_type: "descuento",
  benefit_value: "10",
  benefit_description: "",
  eps_program: "",
  max_patients: "",
  max_nutritionists: "",
  enabled_modules: MODULE_OPTIONS.map((m) => m.id),
  logo_url: "",
  primary_color: "#6366f1",
  contract_start: "",
  contract_end: "",
  sla_tier: "standard",
  is_sandbox: false,
};

const emptyBenefitCode = {
  code: "",
  label: "",
  benefit_type: "descuento",
  benefit_value: "10",
  benefit_description: "",
  max_uses: "",
  expires_at: "",
};

const benefitLabels: Record<string, string> = {
  descuento: "Descuento %",
  cita_prioridad: "Prioridad en citas",
  consulta_gratis: "Consulta gratis",
  personalizado: "Personalizado",
};

export default function SuperadminOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Organization | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [patients, setPatients] = useState<{ id: number; name: string; email: string }[]>([]);
  const [sites, setSites] = useState<{ id: number; name: string; city?: string; nutritionists_count?: number }[]>([]);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteCity, setNewSiteCity] = useState("");
  const [benefitCodes, setBenefitCodes] = useState<BenefitCodeRow[]>([]);
  const [benefitCodeForm, setBenefitCodeForm] = useState({ ...emptyBenefitCode });
  const [benefitCodeSaving, setBenefitCodeSaving] = useState(false);

  const token = () => localStorage.getItem("userToken");

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/superadmin/organizations`, {
        headers: { ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      });
      if (!res.ok) throw new Error("No se pudieron cargar organizaciones");
      const data = await res.json();
      setOrganizations(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar organizaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return organizations;
    return organizations.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.email || "").toLowerCase().includes(q) ||
        (o.code || "").toLowerCase().includes(q)
    );
  }, [organizations, searchQuery]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  };

  const openEdit = (org: Organization) => {
    setEditing(org);
    setForm({
      name: org.name || "",
      email: org.email || "",
      phone: org.phone || "",
      code: org.code || "",
      description: org.description || "",
      status: org.status || "activo",
      benefit_type: org.benefit_type || "personalizado",
      benefit_value: org.benefit_value || "",
      benefit_description: org.benefit_description || "",
      eps_program: org.eps_program || "",
      max_patients: org.max_patients != null ? String(org.max_patients) : "",
      max_nutritionists: org.max_nutritionists != null ? String(org.max_nutritionists) : "",
      enabled_modules: org.enabled_modules || MODULE_OPTIONS.map((m) => m.id),
      logo_url: org.logo_url || "",
      primary_color: org.primary_color || "#6366f1",
      contract_start: org.contract_start || "",
      contract_end: org.contract_end || "",
      sla_tier: org.sla_tier || "standard",
      is_sandbox: !!org.is_sandbox,
    });
    setFormOpen(true);
  };

  const saveOrganization = async () => {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        status: form.status,
        benefit_type: form.benefit_type,
        benefit_value: form.benefit_value.trim() || null,
        benefit_description: form.benefit_description.trim() || null,
        eps_program: form.eps_program.trim() || null,
        max_patients: form.max_patients ? Number(form.max_patients) : null,
        max_nutritionists: form.max_nutritionists ? Number(form.max_nutritionists) : null,
        enabled_modules: form.enabled_modules,
        logo_url: form.logo_url.trim() || null,
        primary_color: form.primary_color.trim() || null,
        contract_start: form.contract_start || null,
        contract_end: form.contract_end || null,
        sla_tier: form.sla_tier,
        is_sandbox: form.is_sandbox,
      };
      const url = editing
        ? `${API_URL}/superadmin/organizations/${editing.id}`
        : `${API_URL}/superadmin/organizations`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo guardar");
      }
      toast.success(editing ? "Organización actualizada" : "Organización creada");
      setFormOpen(false);
      fetchOrganizations();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (org: Organization) => {
    if (!confirm(`¿Eliminar «${org.name}» y todas sus afiliaciones?`)) return;
    try {
      const res = await fetch(`${API_URL}/superadmin/organizations/${org.id}`, {
        method: "DELETE",
        headers: { ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo eliminar");
      }
      toast.success("Organización eliminada");
      fetchOrganizations();
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar");
    }
  };

  const openDetail = async (org: Organization) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/organizations/${org.id}`, {
        headers: { ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      });
      if (!res.ok) throw new Error("No se pudo cargar el detalle");
      const data = await res.json();
      setDetail(data);
      const sitesRes = await fetch(`${API_URL}/superadmin/organizations/${org.id}/sites`, {
        headers: { ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      });
      if (sitesRes.ok) {
        setSites(await sitesRes.json());
      } else {
        setSites([]);
      }
      const bcRes = await fetch(`${API_URL}/superadmin/organizations/${org.id}/benefit-codes`, {
        headers: { ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      });
      setBenefitCodes(bcRes.ok ? await bcRes.json() : []);
    } catch (e: any) {
      toast.error(e?.message || "Error");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(
      () => toast.success(`Código copiado: ${code}`),
      () => toast.error("No se pudo copiar")
    );
  };

  const createBenefitCode = async () => {
    if (!detail || !benefitCodeForm.code.trim()) return;
    setBenefitCodeSaving(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/organizations/${detail.id}/benefit-codes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        },
        body: JSON.stringify({
          code: benefitCodeForm.code.trim(),
          label: benefitCodeForm.label || null,
          benefit_type: benefitCodeForm.benefit_type,
          benefit_value: benefitCodeForm.benefit_value || null,
          benefit_description: benefitCodeForm.benefit_description || null,
          max_uses: benefitCodeForm.max_uses ? Number(benefitCodeForm.max_uses) : null,
          expires_at: benefitCodeForm.expires_at || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Error al crear código");
      }
      toast.success("Código de beneficio creado");
      setBenefitCodeForm({ ...emptyBenefitCode });
      openDetail(detail);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBenefitCodeSaving(false);
    }
  };

  const deleteBenefitCode = async (codeId: number) => {
    if (!detail || !confirm("¿Eliminar este código?")) return;
    await fetch(`${API_URL}/superadmin/organizations/${detail.id}/benefit-codes/${codeId}`, {
      method: "DELETE",
      headers: { ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
    });
    openDetail(detail);
  };

  const toggleModule = (moduleId: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      enabled_modules: checked
        ? [...f.enabled_modules, moduleId]
        : f.enabled_modules.filter((m) => m !== moduleId),
    }));
  };

  const addSite = async () => {
    if (!detail || !newSiteName.trim()) return;
    try {
      const res = await fetch(`${API_URL}/superadmin/organizations/${detail.id}/sites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        },
        body: JSON.stringify({ name: newSiteName.trim(), city: newSiteCity.trim() || null }),
      });
      if (!res.ok) throw new Error("No se pudo crear la sede");
      toast.success("Sede creada");
      setNewSiteName("");
      setNewSiteCity("");
      openDetail(detail);
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  };

  const openAddMember = async () => {
    if (!detail) return;
    setMemberUserId("");
    setAddMemberOpen(true);
    try {
      const res = await fetch(`${API_URL}/patients`, {
        headers: { ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        setPatients(
          (Array.isArray(data) ? data : []).map((p: any) => ({
            id: p.id,
            name: `${p.nombres || ""} ${p.apellidos || ""}`.trim() || p.email,
            email: p.email,
          }))
        );
      }
    } catch {
      /* ignore */
    }
  };

  const addMember = async () => {
    if (!detail || !memberUserId) return;
    try {
      const res = await fetch(
        `${API_URL}/superadmin/organizations/${detail.id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
          },
          body: JSON.stringify({ user_id: Number(memberUserId) }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo adscribir");
      }
      toast.success("Persona adscrita");
      setAddMemberOpen(false);
      openDetail(detail);
      fetchOrganizations();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  };

  const removeMember = async (userId: number) => {
    if (!detail) return;
    if (!confirm("¿Quitar a esta persona de la organización?")) return;
    try {
      const res = await fetch(
        `${API_URL}/superadmin/organizations/${detail.id}/members/${userId}`,
        {
          method: "DELETE",
          headers: { ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
        }
      );
      if (!res.ok) throw new Error("No se pudo remover");
      toast.success("Miembro removido");
      openDetail(detail);
      fetchOrganizations();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Organizaciones</h1>
            <p className="text-muted-foreground">
              Convenios con empresas/clínicas y beneficios para personas adscritas
            </p>
          </div>
          <Button className="gradient-primary border-0" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Organización
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{organizations.length}</div>
              <p className="text-sm text-muted-foreground">Total organizaciones</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-success">
                {organizations.filter((o) => o.status === "activo").length}
              </div>
              <p className="text-sm text-muted-foreground">Activas</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">
                {organizations.reduce((acc, o) => acc + (o.patients_count || 0), 0)}
              </div>
              <p className="text-sm text-muted-foreground">Pacientes adscritos</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">
                {organizations.reduce((acc, o) => acc + (o.members_count || 0), 0)}
              </div>
              <p className="text-sm text-muted-foreground">Miembros totales</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            placeholder="Buscar por nombre, email o código…"
          />
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Lista de Organizaciones</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando…
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">
                No hay organizaciones. Crea la primera convenio.
              </p>
            ) : (
              <div className="space-y-3">
                {filtered.map((org) => (
                  <div
                    key={org.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground truncate">{org.name}</p>
                        <Badge
                          className={
                            org.status === "activo"
                              ? "bg-success/10 text-success border-0"
                              : "bg-muted text-muted-foreground border-0"
                          }
                        >
                          {org.status}
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <Gift className="h-3 w-3" />
                          {org.benefit_label || benefitLabels[org.benefit_type] || org.benefit_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {org.email || "Sin email"} · Código:{" "}
                        <button
                          type="button"
                          className="font-mono text-foreground hover:underline"
                          onClick={() => copyCode(org.code)}
                          title="Copiar código"
                        >
                          {org.code}
                        </button>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {org.patients_count || 0}
                        {org.max_patients != null ? `/${org.max_patients}` : ""} pacientes ·{" "}
                        {org.nutritionists_count || 0}
                        {org.max_nutritionists != null ? `/${org.max_nutritionists}` : ""} nutri.
                      </p>
                      {org.max_patients != null && (
                        <Progress
                          className="h-1 mt-1 max-w-[200px]"
                          value={Math.min(
                            100,
                            Math.round(((org.patients_used || org.patients_count || 0) / org.max_patients) * 100)
                          )}
                        />
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDetail(org)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver / miembros
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(org)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyCode(org.code)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar código
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(org)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar organización" : "Nueva organización"}
            </DialogTitle>
            <DialogDescription>
              Define el convenio y el beneficio que recibirán las personas adscritas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Empresa ABC / Clínica Norte"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Código de afiliación</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="Se genera solo si vacío"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="rounded-xl border p-3 space-y-3 bg-muted/20">
              <p className="text-sm font-medium flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                Beneficio para afiliados
              </p>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.benefit_type}
                  onValueChange={(v) => setForm({ ...form, benefit_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="descuento">Descuento %</SelectItem>
                    <SelectItem value="cita_prioridad">Prioridad en citas</SelectItem>
                    <SelectItem value="consulta_gratis">Consulta gratis</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(form.benefit_type === "descuento" ||
                form.benefit_type === "consulta_gratis") && (
                <div className="space-y-1.5">
                  <Label>
                    {form.benefit_type === "descuento"
                      ? "Porcentaje (ej. 15)"
                      : "Cantidad de consultas"}
                  </Label>
                  <Input
                    value={form.benefit_value}
                    onChange={(e) => setForm({ ...form, benefit_value: e.target.value })}
                    placeholder={form.benefit_type === "descuento" ? "15" : "1"}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Descripción del beneficio</Label>
                <Textarea
                  value={form.benefit_description}
                  onChange={(e) =>
                    setForm({ ...form, benefit_description: e.target.value })
                  }
                  rows={2}
                  placeholder="Detalle visible para el paciente y el nutricionista"
                />
              </div>
            </div>
            <div className="rounded-xl border p-3 space-y-3 bg-muted/20">
              <p className="text-sm font-medium">Contrato y límites</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Programa EPS</Label>
                  <Input
                    value={form.eps_program}
                    onChange={(e) => setForm({ ...form, eps_program: e.target.value })}
                    placeholder="Ej. Contributivo / Subsidiado"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Máx. pacientes</Label>
                  <Input
                    type="number"
                    value={form.max_patients}
                    onChange={(e) => setForm({ ...form, max_patients: e.target.value })}
                    placeholder="Ilimitado"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Máx. nutricionistas</Label>
                  <Input
                    type="number"
                    value={form.max_nutritionists}
                    onChange={(e) => setForm({ ...form, max_nutritionists: e.target.value })}
                    placeholder="Ilimitado"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Inicio contrato</Label>
                  <Input
                    type="date"
                    value={form.contract_start}
                    onChange={(e) => setForm({ ...form, contract_start: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fin contrato</Label>
                  <Input
                    type="date"
                    value={form.contract_end}
                    onChange={(e) => setForm({ ...form, contract_end: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>SLA soporte</Label>
                  <Select value={form.sla_tier} onValueChange={(v) => setForm({ ...form, sla_tier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enterprise">Enterprise (SLA acelerado)</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="basic">Basic (SLA extendido)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox
                    checked={form.is_sandbox}
                    onCheckedChange={(v) => setForm({ ...form, is_sandbox: Boolean(v) })}
                  />
                  <Label>Organización sandbox (solo keys de prueba)</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Módulos habilitados</Label>
                <div className="grid grid-cols-2 gap-2">
                  {MODULE_OPTIONS.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.enabled_modules.includes(m.id)}
                        onCheckedChange={(v) => toggleModule(m.id, Boolean(v))}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-xl border p-3 space-y-3 bg-muted/20">
              <p className="text-sm font-medium">Branding white-label</p>
              <div className="space-y-1.5">
                <Label>URL logo</Label>
                <Input
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Color primario</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={form.primary_color}
                    onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className="w-14 h-10 p-1"
                  />
                  <Input
                    value={form.primary_color}
                    onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saving} onClick={saveOrganization}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / members */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.name || "Organización"}</DialogTitle>
            <DialogDescription>
              {detail?.benefit_label && (
                <span className="block mt-1">
                  Beneficio: <strong>{detail.benefit_label}</strong>
                </span>
              )}
              {detail?.code && (
                <span className="block font-mono text-foreground mt-1">
                  Código: {detail.code}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">
                  Miembros ({detail?.members?.length || 0})
                </p>
                <Button size="sm" variant="outline" onClick={openAddMember}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Adscribir
                </Button>
              </div>
              {(detail?.members || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aún no hay personas adscritas. Comparte el código o agrégalas aquí.
                </p>
              ) : (
                <div className="space-y-2">
                  {(detail?.members || []).map((m) => (
                    <div
                      key={m.membership_id}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.email} · {m.role}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive shrink-0"
                        onClick={() => removeMember(m.user_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Sedes / clínicas ({sites.length})
                </p>
                {sites.map((s) => (
                  <div key={s.id} className="rounded-lg border px-3 py-2 text-sm">
                    <p className="font-medium">{s.name}</p>
                    {s.city && <p className="text-xs text-muted-foreground">{s.city}</p>}
                    <p className="text-xs text-muted-foreground">
                      {s.nutritionists_count ?? 0} nutricionista(s)
                    </p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre sede"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    className="rounded-lg"
                  />
                  <Input
                    placeholder="Ciudad"
                    value={newSiteCity}
                    onChange={(e) => setNewSiteCity(e.target.value)}
                    className="rounded-lg w-28"
                  />
                  <Button size="sm" variant="outline" onClick={addSite}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-1">
                  <Gift className="h-4 w-4" />
                  Códigos de beneficio ({benefitCodes.length})
                </p>
                {benefitCodes.map((bc) => (
                  <div key={bc.id} className="rounded-lg border px-3 py-2 text-sm flex justify-between gap-2">
                    <div>
                      <button type="button" className="font-mono font-semibold hover:underline" onClick={() => copyCode(bc.code)}>
                        {bc.code}
                      </button>
                      <p className="text-xs text-muted-foreground">{bc.benefit_label || bc.label}</p>
                      <p className="text-xs">
                        {bc.uses_count}{bc.max_uses != null ? `/${bc.max_uses}` : ""} usos
                        {bc.expires_at && ` · vence ${bc.expires_at.slice(0, 10)}`}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteBenefitCode(bc.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                  <p className="text-xs font-medium">Nuevo código promocional</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Código"
                      value={benefitCodeForm.code}
                      onChange={(e) => setBenefitCodeForm({ ...benefitCodeForm, code: e.target.value.toUpperCase() })}
                      className="font-mono"
                    />
                    <Input
                      placeholder="Etiqueta"
                      value={benefitCodeForm.label}
                      onChange={(e) => setBenefitCodeForm({ ...benefitCodeForm, label: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Máx usos"
                      value={benefitCodeForm.max_uses}
                      onChange={(e) => setBenefitCodeForm({ ...benefitCodeForm, max_uses: e.target.value })}
                    />
                    <Input
                      type="date"
                      value={benefitCodeForm.expires_at}
                      onChange={(e) => setBenefitCodeForm({ ...benefitCodeForm, expires_at: e.target.value })}
                    />
                  </div>
                  <Button size="sm" disabled={benefitCodeSaving} onClick={createBenefitCode}>
                    {benefitCodeSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Crear código
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Adscribir paciente</DialogTitle>
            <DialogDescription>
              El paciente recibirá el beneficio de {detail?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Paciente</Label>
            <Select value={memberUserId} onValueChange={setMemberUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!memberUserId} onClick={addMember}>
              Adscribir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
