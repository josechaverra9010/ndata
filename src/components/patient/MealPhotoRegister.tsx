import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/config/api";
import { todayInColombiaISO } from "@/lib/timezone";
import { useToast } from "@/components/ui/use-toast";

export type MealPhotoAnalysis = {
  description?: string;
  foods: Array<{
    name: string;
    portion_size: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    confidence?: number;
  }>;
  totals: { calories: number; protein: number; carbs: number; fat: number };
  notes?: string;
};

type Props = {
  patientId: string | number;
  mealType: string;
  onSuccess?: (payload: {
    analysis: MealPhotoAnalysis;
    foods_added: boolean;
  }) => void;
  compact?: boolean;
};

export function MealPhotoRegister({ patientId, mealType, onSuccess, compact }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const analyze = async (file: File) => {
    setUploading(true);
    try {
      const token = localStorage.getItem("userToken");
      const form = new FormData();
      form.append("file", file);
      form.append("meal_type", mealType);
      form.append("photo_date", todayInColombiaISO());
      form.append("add_to_meal", "true");
      form.append("save_photo", "true");

      const res = await fetch(`${API_URL}/patient/${patientId}/meals/analyze-photo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "No se pudo analizar la foto. Verifica que el servicio de IA esté configurado."
        );
      }

      const analysis = data.analysis as MealPhotoAnalysis;
      toast({
        title: "Consumo registrado",
        description: data.added_to_meal
          ? `~${analysis?.totals?.calories ?? 0} kcal estimadas y añadidas a tu registro.`
          : "Foto analizada. Revisa los alimentos detectados.",
      });
      onSuccess?.({ analysis, foods_added: Boolean(data.added_to_meal) });
    } catch (e: unknown) {
      toast({
        title: "Error al registrar foto",
        description: e instanceof Error ? e.message : "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={compact ? "inline-flex" : "flex flex-wrap gap-2"}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) analyze(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant={compact ? "outline" : "default"}
        size={compact ? "sm" : "default"}
        className="gap-2"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : compact ? (
          <Camera className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {uploading ? "Analizando…" : compact ? "Foto" : "Registrar con foto (IA)"}
      </Button>
      {!compact && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
          Galería
        </Button>
      )}
    </div>
  );
}
