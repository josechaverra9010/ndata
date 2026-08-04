import { useState, useEffect } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  Plus,
  MoreVertical,
  Star,
  Users,
  Calendar,
  Trash2,
  Edit,
  Eye,
  Mail,
  Phone,
  Award,
  Briefcase,
  FileText,
  Copy,
  Link,
  Download,
  UserCheck,
  UserX,
  Building2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Circle,
  LogIn,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { startImpersonation } from "@/lib/impersonation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
}

interface Onboarding {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  percent: number;
  is_complete: boolean;
}

interface LicenseAlert {
  nutritionist_id: number;
  name: string;
  email: string;
  license?: string;
  license_expiry?: string;
  alert: "expired" | "expiring_soon";
}

interface Nutritionist {
  id: number;
  name: string;
  email: string;
  specialty: string | null;
  patients: number;
  rating: number;
  status: string;
  avatar?: string;
  joinedAt: string;
  organization?: string;
  organization_id?: number | null;
  staff_role?: StaffRole;
  license?: string | null;
  license_expiry?: string | null;
  license_alert?: string | null;
  invite_expires_at?: string | null;
  onboarding?: Onboarding;
}

interface NutritionistDetails extends Nutritionist {
  phone?: string;
  license?: string;
  bio?: string;
}

interface OrganizationOption {
  id: number;
  name: string;
}

import { API_URL } from "@/config/api";
import { STAFF_ROLE_LABELS, StaffRole } from "@/lib/staffPermissions";

