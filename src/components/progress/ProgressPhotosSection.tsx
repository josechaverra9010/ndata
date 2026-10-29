import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Camera,
  GitCompare,
  Loader2,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { todayInColombiaISO, formatInColombia } from "@/lib/timezone";

export interface ProgressPhoto {
  id: number;
  patient_id: number;
  metric_id?: number | null;
  date: string;
  angle: string;
  angle_label?: string;
  photo_url: string;
  caption?: string | null;
  created_at?: string;
  metric?: {
    id: number;
    date: string;
    weight?: number;
    body_fat?: number;
    waist?: number;
    hip?: number;
    notes?: string | null;
  } | null;
}

const API_ORIGIN = () => API_URL.replace(/\/api\/?$/, "");

function photoSrc(url: string) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_ORIGIN()}${url}`;
  return url;
}

function authHeaders() {
  const token = localStorage.getItem("userToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ANGLES = [
  { value: "front", label: "Frente" },
  { value: "side", label: "Perfil" },
  { value: "back", label: "Espalda" },
  { value: "other", label: "Otra" },
];

interface Props {
  patientId: number;
  /** Si true, muestra título pensado para panel admin */
  adminMode?: boolean;
  className?: string;
}

export function ProgressPhotosSection({ patientId, adminMode, className }: Props) {
  const canManage = !!adminMode; // solo nutricionista toma/elimina fotos
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [angle, setAngle] = useState("front");
  const [photoDate, setPhotoDate] = useState(todayInColombiaISO());
  const [caption, setCaption] = useState("");
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [compare, setCompare] = useState<{
    left: ProgressPhoto;
    right: ProgressPhoto;
    summary: { weight_delta?: number | null; same_angle?: boolean };
  } | null>(null);
  const [comparing, setComparing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/patient/${patientId}/progress-photos`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("No se pudieron cargar las fotos");
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar fotos");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (patientId) load();
  }, [patientId, load]);

  const sortedForSelect = useMemo(
    () =>
      [...photos].sort((a, b) =>
        `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`)
      ),
    [photos]
  );

  const onUpload = async (file: File | null) => {
    if (!file || !canManage) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("angle", angle);
      fd.append("photo_date", photoDate);
      if (caption.trim()) fd.append("caption", caption.trim());
      const res = await fetch(`${API_URL}/patient/${patientId}/progress-photos/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "No se pudo subir la foto"
        );
      }
      toast.success("Foto de progreso guardada");
      setCaption("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDelete = async (id: number) => {
    if (!canManage) return;
    try {
      const res = await fetch(`${API_URL}/patient/${patientId}/progress-photos/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("No se pudo eliminar");
      toast.success("Foto eliminada");
      if (String(id) === leftId) setLeftId("");
      if (String(id) === rightId) setRightId("");
      setCompare(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const runCompare = async () => {
    if (!leftId || !rightId || leftId === rightId) {
      toast.message("Elige dos fotos distintas para comparar");
      return;
    }
    setComparing(true);
    try {
      const res = await fetch(
        `${API_URL}/patient/${patientId}/progress-photos/compare?left_id=${leftId}&right_id=${rightId}`,
        { headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "No se pudo comparar"
        );
      }
      setCompare(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al comparar");
    } finally {
      setComparing(false);
    }
  };

  return (
    <Card className={className || "rounded-2xl border-border/80 shadow-sm"}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          Fotos de progreso
        </CardTitle>
        <CardDescription>
          {canManage
            ? "Toma la foto al paciente en consulta (frente, perfil o espalda) y compara resultados en el tiempo."
            : "Fotos tomadas por tu nutricionista. Puedes verlas y comparar antes / después."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Upload — solo nutricionista */}
        {canManage && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input type="date" value={photoDate} onChange={(e) => setPhotoDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Ángulo</Label>
                <Select value={angle} onValueChange={setAngle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANGLES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nota (opcional)</Label>
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={1}
                  placeholder="Ej: misma ropa, misma iluminación, consulta de control…"
                  className="resize-none min-h-[40px]"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onUpload(e.target.files?.[0] || null)}
              />
              <Button
                type="button"
                className="rounded-full gap-2"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {uploading ? "Guardando…" : "Tomar / subir foto del paciente"}
              </Button>
            </div>
          </>
        )}

        {/* Gallery */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : photos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border rounded-xl border-dashed">
            {canManage
              ? "Aún no hay fotos. Toma la primera foto al paciente para empezar a comparar."
              : "Tu nutricionista aún no ha registrado fotos de progreso."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p) => (
              <div
                key={p.id}
                className="group relative overflow-hidden rounded-xl border bg-muted/30 aspect-[3/4]"
              >
                <img
                  src={photoSrc(p.photo_url)}
                  alt={p.caption || p.angle_label || "Progreso"}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white">
                  <p className="text-[11px] font-medium">
                    {formatInColombia(p.date) || p.date}
                  </p>
                  <Badge variant="secondary" className="mt-0.5 text-[10px] h-5">
                    {p.angle_label || p.angle}
                  </Badge>
                </div>
                {canManage && (
                  <button
                    type="button"
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 transition"
                    onClick={() => onDelete(p.id)}
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Compare */}
        {photos.length >= 2 && (
          <div className="rounded-xl border p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-medium flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-primary" />
              Comparar antes / después
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Foto A (antes)</Label>
                <Select value={leftId} onValueChange={setLeftId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedForSelect.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {formatInColombia(p.date) || p.date} · {p.angle_label || p.angle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Foto B (después)</Label>
                <Select value={rightId} onValueChange={setRightId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedForSelect.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {formatInColombia(p.date) || p.date} · {p.angle_label || p.angle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="rounded-full gap-2"
              disabled={comparing || !leftId || !rightId}
              onClick={runCompare}
            >
              {comparing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitCompare className="h-4 w-4" />
              )}
              Comparar
            </Button>

            {compare && (
              <div className="space-y-3 pt-2">
                {compare.summary.weight_delta != null && (
                  <p className="text-sm">
                    Δ peso:{" "}
                    <span
                      className={
                        compare.summary.weight_delta < 0
                          ? "text-emerald-600 font-semibold"
                          : compare.summary.weight_delta > 0
                            ? "text-amber-600 font-semibold"
                            : "font-semibold"
                      }
                    >
                      {compare.summary.weight_delta > 0 ? "+" : ""}
                      {compare.summary.weight_delta} kg
                    </span>
                    {!compare.summary.same_angle && (
                      <span className="text-muted-foreground text-xs ml-2">
                        (ángulos distintos — la comparación visual puede variar)
                      </span>
                    )}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Antes</p>
                    <div className="rounded-xl overflow-hidden border aspect-[3/4] bg-muted">
                      <img
                        src={photoSrc(compare.left.photo_url)}
                        alt="Antes"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="text-xs">
                      {formatInColombia(compare.left.date) || compare.left.date} ·{" "}
                      {compare.left.angle_label}
                      {compare.left.metric?.weight != null
                        ? ` · ${compare.left.metric.weight} kg`
                        : ""}
                    </p>
                  </div>
                  <ArrowRight className="hidden sm:block h-5 w-5 text-muted-foreground mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Después</p>
                    <div className="rounded-xl overflow-hidden border aspect-[3/4] bg-muted">
                      <img
                        src={photoSrc(compare.right.photo_url)}
                        alt="Después"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="text-xs">
                      {formatInColombia(compare.right.date) || compare.right.date} ·{" "}
                      {compare.right.angle_label}
                      {compare.right.metric?.weight != null
                        ? ` · ${compare.right.metric.weight} kg`
                        : ""}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
