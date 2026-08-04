import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { todayInColombiaISO } from "@/lib/timezone";

interface PhotoItem {
  id: number;
  date: string;
  meal_type?: string;
  photo_url: string;
  caption?: string;
  created_at?: string;
}

const MEAL_TYPES = [
  { value: "breakfast", label: "Desayuno" },
  { value: "lunch", label: "Almuerzo" },
  { value: "dinner", label: "Cena" },
  { value: "morning_snack", label: "Snack AM" },
  { value: "afternoon_snack", label: "Snack PM" },
  { value: "other", label: "Otra" },
];

const API_ORIGIN = () => API_URL.replace(/\/api\/?$/, "");

export default function PatientFoodDiary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [mealType, setMealType] = useState("lunch");
  const [caption, setCaption] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const patientId = user?.id;

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patient/${patientId}/meal-photos?days=30`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPhotos(Array.isArray(data.photos) ? data.photos : []);
    } catch {
      toast({ title: "Error", description: "No se pudo cargar el diario", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [patientId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File) => {
    if (!patientId) return;
    setUploading(true);
    try {
      const token = localStorage.getItem("userToken");
      const form = new FormData();
      form.append("file", file);
      form.append("meal_type", mealType);
      form.append("caption", caption);
      form.append("photo_date", todayInColombiaISO());
      const res = await fetch(`${API_URL}/patient/${patientId}/meal-photos/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error();
      toast({ title: "Foto guardada", description: "Añadida a tu diario alimentario" });
      setCaption("");
      load();
    } catch {
      toast({ title: "Error", description: "No se pudo subir la foto", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: number) => {
    if (!patientId || !confirm("¿Eliminar esta foto?")) return;
    const token = localStorage.getItem("userToken");
    await fetch(`${API_URL}/patient/${patientId}/meal-photos/${id}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    load();
  };

  const grouped = photos.reduce<Record<string, PhotoItem[]>>((acc, p) => {
    acc[p.date] = acc[p.date] || [];
    acc[p.date].push(p);
    return acc;
  }, {});

  return (
    <PatientLayout>
      <LoadingGate loading={loading}>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Camera className="h-7 w-7 text-primary" />
              Diario Fotográfico
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Documenta visualmente tus comidas para compartir con tu nutricionista
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Subir foto de comida
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de comida</Label>
                  <Select value={mealType} onValueChange={setMealType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEAL_TYPES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nota (opcional)</Label>
                  <Input placeholder="Ej. Porción casera sin sal" value={caption} onChange={(e) => setCaption(e.target.value)} />
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
              <Button className="gap-2 rounded-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                Tomar o elegir foto
              </Button>
            </CardContent>
          </Card>

          {Object.keys(grouped).length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground">
                <Camera className="h-12 w-12 mx-auto mb-4 opacity-30" />
                Aún no tienes fotos. ¡Empieza documentando tu próxima comida!
              </CardContent>
            </Card>
          ) : (
            Object.entries(grouped)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, items]) => (
                <div key={date} className="space-y-3">
                  <h2 className="font-semibold text-sm text-muted-foreground">{date}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {items.map((p) => (
                      <div key={p.id} className="group relative rounded-xl overflow-hidden border aspect-square">
                        <img
                          src={p.photo_url.startsWith("/") ? `${API_ORIGIN()}${p.photo_url}` : p.photo_url}
                          alt={p.caption || "Comida"}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <p className="text-[10px] text-white font-medium capitalize">
                            {MEAL_TYPES.find((m) => m.value === p.meal_type)?.label || p.meal_type || "Comida"}
                          </p>
                          {p.caption && <p className="text-[9px] text-white/80 line-clamp-1">{p.caption}</p>}
                        </div>
                        <button
                          type="button"
                          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          onClick={() => remove(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      </LoadingGate>
    </PatientLayout>
  );
}