export default function SuperadminNutritionists() {
  const [nutritionists, setNutritionists] = useState<Nutritionist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedNutritionist, setSelectedNutritionist] = useState<NutritionistDetails | null>(null);
  const [editData, setEditData] = useState<Partial<NutritionistDetails & {
    staff_role?: StaffRole;
    license_expiry?: string;
    organization_id?: number;
  }>>({});
  const [roleSaving, setRoleSaving] = useState(false);
  const [inviteData, setInviteData] = useState({
    name: "",
    email: "",
    specialty: ""
  });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    totalPatients: 0
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [licenseAlerts, setLicenseAlerts] = useState<LicenseAlert[]>([]);
  const [reassignOrgOpen, setReassignOrgOpen] = useState(false);
  const [reassignOrgId, setReassignOrgId] = useState("");

  const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem("userToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Cargar nutricionistas
  useEffect(() => {
    fetchNutritionists();
    fetchLicenseAlerts();
    fetch(`${API_URL}/superadmin/organizations`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((orgs) => setOrganizations(orgs.map((o: OrganizationOption) => ({ id: o.id, name: o.name }))))
      .catch(() => {});
  }, []);

  const fetchNutritionists = async () => {
    try {
      setLoading(true);
      const params = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : "";
      const response = await fetch(`${API_URL}/superadmin/nutritionists${params}`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      setNutritionists(data);
      setSelectedIds([]);

      setStats({
        total: data.length,
        active: data.filter((n: Nutritionist) => n.status === "activo").length,
        pending: data.filter((n: Nutritionist) => n.status === "pendiente").length,
        totalPatients: data.reduce((acc: number, n: Nutritionist) => acc + n.patients, 0)
      });
    } catch (error) {
      console.error("Error al cargar nutricionistas:", error);
      toast.error("Error al cargar nutricionistas");
    } finally {
      setLoading(false);
    }
  };

  const fetchLicenseAlerts = async () => {
    try {
      const res = await fetch(`${API_URL}/superadmin/nutritionists/license-alerts`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setLicenseAlerts(data.alerts || []);
      }
    } catch {
      /* ignore */
    }
  };

  // Buscar cuando cambie el query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        fetchNutritionists();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredNutritionists = nutritionists.filter(n =>
    n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (n.specialty && n.specialty.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este nutricionista?")) return;

    try {
      const response = await fetch(`${API_URL}/superadmin/nutritionists/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Nutricionista eliminado");
        fetchNutritionists();
      } else {
        const data = await response.json();
        toast.error(data.detail || "Error al eliminar nutricionista");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al eliminar nutricionista");
    }
  };

  const handleViewDetails = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/superadmin/nutritionists/${id}`);
      const data = await response.json();
      setSelectedNutritionist(data);
      setIsDetailsOpen(true);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al cargar detalles");
    }
  };

  const [registrationLink, setRegistrationLink] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const handleInvite = async () => {
    if (!inviteData.name || !inviteData.email) {
      toast.error("Nombre y email son requeridos");
      return;
    }

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/superadmin/nutritionists/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(inviteData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setIsInviteOpen(false);
        setInviteData({ name: "", email: "", specialty: "" });
        fetchNutritionists();
        if (data.registration_link) {
          setRegistrationLink(data.registration_link);
          setLinkDialogOpen(true);
        }
      } else {
        toast.error(data.detail || "Error al agregar nutricionista");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al agregar nutricionista");
    }
  };

  const copyRegistrationLink = () => {
    if (registrationLink) {
      navigator.clipboard.writeText(registrationLink);
      toast.success("Enlace copiado al portapapeles");
    }
  };

  const handleSaveStaffRole = async (nutritionistId: number, staffRole: StaffRole) => {
    setRoleSaving(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/superadmin/nutritionists/${nutritionistId}/staff-role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ staff_role: staffRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.detail === "string" ? data.detail : "Error al guardar rol");
      }
      toast.success("Rol actualizado");
      fetchNutritionists();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    } finally {
      setRoleSaving(false);
    }
  };

  const handleEdit = (nutritionist: Nutritionist) => {
    setSelectedNutritionist(nutritionist as NutritionistDetails);
    setEditData({
      name: nutritionist.name,
      email: nutritionist.email,
      specialty: nutritionist.specialty || "",
      staff_role: nutritionist.staff_role || "nutritionist",
      license: nutritionist.license || "",
      license_expiry: nutritionist.license_expiry || "",
      organization_id: nutritionist.organization_id ?? undefined,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedNutritionist) return;

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/superadmin/users/${selectedNutritionist.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: editData.name,
          email: editData.email,
          role: "admin",
          status: selectedNutritionist.status,
          phone: editData.phone || ""
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Error al actualizar usuario");
      }

      const profileRes = await fetch(
        `${API_URL}/superadmin/nutritionists/${selectedNutritionist.id}/profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            specialty: editData.specialty,
            license: editData.license,
            license_expiry: editData.license_expiry,
            bio: editData.bio,
            phone: editData.phone,
            staff_role: editData.staff_role,
            organization_id: editData.organization_id ?? undefined,
          }),
        }
      );
      if (!profileRes.ok) {
        const data = await profileRes.json().catch(() => ({}));
        throw new Error(data.detail || "Error al guardar perfil profesional");
      }

      toast.success("Nutricionista actualizado correctamente");
      setIsEditOpen(false);
      setSelectedNutritionist(null);
      setEditData({});
      fetchNutritionists();
      fetchLicenseAlerts();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar");
    }
  };

  const handleResendInvite = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/nutritionists/${id}/resend-invite`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al reenviar");
      toast.success(data.message);
      if (data.registration_link) {
        setRegistrationLink(data.registration_link);
        setLinkDialogOpen(true);
      }
      fetchNutritionists();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al reenviar invitación");
    }
  };

  const handleImpersonate = async (id: number) => {
    const reason = window.prompt(
      "Motivo de impersonación (mín. 5 caracteres — queda en auditoría):"
    );
    if (!reason?.trim()) return;
    const ok = await startImpersonation(id, reason.trim());
    if (!ok) toast.error("No se pudo iniciar impersonación. Verifica el motivo (mín. 5 caracteres).");
  };

  const runBulkAction = async (action: string, extra?: Record<string, unknown>) => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/users/bulk-action`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ action, user_ids: selectedIds, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error");
      toast.success(data.message);
      setSelectedIds([]);
      setReassignOrgOpen(false);
      fetchNutritionists();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportSelected = () => {
    const rows = nutritionists.filter((n) => selectedIds.includes(n.id));
    const csv = [
      "ID,Nombre,Email,Especialidad,Estado,TO,Vencimiento TO,Pacientes,Organización",
      ...rows.map((n) =>
        [
          n.id,
          `"${n.name}"`,
          n.email,
          `"${n.specialty || ""}"`,
          n.status,
          n.license || "",
          n.license_expiry || "",
          n.patients,
          `"${n.organization || ""}"`,
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nutricionistas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success(`Exportados ${rows.length} nutricionistas`);
  };

  const toggleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    try {
      const response = await fetch(`${API_URL}/superadmin/users/${id}/toggle-status`, {
        method: "PATCH",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Nutricionista ${data.status === "activo" ? "activado" : "desactivado"}`);
        fetchNutritionists();
      } else {
        throw new Error("Error al cambiar estado");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al cambiar estado");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "activo":
        return <Badge className="bg-success/10 text-success border-0">Activo</Badge>;
      case "inactivo":
        return <Badge className="bg-muted text-muted-foreground border-0">Inactivo</Badge>;
      case "pendiente":
        return <Badge className="bg-warning/10 text-warning border-0">Pendiente</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SuperadminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </SuperadminLayout>
    );
  }

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Nutricionistas</h1>
            <p className="text-muted-foreground">Gestiona los profesionales de la plataforma</p>
          </div>
          <Button onClick={() => setIsInviteOpen(true)} className="gradient-primary border-0">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Nutricionista
          </Button>
        </div>

        {licenseAlerts.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Alertas licencia TO ({licenseAlerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {licenseAlerts.slice(0, 5).map((a) => (
                <div key={a.nutritionist_id} className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-lg border p-2">
                  <span>
                    <strong>{a.name}</strong> — TO {a.license || "—"} vence {a.license_expiry || "—"}
                  </span>
                  <Badge variant={a.alert === "expired" ? "destructive" : "outline"}>
                    {a.alert === "expired" ? "Vencida" : "Por vencer"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {selectedIds.length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{selectedIds.length} seleccionado(s)</span>
              <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => runBulkAction("activate")}>
                <UserCheck className="h-4 w-4 mr-1" /> Activar
              </Button>
              <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => runBulkAction("deactivate")}>
                <UserX className="h-4 w-4 mr-1" /> Desactivar
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportSelected}>
                <Download className="h-4 w-4 mr-1" /> Exportar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReassignOrgOpen(true)}>
                <Building2 className="h-4 w-4 mr-1" /> Reasignar org
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <p className="text-sm text-muted-foreground">Total nutricionistas</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-success">{stats.active}</div>
              <p className="text-sm text-muted-foreground">Activos</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-warning">{stats.pending}</div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{stats.totalPatients}</div>
              <p className="text-sm text-muted-foreground">Pacientes totales</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredNutritionists.map((nutritionist) => (
            <Card key={nutritionist.id} className="border-border bg-card relative">
              <div className="absolute top-3 left-3 z-10">
                <Checkbox
                  checked={selectedIds.includes(nutritionist.id)}
                  onCheckedChange={(v) => toggleSelect(nutritionist.id, Boolean(v))}
                />
              </div>
              <CardContent className="pt-6 pl-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={nutritionist.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {nutritionist.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{nutritionist.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {nutritionist.specialty || "Sin especialidad"}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewDetails(nutritionist.id)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver perfil
                      </DropdownMenuItem>
                      {nutritionist.status === "activo" && (
                        <DropdownMenuItem onClick={() => handleImpersonate(nutritionist.id)}>
                          <LogIn className="h-4 w-4 mr-2" />
                          Ver como nutricionista
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleEdit(nutritionist)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {nutritionist.status === "pendiente" && (
                        <DropdownMenuItem onClick={() => handleResendInvite(nutritionist.id)}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reenviar invitación
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleToggleStatus(nutritionist.id, nutritionist.status)}>
                        {nutritionist.status === "activo" ? (
                          <>
                            <Users className="h-4 w-4 mr-2" />
                            Desactivar
                          </>
                        ) : (
                          <>
                            <Users className="h-4 w-4 mr-2" />
                            Activar
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Mail className="h-4 w-4 mr-2" />
                        Enviar email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(nutritionist.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Estado</span>
                    <div className="flex items-center gap-1">
                      {getStatusBadge(nutritionist.status)}
                      {nutritionist.license_alert === "expired" && (
                        <Badge variant="destructive" className="text-[10px]">TO vencida</Badge>
                      )}
                      {nutritionist.license_alert === "expiring_soon" && (
                        <Badge variant="outline" className="text-[10px] border-amber-500">TO por vencer</Badge>
                      )}
                    </div>
                  </div>
                  {nutritionist.onboarding && !nutritionist.onboarding.is_complete && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Onboarding</span>
                        <span>{nutritionist.onboarding.percent}%</span>
                      </div>
                      <Progress value={nutritionist.onboarding.percent} className="h-1.5" />
                    </div>
                  )}
                  {nutritionist.status === "pendiente" && nutritionist.invite_expires_at && (
                    <p className="text-xs text-warning">
                      Invitación expira: {nutritionist.invite_expires_at}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Rol</span>
                    <Badge variant="outline" className="text-xs">
                      {STAFF_ROLE_LABELS[nutritionist.staff_role || "nutritionist"]}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Pacientes
                    </span>
                    <span className="font-medium text-foreground">{nutritionist.patients}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      Rating
                    </span>
                    <span className="font-medium text-foreground">
                      {nutritionist.rating > 0 ? nutritionist.rating.toFixed(2) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Registro
                    </span>
                    <span className="text-foreground">{nutritionist.joinedAt}</span>
                  </div>
                  {nutritionist.organization && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">{nutritionist.organization}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Nutricionista</DialogTitle>
            <DialogDescription>
              Agrega un nutricionista. Se enviará un correo con el enlace de registro a su email. También podrás copiar el enlace por si lo necesitas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input
                value={inviteData.name}
                onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Especialidad (opcional)</Label>
              <Input
                value={inviteData.specialty}
                onChange={(e) => setInviteData({ ...inviteData, specialty: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} className="gradient-primary border-0">
              Generar enlace de registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registration link dialog - show after invite success */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="h-5 w-5 text-primary" />
              Enlace de registro
            </DialogTitle>
            <DialogDescription>
              Se ha enviado un correo al nutricionista con este enlace. Si no lo recibe, puedes copiarlo y compartirlo manualmente. El enlace es válido por 7 días.
            </DialogDescription>
          </DialogHeader>
          {registrationLink && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={registrationLink}
                  className="font-mono text-xs bg-muted/50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyRegistrationLink}
                  title="Copiar enlace"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={copyRegistrationLink} className="w-full gap-2" variant="secondary">
                <Copy className="h-4 w-4" />
                Copiar enlace al portapapeles
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => { setLinkDialogOpen(false); setRegistrationLink(null); }}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Perfil del Nutricionista</DialogTitle>
            <DialogDescription>
              Información completa del profesional
            </DialogDescription>
          </DialogHeader>
          {selectedNutritionist && (
            <div className="space-y-6 py-4">
              {/* Header con Avatar */}
              <div className="flex items-start gap-4 pb-4 border-b">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={selectedNutritionist.avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                    {selectedNutritionist.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{selectedNutritionist.name}</h3>
                  <p className="text-muted-foreground mb-2">
                    {selectedNutritionist.specialty || "Sin especialidad"}
                  </p>
                  <div className="flex gap-2">
                    {getStatusBadge(selectedNutritionist.status)}
                    <Badge variant="outline" className="gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {selectedNutritionist.rating.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Información de Contacto */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Información de Contacto
                </h4>
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="font-medium text-sm">{selectedNutritionist.email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Teléfono</Label>
                    <p className="font-medium text-sm">{selectedNutritionist.phone || "No registrado"}</p>
                  </div>
                </div>
              </div>

              {/* Información Profesional */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Información Profesional
                </h4>
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Especialidad</Label>
                    <p className="font-medium text-sm">{selectedNutritionist.specialty || "No especificada"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Número de TO (tarjeta profesional)</Label>
                    <p className="font-medium text-sm">{selectedNutritionist.license || "No registrada"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Vencimiento TO</Label>
                    <p className="font-medium text-sm flex items-center gap-2">
                      {selectedNutritionist.license_expiry || "No registrada"}
                      {selectedNutritionist.license_alert === "expired" && (
                        <Badge variant="destructive">Vencida</Badge>
                      )}
                      {selectedNutritionist.license_alert === "expiring_soon" && (
                        <Badge variant="outline">Por vencer</Badge>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {selectedNutritionist.onboarding && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Onboarding ({selectedNutritionist.onboarding.completed}/{selectedNutritionist.onboarding.total})
                  </h4>
                  <Progress value={selectedNutritionist.onboarding.percent} className="h-2" />
                  <div className="space-y-2">
                    {selectedNutritionist.onboarding.steps.map((step) => (
                      <div key={step.key} className="flex items-center gap-2 text-sm">
                        {step.done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={cn(step.done && "text-muted-foreground line-through")}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Estadísticas */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Estadísticas
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border-border">
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-foreground">{selectedNutritionist.patients}</div>
                      <p className="text-xs text-muted-foreground">Pacientes Activos</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border">
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-foreground">{selectedNutritionist.rating.toFixed(2)}</div>
                      <p className="text-xs text-muted-foreground">Rating Promedio</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border">
                    <CardContent className="pt-4 text-center">
                      <Calendar className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{selectedNutritionist.joinedAt}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Biografía */}
              {selectedNutritionist.bio && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Biografía
                  </h4>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <p className="text-sm leading-relaxed">{selectedNutritionist.bio}</p>
                  </div>
                </div>
              )}

              {/* Organización */}
              {selectedNutritionist.organization && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Organización
                  </h4>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <p className="text-sm font-medium">{selectedNutritionist.organization}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              Cerrar
            </Button>
            <Button
              onClick={() => {
                setIsDetailsOpen(false);
                if (selectedNutritionist) handleEdit(selectedNutritionist);
              }}
              className="gradient-primary border-0"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar Perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nutricionista</DialogTitle>
            <DialogDescription>
              Actualiza la información del profesional
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input
                value={editData.name || ""}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editData.email || ""}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={editData.phone || ""}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Especialidad</Label>
              <Input
                value={editData.specialty || ""}
                onChange={(e) => setEditData({ ...editData, specialty: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Número de TO (tarjeta profesional)</Label>
              <Input
                value={editData.license || ""}
                onChange={(e) => setEditData({ ...editData, license: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimiento TO</Label>
              <Input
                type="date"
                value={editData.license_expiry || ""}
                onChange={(e) => setEditData({ ...editData, license_expiry: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Organización (EPS)</Label>
              <Select
                value={editData.organization_id ? String(editData.organization_id) : "none"}
                onValueChange={(v) =>
                  setEditData({
                    ...editData,
                    organization_id: v === "none" ? undefined : Number(v),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin organización" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin organización</SelectItem>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rol granular</Label>
              <Select
                value={editData.staff_role || "nutritionist"}
                onValueChange={(v) => setEditData({ ...editData, staff_role: v as StaffRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {STAFF_ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Asistente: solo citas · Senior: + transferencias · Admin org: solo su EPS
              </p>
            </div>
            <div className="space-y-2">
              <Label>Biografía</Label>
              <Textarea
                value={editData.bio || ""}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditOpen(false);
              setEditData({});
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} className="gradient-primary border-0">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reassignOrgOpen} onOpenChange={setReassignOrgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reasignar organización</DialogTitle>
          </DialogHeader>
          <Select value={reassignOrgId} onValueChange={setReassignOrgId}>
            <SelectTrigger>
              <SelectValue placeholder="Organización destino" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOrgOpen(false)}>Cancelar</Button>
            <Button
              disabled={!reassignOrgId || bulkLoading}
              onClick={() =>
                runBulkAction("reassign_org", { organization_id: Number(reassignOrgId) })
              }
            >
              Reasignar {selectedIds.length} nutricionista(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}