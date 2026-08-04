import { useCallback, useEffect, useState } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Eye,
  Key,
  Loader2,
  Mail,
  RefreshCw,
  Shield,
  Workflow,
  FileText,
  Gauge,
  Sparkles,
} from "lucide-react";

function authH(json = false) {
  const h: Record<string, string> = {};
  const t = localStorage.getItem("userToken");
  if (t) h.Authorization = `Bearer ${t}`;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export default function SuperadminPlatform() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [impLogs, setImpLogs] = useState<unknown[]>([]);
  const [campaigns, setCampaigns] = useState<unknown[]>([]);
  const [workflows, setWorkflows] = useState<unknown[]>([]);
  const [apiKeys, setApiKeys] = useState<unknown[]>([]);
  const [rateLimits, setRateLimits] = useState({ default_rpm: 120, upload_rpm: 30, partner_rpm: 60, enabled: true });
  const [totpStatus, setTotpStatus] = useState({ enabled: false });
  const [totpSetup, setTotpSetup] = useState<{ backup_codes?: string[]; otpauth_uri?: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [ipList, setIpList] = useState<unknown[]>([]);
  const [reports, setReports] = useState<unknown[]>([]);
  const [releaseNotes, setReleaseNotes] = useState<unknown[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<{ id: number; name: string }[]>([]);
  const [partnerScopes, setPartnerScopes] = useState<Record<string, string>>({});
  const [keyForm, setKeyForm] = useState({
    name: "",
    organization_id: "",
    scopes: ["aggregates:read", "organization:read"] as string[],
    rate_limit_rpm: 60,
    is_sandbox: false,
  });
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);

  const [commForm, setCommForm] = useState({
    title: "",
    subject: "",
    body: "",
    channel: "email",
    cohort_type: "role",
    cohort_value: "patient",
  });
  const [newIp, setNewIp] = useState({ cidr_or_ip: "", label: "" });
  const [newNote, setNewNote] = useState({ version: "", title: "", body: "", roles: ["all"] });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [ov, logs, comm, wf, keys, rl, totp, ips, reps, notes, orgRes, scopesRes] = await Promise.all([
        fetch(`${API_URL}/superadmin/platform/overview`, { headers: authH() }),
        fetch(`${API_URL}/superadmin/impersonation/logs`, { headers: authH() }),
        fetch(`${API_URL}/superadmin/platform/communications`, { headers: authH() }),
        fetch(`${API_URL}/superadmin/platform/workflows`, { headers: authH() }),
        fetch(`${API_URL}/superadmin/platform/api-keys`, { headers: authH() }),
        fetch(`${API_URL}/superadmin/platform/rate-limits`, { headers: authH() }),
        fetch(`${API_URL}/superadmin/platform/2fa/status`, { headers: authH() }),
        fetch(`${API_URL}/superadmin/platform/ip-allowlist`, { headers: authH() }),
        fetch(`${API_URL}/superadmin/platform/scheduled-reports`, { headers: authH() }),
        fetch(`${API_URL}/superadmin/platform/release-notes`, { headers: authH() }),
        fetch(`${API_URL}/superadmin/organizations`, { headers: authH() }),
        fetch(`${API_URL}/superadmin/platform/partner-scopes`, { headers: authH() }),
      ]);
      if (ov.ok) setOverview(await ov.json());
      if (logs.ok) setImpLogs((await logs.json()).logs || []);
      if (comm.ok) setCampaigns(await comm.json());
      if (wf.ok) setWorkflows(await wf.json());
      if (keys.ok) setApiKeys(await keys.json());
      if (rl.ok) setRateLimits(await rl.json());
      if (totp.ok) setTotpStatus(await totp.json());
      if (ips.ok) setIpList(await ips.json());
      if (reps.ok) setReports(await reps.json());
      if (notes.ok) setReleaseNotes(await notes.json());
      if (orgRes.ok) {
        const orgList = await orgRes.json();
        setOrgs(Array.isArray(orgList) ? orgList.map((o: { id: number; name: string }) => ({ id: o.id, name: o.name })) : []);
      }
      if (scopesRes.ok) {
        const sc = await scopesRes.json();
        setPartnerScopes(sc.scopes || {});
      }
    } catch {
      toast.error("Error cargando plataforma");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const sendCampaign = async (dryRun: boolean) => {
    const res = await fetch(`${API_URL}/superadmin/platform/communications`, {
      method: "POST",
      headers: authH(true),
      body: JSON.stringify({ ...commForm, dry_run: dryRun }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(dryRun ? `Vista previa: ${data.recipient_count} destinatarios` : `Enviado a ${data.sent_count}`);
      if (!dryRun) loadAll();
    } else toast.error("Error al enviar");
  };

  const runWorkflows = async () => {
    const res = await fetch(`${API_URL}/superadmin/platform/workflows/run`, { method: "POST", headers: authH() });
    if (res.ok) {
      const d = await res.json();
      toast.success(`Workflow: ${d.triggered} tareas creadas (${d.processed} pacientes)`);
      loadAll();
    }
  };

  const createApiKey = async () => {
    if (!keyForm.name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    const res = await fetch(`${API_URL}/superadmin/platform/api-keys`, {
      method: "POST",
      headers: authH(true),
      body: JSON.stringify({
        name: keyForm.name.trim(),
        organization_id: keyForm.organization_id ? +keyForm.organization_id : null,
        scopes: keyForm.scopes,
        rate_limit_rpm: keyForm.rate_limit_rpm,
        is_sandbox: keyForm.is_sandbox,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewKey(data.api_key);
      setKeyDialogOpen(false);
      toast.success("API key creada — cópiala ahora");
      loadAll();
    } else {
      toast.error(data.detail || "Error al crear key");
    }
  };

  const toggleKeyScope = (scope: string, checked: boolean) => {
    setKeyForm((f) => ({
      ...f,
      scopes: checked ? [...new Set([...f.scopes, scope])] : f.scopes.filter((s) => s !== scope),
    }));
  };

  const saveRateLimits = async () => {
    const res = await fetch(`${API_URL}/superadmin/platform/rate-limits`, {
      method: "PUT",
      headers: authH(true),
      body: JSON.stringify(rateLimits),
    });
    if (res.ok) toast.success("Rate limits actualizados");
  };

  const setup2fa = async () => {
    const res = await fetch(`${API_URL}/superadmin/platform/2fa/setup`, { method: "POST", headers: authH() });
    if (res.ok) setTotpSetup(await res.json());
    else toast.error("Error configurando 2FA (¿pyotp instalado?)");
  };

  const confirm2fa = async () => {
    const res = await fetch(`${API_URL}/superadmin/platform/2fa/confirm`, {
      method: "POST",
      headers: authH(true),
      body: JSON.stringify({ code: totpCode }),
    });
    if (res.ok) {
      toast.success("2FA activado");
      setTotpSetup(null);
      loadAll();
    } else toast.error("Código inválido");
  };

  const addIp = async () => {
    const res = await fetch(`${API_URL}/superadmin/platform/ip-allowlist`, {
      method: "POST",
      headers: authH(true),
      body: JSON.stringify(newIp),
    });
    if (res.ok) {
      toast.success("IP añadida");
      setNewIp({ cidr_or_ip: "", label: "" });
      loadAll();
    }
  };

  const createNote = async () => {
    const res = await fetch(`${API_URL}/superadmin/platform/release-notes`, {
      method: "POST",
      headers: authH(true),
      body: JSON.stringify({ ...newNote, is_published: true }),
    });
    if (res.ok) {
      toast.success("Release note publicada");
      setNewNote({ version: "", title: "", body: "", roles: ["all"] });
      loadAll();
    }
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-7 w-7 text-primary" />
              Plataforma transversal
            </h1>
            <p className="text-sm text-muted-foreground">Impersonación, comunicaciones, workflows, seguridad y partners</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        {overview && (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8 text-center">
            {[
              ["Impersonaciones", overview.impersonation_logs_30d],
              ["API keys", overview.api_keys_active],
              ["Campañas", overview.campaigns_sent],
              ["Workflows", overview.workflow_rules_active],
              ["Reportes", overview.scheduled_reports],
              ["Release notes", overview.release_notes],
              ["2FA", overview.totp_superadmins],
              ["IPs", overview.ip_allowlist_entries],
            ].map(([l, v]) => (
              <Card key={String(l)}>
                <CardContent className="pt-3 pb-2">
                  <p className="text-[10px] text-muted-foreground uppercase">{l}</p>
                  <p className="text-xl font-bold">{String(v)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="impersonation">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="impersonation">Impersonación</TabsTrigger>
            <TabsTrigger value="communications">Comunicaciones</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="apikeys">API Partners</TabsTrigger>
            <TabsTrigger value="security">Seguridad</TabsTrigger>
            <TabsTrigger value="reports">Reportes</TabsTrigger>
            <TabsTrigger value="releases">Release notes</TabsTrigger>
          </TabsList>

          <TabsContent value="impersonation">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Auditoría de impersonación</CardTitle>
                <CardDescription>Desde Usuarios o Nutricionistas → &quot;Ver como&quot;. También POST /impersonate/user/{id}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Superadmin</TableHead>
                      <TableHead>Objetivo</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(impLogs as { created_at?: string; impersonator?: string; target?: string; target_role?: string; action?: string; ip_address?: string }[]).map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{l.created_at}</TableCell>
                        <TableCell>{l.impersonator}</TableCell>
                        <TableCell>{l.target}</TableCell>
                        <TableCell><Badge variant="secondary">{l.target_role}</Badge></TableCell>
                        <TableCell>{l.action}</TableCell>
                        <TableCell className="font-mono text-xs">{l.ip_address}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communications">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Comunicaciones masivas</CardTitle></CardHeader>
              <CardContent className="space-y-4 max-w-xl">
                <Input placeholder="Título interno" value={commForm.title} onChange={(e) => setCommForm({ ...commForm, title: e.target.value })} />
                <Input placeholder="Asunto" value={commForm.subject} onChange={(e) => setCommForm({ ...commForm, subject: e.target.value })} />
                <Textarea placeholder="Cuerpo ({nombre} opcional)" rows={4} value={commForm.body} onChange={(e) => setCommForm({ ...commForm, body: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={commForm.cohort_type} onValueChange={(v) => setCommForm({ ...commForm, cohort_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="role">Por rol</SelectItem>
                      <SelectItem value="organization">Por org</SelectItem>
                      <SelectItem value="inactive">Inactivos (días)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="patient | org_id | 30" value={commForm.cohort_value} onChange={(e) => setCommForm({ ...commForm, cohort_value: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => sendCampaign(true)}>Vista previa</Button>
                  <Button onClick={() => sendCampaign(false)}>Enviar</Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Campaña</TableHead><TableHead>Cohorte</TableHead><TableHead>Enviados</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(campaigns as { title?: string; cohort_type?: string; cohort_value?: string; sent_count?: number }[]).slice(0, 10).map((c, i) => (
                      <TableRow key={i}><TableCell>{c.title}</TableCell><TableCell>{c.cohort_type}/{c.cohort_value}</TableCell><TableCell>{c.sent_count}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflows">
            <Card>
              <CardHeader className="flex flex-row justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5" /> Workflows automatizados</CardTitle>
                  <CardDescription>Adherencia &lt; 50% → notificar nutricionista + tarea</CardDescription>
                </div>
                <Button onClick={runWorkflows}>Ejecutar ahora</Button>
              </CardHeader>
              <CardContent>
                {(workflows as { name?: string; description?: string; is_active?: boolean; last_run_at?: string; config?: { threshold_pct?: number } }[]).map((w, i) => (
                  <div key={i} className="flex justify-between items-center py-3 border-b last:border-0">
                    <div>
                      <p className="font-medium">{w.name}</p>
                      <p className="text-sm text-muted-foreground">{w.description}</p>
                      <p className="text-xs text-muted-foreground">Umbral: {w.config?.threshold_pct}% · Última ejecución: {w.last_run_at || "—"}</p>
                    </div>
                    <Badge className={w.is_active ? "bg-emerald-500/15 text-emerald-700 border-0" : ""}>{w.is_active ? "Activo" : "Inactivo"}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apikeys">
            <Card>
              <CardHeader className="flex flex-row justify-between">
                <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> API keys partners (EPS)</CardTitle>
                <Button size="sm" onClick={() => setKeyDialogOpen(true)}>Nueva key</Button>
              </CardHeader>
              <CardContent>
                {newKey && (
                  <div className="mb-4 p-3 bg-amber-500/10 rounded-lg font-mono text-xs break-all">
                    <strong>Copia ahora:</strong> {newKey}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mb-3 space-y-1">
                  <p>Header: <code className="text-xs bg-muted px-1 rounded">X-API-Key</code></p>
                  <p>GET /api/partner/v1/aggregates · /organization · /patients/summary · /adherence · /programs</p>
                </div>
                {keyDialogOpen && (
                  <div className="mb-4 p-4 border rounded-lg space-y-3 bg-muted/20">
                    <div><Label>Nombre</Label><Input value={keyForm.name} onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })} /></div>
                    <div>
                      <Label>Organización (opcional)</Label>
                      <Select value={keyForm.organization_id || "none"} onValueChange={(v) => setKeyForm({ ...keyForm, organization_id: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Todas / global" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin binding</SelectItem>
                          {orgs.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(partnerScopes).map(([scope, label]) => (
                        <label key={scope} className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={keyForm.scopes.includes(scope)} onChange={(e) => toggleKeyScope(scope, e.target.checked)} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-2"><Switch checked={keyForm.is_sandbox} onCheckedChange={(v) => setKeyForm({ ...keyForm, is_sandbox: v })} /><Label>Key sandbox</Label></div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setKeyDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={createApiKey}>Crear</Button>
                    </div>
                  </div>
                )}
                <Table>
                  <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Prefijo</TableHead><TableHead>Org</TableHead><TableHead>Sandbox</TableHead><TableHead>RPM</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(apiKeys as { name?: string; key_prefix?: string; organization_name?: string; rate_limit_rpm?: number; is_sandbox?: boolean }[]).map((k, i) => (
                      <TableRow key={i}><TableCell>{k.name}</TableCell><TableCell className="font-mono">{k.key_prefix}…</TableCell><TableCell>{k.organization_name || "—"}</TableCell><TableCell>{k.is_sandbox ? <Badge variant="secondary">Sandbox</Badge> : "—"}</TableCell><TableCell>{k.rate_limit_rpm}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5" /> Rate limiting por tenant</CardTitle></CardHeader>
              <CardContent className="grid gap-3 max-w-md">
                <div className="flex items-center gap-2"><Switch checked={rateLimits.enabled} onCheckedChange={(v) => setRateLimits({ ...rateLimits, enabled: v })} /><Label>Activo</Label></div>
                <div><Label>API general (req/min)</Label><Input type="number" value={rateLimits.default_rpm} onChange={(e) => setRateLimits({ ...rateLimits, default_rpm: +e.target.value })} /></div>
                <div><Label>Uploads (req/min)</Label><Input type="number" value={rateLimits.upload_rpm} onChange={(e) => setRateLimits({ ...rateLimits, upload_rpm: +e.target.value })} /></div>
                <div><Label>Partner API (req/min)</Label><Input type="number" value={rateLimits.partner_rpm} onChange={(e) => setRateLimits({ ...rateLimits, partner_rpm: +e.target.value })} /></div>
                <Button onClick={saveRateLimits}>Guardar</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>2FA TOTP superadmin {totpStatus.enabled && <Badge className="ml-2">Activo</Badge>}</CardTitle></CardHeader>
              <CardContent className="space-y-3 max-w-md">
                {!totpStatus.enabled && !totpSetup && <Button onClick={setup2fa}>Configurar 2FA</Button>}
                {totpSetup && (
                  <>
                    <p className="text-xs font-mono break-all">{totpSetup.otpauth_uri}</p>
                    <p className="text-xs">Backup codes: {(totpSetup.backup_codes || []).join(", ")}</p>
                    <Input placeholder="Código 6 dígitos" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} />
                    <Button onClick={confirm2fa}>Confirmar activación</Button>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>IP allowlist superadmin</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 max-w-lg">
                  <Input placeholder="IP o CIDR" value={newIp.cidr_or_ip} onChange={(e) => setNewIp({ ...newIp, cidr_or_ip: e.target.value })} />
                  <Input placeholder="Etiqueta" value={newIp.label} onChange={(e) => setNewIp({ ...newIp, label: e.target.value })} />
                  <Button onClick={addIp}>Añadir</Button>
                </div>
                <ul className="text-sm space-y-1">
                  {(ipList as { cidr_or_ip?: string; label?: string }[]).map((ip, i) => (
                    <li key={i} className="font-mono">{ip.cidr_or_ip} — {ip.label}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Lista vacía = permitir todas las IPs</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader><CardTitle>Reportes programados EPS</CardTitle></CardHeader>
              <CardContent>
                {(reports as { id?: number; name?: string; recipient_emails?: string[]; last_sent_at?: string }[]).map((r, i) => (
                  <div key={i} className="flex justify-between py-2 border-b">
                    <span>{r.name} → {(r.recipient_emails || []).join(", ")}</span>
                    <Button size="sm" variant="outline" onClick={async () => {
                      await fetch(`${API_URL}/superadmin/platform/scheduled-reports/${r.id}/run`, { method: "POST", headers: authH() });
                      toast.success("Reporte enviado");
                    }}>Enviar ahora</Button>
                  </div>
                ))}
                {!reports.length && <p className="text-muted-foreground text-sm">Crea reportes vía API POST /scheduled-reports</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="releases">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Release notes</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 max-w-lg">
                  <Input placeholder="Versión 2.1.0" value={newNote.version} onChange={(e) => setNewNote({ ...newNote, version: e.target.value })} />
                  <Input placeholder="Título" value={newNote.title} onChange={(e) => setNewNote({ ...newNote, title: e.target.value })} />
                  <Textarea placeholder="Changelog..." value={newNote.body} onChange={(e) => setNewNote({ ...newNote, body: e.target.value })} />
                  <Button onClick={createNote}>Publicar</Button>
                </div>
                {(releaseNotes as { version?: string; title?: string; published_at?: string }[]).map((n, i) => (
                  <div key={i} className="border-t pt-2"><Badge>{n.version}</Badge> <strong>{n.title}</strong> <span className="text-xs text-muted-foreground">{n.published_at}</span></div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SuperadminLayout>
  );
}
