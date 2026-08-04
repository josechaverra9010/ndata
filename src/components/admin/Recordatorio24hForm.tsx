import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { API_URL } from "@/config/api";
import { todayInColombiaISO } from "@/lib/timezone";

export const RECALL_MEAL_TIMES = [
  { id: "desayuno", label: "DESAYUNO", time: "7:00am - 9:30am", rows: 4 },
  { id: "media_manana", label: "SNACK #1", time: "10:00am - 11:00am", rows: 3 },
  { id: "almuerzo", label: "ALMUERZO", time: "12:00pm - 1:30pm", rows: 6 },
  { id: "media_tarde", label: "SNACK #2", time: "4:00pm - 5:00pm", rows: 3 },
  { id: "cena", label: "CENA", time: "7:00pm - 8:00pm", rows: 6 },
] as const;

type MealRow = { prep: string; ingredients: string; qty: string };
type MealId = (typeof RECALL_MEAL_TIMES)[number]["id"];

export type RecallFormState = {
  desayuno: MealRow[];
  media_manana: MealRow[];
  almuerzo: MealRow[];
  media_tarde: MealRow[];
  cena: MealRow[];
  observaciones: string;
  date: string;
};

const createEmptyRow = (): MealRow => ({ prep: "", ingredients: "", qty: "" });
const createEmptySection = (rowCount: number) =>
  Array(rowCount)
    .fill(null)
    .map(() => createEmptyRow());

export function emptyRecallState(): RecallFormState {
  return {
    desayuno: createEmptySection(4),
    media_manana: createEmptySection(3),
    almuerzo: createEmptySection(6),
    media_tarde: createEmptySection(3),
    cena: createEmptySection(6),
    observaciones: "",
    date: todayInColombiaISO(),
  };
}

export function buildRecallApiPayload(formData: RecallFormState) {
  return {
    ...formData,
    desayuno: JSON.stringify(formData.desayuno),
    media_manana: JSON.stringify(formData.media_manana),
    almuerzo: JSON.stringify(formData.almuerzo),
    media_tarde: JSON.stringify(formData.media_tarde),
    cena: JSON.stringify(formData.cena),
    snack_nocturno: JSON.stringify([]),
  };
}

export function recallHasContent(formData: RecallFormState | null | undefined): boolean {
  if (!formData) return false;
  if ((formData.observaciones || "").trim()) return true;
  for (const meal of RECALL_MEAL_TIMES) {
    const rows = formData[meal.id] || [];
    if (rows.some((r) => (r.prep || r.ingredients || r.qty || "").trim())) return true;
  }
  return false;
}

/** Parsea un campo de comida guardado (JSON string o array) a filas del cuadro. */
export function parseMealSection(raw: any, rowCount: number): MealRow[] {
  const empty = createEmptySection(rowCount);
  if (!raw) return empty;
  let parsed: any = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return empty;
    if (t.startsWith("[")) {
      try {
        parsed = JSON.parse(t);
      } catch {
        empty[0] = { prep: t, ingredients: "", qty: "" };
        return empty;
      }
    } else {
      empty[0] = { prep: t, ingredients: "", qty: "" };
      return empty;
    }
  }
  if (!Array.isArray(parsed)) return empty;
  return empty.map((row, i) => {
    const src = parsed[i] || {};
    return {
      prep: String(src.prep || ""),
      ingredients: String(src.ingredients || ""),
      qty: String(src.qty || src.measure || ""),
    };
  });
}

export function recallToFormState(recall: any): RecallFormState {
  const base = emptyRecallState();
  if (!recall) return base;
  return {
    desayuno: parseMealSection(recall.desayuno, 4),
    media_manana: parseMealSection(recall.media_manana, 3),
    almuerzo: parseMealSection(recall.almuerzo, 6),
    media_tarde: parseMealSection(recall.media_tarde, 3),
    cena: parseMealSection(recall.cena, 6),
    observaciones: String(recall.observaciones || ""),
    date: recall.date
      ? String(recall.date).slice(0, 10)
      : todayInColombiaISO(),
  };
}

/** Resumen legible para historia clínica / PDF. */
export function buildRecallSummary(data: RecallFormState): string {
  const lines: string[] = [];
  if (data.date) lines.push(`Fecha: ${data.date}`);
  for (const meal of RECALL_MEAL_TIMES) {
    const rows = data[meal.id as MealId] || [];
    const filled = rows.filter((r) => r.prep || r.ingredients || r.qty);
    if (!filled.length) continue;
    lines.push(`${meal.label}:`);
    for (const r of filled) {
      const parts = [r.prep, r.ingredients, r.qty ? `${r.qty} g` : ""]
        .filter(Boolean)
        .join(" · ");
      if (parts) lines.push(`  - ${parts}`);
    }
  }
  if (data.observaciones?.trim()) {
    lines.push(`Observaciones: ${data.observaciones.trim()}`);
  }
  return lines.join("\n");
}

interface Recordatorio24hFormProps {
  /** Si no hay id (paciente nuevo), el formulario solo edita en memoria */
  patientId?: number | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  /** Prefill desde un recordatorio existente */
  initialRecall?: any | null;
  /** Embebido en historia clínica u otro formulario */
  embedded?: boolean;
  /** Callback con el resumen textual (para PDF / historia) */
  onSummaryChange?: (summary: string) => void;
  /** Notifica el estado completo del formulario (creación de paciente, etc.) */
  onFormDataChange?: (data: RecallFormState) => void;
  /** Oculta botones Guardar/Cancelar (solo edición en vivo) */
  hideActions?: boolean;
  /** Solo lectura (historia clínica) */
  readOnly?: boolean;
}

