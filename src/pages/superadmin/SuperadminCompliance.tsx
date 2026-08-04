import { useCallback, useEffect, useState } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import {
  Shield,
  FileText,
  Download,
  Trash2,
  Eye,
  Scale,
  AlertTriangle,
  Loader2,
  RefreshCw,
  UserCheck,
  BookOpen,
} from "lucide-react";

interface Overview {
  framework: string;
  stats: {
    active_consents: number;
    pending_deletion_requests: number;
    clinical_accesses_24h: number;
    open_breach_reports: number;
  };
  legal_versions: Record<string, { version: string; published_at?: string }>;
  retention: { audit_retention_days: number; personal_data_retention_days: number };
  consent_types: Record<string, string>;
  legal_doc_types: Record<string, string>;
}

interface ConsentRow {
  id: number;
  user_id: number;
  user_name?: string;
  consent_type: string;
  consent_label?: string;
  granted: boolean;
  active: boolean;
  policy_version: string;
  created_at?: string;
}

interface DeletionRow {
  id: number;
  user_id: number;
  user_name: string;
  status: string;
  reason?: string;
  created_at?: string;
}

interface ClinicalLog {
  id: number;
  actor_name: string;
  patient_id: number;
  resource_type: string;
  action: string;
  created_at?: string;
}

interface LegalDoc {
  id: number;
  doc_type: string;
  doc_label?: string;
  version: string;
  title: string;
  content_md: string;
  is_current: boolean;
}

interface BreachRow {
  id: number;
  title: string;
  severity: string;
  status: string;
  affected_users_count: number;
  notified_authorities: boolean;
  notified_users: boolean;
  created_at?: string;
}