export function Recordatorio24hForm({
  patientId,
  onSuccess,
  onCancel,
  initialRecall,
  embedded = false,
  onSummaryChange,
  onFormDataChange,
  hideActions = false,
  readOnly = false,
}: Recordatorio24hFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<RecallFormState>(() =>
    recallToFormState(initialRecall)
  );

  useEffect(() => {
    if (initialRecall) {
      setFormData(recallToFormState(initialRecall));
    }
  }, [initialRecall]);

  useEffect(() => {
    onSummaryChange?.(buildRecallSummary(formData));
    onFormDataChange?.(formData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      toast({
        title: "Paciente sin guardar",
        description: "Guarda el paciente primero; el recordatorio se almacenará con la ficha.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);

    const payload = buildRecallApiPayload(formData);

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${patientId}/recalls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Error al guardar el recordatorio");

      toast({
        title: "Éxito",
        description: "Recordatorio de 24 horas guardado correctamente",
      });
      onSummaryChange?.(buildRecallSummary(formData));
      onSuccess?.();
    } catch (error) {
      console.error("Error saving recall:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el recordatorio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCellChange = (
    mealId: string,
    rowIndex: number,
    field: keyof MealRow,
    value: string
  ) => {
    setFormData((prev) => {
      const newMealData = [...(prev as any)[mealId]];
      newMealData[rowIndex] = { ...newMealData[rowIndex], [field]: value };
      return { ...prev, [mealId]: newMealData };
    });
  };

  const handleChange = (field: keyof RecallFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const table = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="recall-date">Fecha del Recordatorio</Label>
          <input
            id="recall-date"
            type="date"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={formData.date}
            onChange={(e) => handleChange("date", e.target.value)}
            required
            disabled={readOnly}
            readOnly={readOnly}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Detalle de Ingesta (24 Horas)</Label>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="p-2 border-r text-center font-bold w-[120px]">
                  TIEMPO DE COMIDA/HORA
                </th>
                <th className="p-2 border-r text-center font-bold">PREPARACIÓN</th>
                <th className="p-2 border-r text-center font-bold">INGREDIENTES</th>
                <th className="p-2 text-center font-bold w-[100px]">CANTIDAD (g)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {RECALL_MEAL_TIMES.map((meal) => (
                <Fragment key={meal.id}>
                  {Array(meal.rows)
                    .fill(null)
                    .map((_, i) => (
                      <tr key={`${meal.id}-${i}`}>
                        {i === 0 && (
                          <td
                            rowSpan={meal.rows}
                            className="p-2 border-r bg-muted/10 text-center font-bold"
                          >
                            <div className="uppercase tracking-wider">{meal.label}</div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {meal.time}
                            </div>
                          </td>
                        )}
                        <td className="p-0 border-r h-8">
                          <input
                            className="w-full h-full px-2 border-0 bg-transparent focus:ring-1 focus:ring-primary outline-none disabled:cursor-not-allowed"
                            value={(formData as any)[meal.id][i].prep}
                            onChange={(e) =>
                              handleCellChange(meal.id, i, "prep", e.target.value)
                            }
                            disabled={readOnly}
                            readOnly={readOnly}
                          />
                        </td>
                        <td className="p-0 border-r h-8">
                          <input
                            className="w-full h-full px-2 border-0 bg-transparent focus:ring-1 focus:ring-primary outline-none disabled:cursor-not-allowed"
                            value={(formData as any)[meal.id][i].ingredients}
                            onChange={(e) =>
                              handleCellChange(meal.id, i, "ingredients", e.target.value)
                            }
                            disabled={readOnly}
                            readOnly={readOnly}
                          />
                        </td>
                        <td className="p-0 h-8 text-center">
                          <input
                            className="w-full h-full px-1 border-0 bg-transparent text-center focus:ring-1 focus:ring-primary outline-none disabled:cursor-not-allowed"
                            value={(formData as any)[meal.id][i].qty}
                            onChange={(e) =>
                              handleCellChange(meal.id, i, "qty", e.target.value)
                            }
                            disabled={readOnly}
                            readOnly={readOnly}
                          />
                        </td>
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observaciones-recall">Observaciones Adicionales</Label>
        <Textarea
          id="observaciones-recall"
          value={formData.observaciones}
          onChange={(e) => handleChange("observaciones", e.target.value)}
          rows={3}
          disabled={readOnly}
          readOnly={readOnly}
        />
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Recordatorio de 24 horas</h4>
            {!patientId && (
              <p className="text-xs text-muted-foreground">
                Al crear el paciente, este recordatorio se guardará automáticamente con la ficha.
              </p>
            )}
          </div>
          {!hideActions && !readOnly && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading || !patientId}
              onClick={(e) => handleSubmit(e as any)}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              Guardar en ficha
            </Button>
          )}
        </div>
        {table}
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg">Nuevo Recordatorio de 24 Horas</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          {table}
          {!hideActions && (
            <div className="flex justify-end gap-3 pt-4">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={loading} className="gradient-primary">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Recordatorio
                  </>
                )}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