export default function SuperadminCompliance() {
  const token = () => localStorage.getItem("userToken");
  const headers = (json = false) => ({
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
  });

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [deletions, setDeletions] = useState<DeletionRow[]>([]);
  const [clinicalLogs, setClinicalLogs] = useState<ClinicalLog[]>([]);
  const [legalDocs, setLegalDocs] = useState<LegalDoc[]>([]);
  const [breaches, setBreaches] = useState<BreachRow[]>([]);

  const [exportUserId, setExportUserId] = useState("");
  const [deletionUserId, setDeletionUserId] = useState("");
  const [consentUserId, setConsentUserId] = useState("");
  const [consentType, setConsentType] = useState("habeas_data");
  const [userOptions, setUserOptions] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [userSearch, setUserSearch] = useState("");

  const [breachOpen, setBreachOpen] = useState(false);
  const [breachForm, setBreachForm] = useState({
    title: "",
    description: "",
    severity: "medium",
    affected_users_count: 0,
  });

  const [docOpen, setDocOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    doc_type: "privacy_policy",
    version: "",
    title: "",
    content_md: "",
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ov, co, del, cl, leg, br] = await Promise.all([
        fetch(`${API_URL}/superadmin/compliance/overview`, { headers: headers() }),
        fetch(`${API_URL}/superadmin/compliance/consents?limit=80`, { headers: headers() }),
        fetch(`${API_URL}/superadmin/compliance/deletion-requests`, { headers: headers() }),
        fetch(`${API_URL}/superadmin/compliance/clinical-access-logs?limit=80`, { headers: headers() }),
        fetch(`${API_URL}/superadmin/compliance/legal-documents`, { headers: headers() }),
        fetch(`${API_URL}/superadmin/compliance/breaches`, { headers: headers() }),
      ]);
      if (ov.ok) setOverview(await ov.json());
      if (co.ok) {
        const d = await co.json();
        setConsents(d.consents || []);
      }
      if (del.ok) {
        const d = await del.json();
        setDeletions(d.requests || []);
      }
      if (cl.ok) {
        const d = await cl.json();
        setClinicalLogs(d.logs || []);
      }
      if (leg.ok) {
        const d = await leg.json();
        setLegalDocs(d.documents || []);
      }
      if (br.ok) {
        const d = await br.json();
        setBreaches(d.breaches || []);
      }
    } catch {
      toast.error("Error al cargar compliance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch(`${API_URL}/superadmin/users`, { headers: headers() })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) =>
        setUserOptions(
          (rows as Array<{ id: number; name: string; email: string }>).map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
          }))
        )
      )
      .catch(() => {});
  }, []);

  const filteredUsers = userOptions.filter(
    (u) =>
      !userSearch ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      String(u.id).includes(userSearch)
  );

  const exportData = async () => {
    const uid = parseInt(exportUserId, 10);
    if (!uid) return toast.error("ID de usuario inválido");
    const res = await fetch(`${API_URL}/superadmin/compliance/data-export/${uid}`, { headers: headers() });
    if (!res.ok) return toast.error("Error en exportación");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `datos-personales-${uid}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportación descargada (Ley 1581)");
  };

  const exportConsentsCsv = async () => {
    const res = await fetch(`${API_URL}/superadmin/compliance/consents/export`, { headers: headers() });
    if (!res.ok) return toast.error("Error al exportar CSV");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "consentimientos-ley1581.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const registerConsent = async () => {
    const uid = parseInt(consentUserId, 10);
    if (!uid) return toast.error("ID inválido");
    const res = await fetch(`${API_URL}/superadmin/compliance/consents`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ user_id: uid, consent_type: consentType, granted: true }),
    });
    if (!res.ok) return toast.error("Error al registrar");
    toast.success("Consentimiento registrado");
    load();
  };

  const requestDeletion = async () => {
    const uid = parseInt(deletionUserId, 10);
    if (!uid) return toast.error("ID inválido");
    const res = await fetch(`${API_URL}/superadmin/compliance/deletion-requests`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ user_id: uid, reason: "Solicitud superadmin" }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return toast.error(d.detail || "Error");
    }
    toast.success("Solicitud de eliminación creada");
    load();
  };

  const processDeletion = async (id: number, action: string) => {
    const res = await fetch(`${API_URL}/superadmin/compliance/deletion-requests/${id}/process`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return toast.error("Error al procesar");
    toast.success(action === "complete" ? "Cuenta anonimizada" : `Estado: ${action}`);
    load();
  };

  const publishDoc = async (id: number) => {
    const res = await fetch(`${API_URL}/superadmin/compliance/legal-documents/${id}/publish`, {
      method: "POST",
      headers: headers(true),
    });
    if (!res.ok) return toast.error("Error al publicar");
    toast.success("Documento publicado como vigente");
    load();
  };

  const createDoc = async () => {
    const res = await fetch(`${API_URL}/superadmin/compliance/legal-documents`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify(docForm),
    });
    if (!res.ok) return toast.error("Error al crear documento");
    setDocOpen(false);
    toast.success("Borrador creado — publícalo para hacerlo vigente");
    load();
  };

  const createBreach = async () => {
    const res = await fetch(`${API_URL}/superadmin/compliance/breaches`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify(breachForm),
    });
    if (!res.ok) return toast.error("Error al reportar");
    setBreachOpen(false);
    setBreachForm({ title: "", description: "", severity: "medium", affected_users_count: 0 });
    toast.success("Brecha registrada");
    load();
  };

  const updateBreach = async (id: number, patch: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/superadmin/compliance/breaches/${id}`, {
      method: "PATCH",
      headers: headers(true),
      body: JSON.stringify(patch),
    });
    if (!res.ok) return toast.error("Error al actualizar");
    load();
  };

  if (loading && !overview) {
    return (
      <SuperadminLayout>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SuperadminLayout>
    );
  }

  const ov = overview!;

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Scale className="h-8 w-8 text-primary" />
              Compliance y privacidad
            </h1>
            <p className="text-muted-foreground">{ov.framework}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Consentimientos activos", value: ov.stats.active_consents, icon: UserCheck },
            { label: "Eliminaciones pendientes", value: ov.stats.pending_deletion_requests, icon: Trash2 },
            { label: "Accesos clínicos 24h", value: ov.stats.clinical_accesses_24h, icon: Eye },
            { label: "Brechas abiertas", value: ov.stats.open_breach_reports, icon: AlertTriangle },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6 flex items-center gap-3">
                <s.icon className="h-8 w-8 text-primary/70" />
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Retención de datos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            <Badge variant="outline">Auditoría: {ov.retention.audit_retention_days} días</Badge>
            <Badge variant="outline">Datos personales: {ov.retention.personal_data_retention_days} días</Badge>
            {Object.entries(ov.legal_versions).map(([k, v]) => (
              <Badge key={k} variant="secondary">
                {ov.legal_doc_types[k] || k} v{v.version}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Tabs defaultValue="consents" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="consents">Habeas Data</TabsTrigger>
            <TabsTrigger value="export">Export / olvido</TabsTrigger>
            <TabsTrigger value="clinical">Accesos clínicos</TabsTrigger>
            <TabsTrigger value="legal">Políticas</TabsTrigger>
            <TabsTrigger value="breaches">Brechas</TabsTrigger>
          </TabsList>

          <TabsContent value="consents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Registrar consentimiento</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label>User ID</Label>
                  <Input value={consentUserId} onChange={(e) => setConsentUserId(e.target.value)} className="w-28" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={consentType} onValueChange={setConsentType}>
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ov.consent_types).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={registerConsent}>Registrar</Button>
                <Button variant="outline" className="gap-2" onClick={exportConsentsCsv}>
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Versión</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consents.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.user_name || c.user_id}</TableCell>
                        <TableCell className="text-xs">{c.consent_label || c.consent_type}</TableCell>
                        <TableCell>{c.policy_version}</TableCell>
                        <TableCell>
                          <Badge variant={c.active ? "default" : "secondary"}>
                            {c.active ? "Activo" : "Revocado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{c.created_at}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="export" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Exportación de datos (Ley 1581)</CardTitle>
                  <CardDescription>Portabilidad — JSON con perfil, salud, consentimientos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Buscar usuario..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  <Select value={exportUserId} onValueChange={setExportUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUsers.slice(0, 50).map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button className="gap-2 w-full" onClick={exportData} disabled={!exportUserId}>
                    <Download className="h-4 w-4" /> Exportar JSON
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Derecho al olvido</CardTitle>
                  <CardDescription>Solicitud → aprobar → completar (anonimiza PII)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={deletionUserId} onValueChange={setDeletionUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUsers.slice(0, 50).map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="destructive" className="w-full shrink-0" onClick={requestDeletion} disabled={!deletionUserId}>
                    Solicitar eliminación
                  </Button>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Solicitudes de eliminación</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletions.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{d.user_name}</TableCell>
                        <TableCell>
                          <Badge>{d.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-xs truncate">{d.reason || "—"}</TableCell>
                        <TableCell className="space-x-1">
                          {d.status === "pending" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => processDeletion(d.id, "approve")}>
                                Aprobar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => processDeletion(d.id, "reject")}>
                                Rechazar
                              </Button>
                            </>
                          )}
                          {d.status === "approved" && (
                            <Button size="sm" variant="destructive" onClick={() => processDeletion(d.id, "complete")}>
                              Anonimizar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clinical">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Registro de accesos a datos clínicos
                </CardTitle>
                <CardDescription>Bioquímicos, MIPRESS, RIPS, historia clínica</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Actor</TableHead>
                      <TableHead>Paciente ID</TableHead>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clinicalLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Sin accesos registrados — se registran al usar Clínica CO
                        </TableCell>
                      </TableRow>
                    ) : (
                      clinicalLogs.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.actor_name}</TableCell>
                          <TableCell>{l.patient_id}</TableCell>
                          <TableCell>{l.resource_type}</TableCell>
                          <TableCell>{l.action}</TableCell>
                          <TableCell className="text-xs">{l.created_at}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="legal" className="space-y-4">
            <div className="flex justify-end">
              <Button className="gap-2" onClick={() => setDocOpen(true)}>
                <FileText className="h-4 w-4" /> Nueva versión
              </Button>
            </div>
            {legalDocs.map((d) => (
              <Card key={d.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{d.title}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant={d.is_current ? "default" : "outline"}>
                        {d.is_current ? "Vigente" : "Borrador"} v{d.version}
                      </Badge>
                      {!d.is_current && (
                        <Button size="sm" variant="outline" onClick={() => publishDoc(d.id)}>
                          Publicar
                        </Button>
                      )}
                    </div>
                  </div>
                  <CardDescription>{d.doc_label || d.doc_type}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs whitespace-pre-wrap max-h-40 overflow-y-auto bg-muted/50 p-3 rounded-lg">
                    {d.content_md.slice(0, 800)}
                    {d.content_md.length > 800 ? "…" : ""}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="breaches" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="destructive" className="gap-2" onClick={() => setBreachOpen(true)}>
                <AlertTriangle className="h-4 w-4" /> Reportar brecha
              </Button>
            </div>
            <Card>
              <CardContent className="pt-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Severidad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Afectados</TableHead>
                      <TableHead>Notificaciones</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breaches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{b.title}</TableCell>
                        <TableCell>
                          <Badge variant={b.severity === "critical" ? "destructive" : "secondary"}>
                            {b.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{b.status}</TableCell>
                        <TableCell>{b.affected_users_count}</TableCell>
                        <TableCell className="text-xs">
                          Autoridad: {b.notified_authorities ? "Sí" : "No"} · Usuarios:{" "}
                          {b.notified_users ? "Sí" : "No"}
                        </TableCell>
                        <TableCell className="space-x-1">
                          {!b.notified_authorities && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateBreach(b.id, { notified_authorities: true, status: "reported_authority" })}
                            >
                              SIC notificada
                            </Button>
                          )}
                          {!b.notified_users && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateBreach(b.id, { notified_users: true })}
                            >
                              Usuarios notificados
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={breachOpen} onOpenChange={setBreachOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reporte de brecha de seguridad</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Título"
              value={breachForm.title}
              onChange={(e) => setBreachForm({ ...breachForm, title: e.target.value })}
            />
            <Textarea
              placeholder="Descripción del incidente"
              value={breachForm.description}
              onChange={(e) => setBreachForm({ ...breachForm, description: e.target.value })}
            />
            <Select
              value={breachForm.severity}
              onValueChange={(v) => setBreachForm({ ...breachForm, severity: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["low", "medium", "high", "critical"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Usuarios afectados"
              value={breachForm.affected_users_count}
              onChange={(e) =>
                setBreachForm({ ...breachForm, affected_users_count: parseInt(e.target.value, 10) || 0 })
              }
            />
          </div>
          <DialogFooter>
            <Button onClick={createBreach}>Registrar brecha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva versión legal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={docForm.doc_type} onValueChange={(v) => setDocForm({ ...docForm, doc_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ov.legal_doc_types).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Versión (ej. 1.1)"
              value={docForm.version}
              onChange={(e) => setDocForm({ ...docForm, version: e.target.value })}
            />
            <Input
              placeholder="Título"
              value={docForm.title}
              onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
            />
            <Textarea
              className="min-h-[200px]"
              placeholder="Contenido Markdown"
              value={docForm.content_md}
              onChange={(e) => setDocForm({ ...docForm, content_md: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button onClick={createDoc}>Guardar borrador</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
