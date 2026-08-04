import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/config/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface PrepItem {
  key: string;
  label: string;
  done: boolean;
}

interface AppointmentPrepPanelProps {
  patientId: number;
  appointmentId: number;
}

export function AppointmentPrepPanel({ patientId, appointmentId }: AppointmentPrepPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<PrepItem[]>([]);
  const [notes, setNotes] = useState("");
  const [progressPct, setProgressPct] = useState(0);

  const headers = () => {
    const token = localStorage.getItem("userToken");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/patient/${patientId}/appointments/${appointmentId}/prep`,
        { headers: headers() },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setNotes(data.notes || "");
      setProgressPct(Number(data.progress_pct ?? 0));
    } catch {
      /* silent — optional panel */
    } finally {
      setLoading(false);
    }
  }, [patientId, appointmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (nextItems: PrepItem[], nextNotes?: string) => {
    setSaving(true);
    try {
      const res = await fetch(
        `${API_URL}/patient/${patientId}/appointments/${appointmentId}/prep`,
        {
          method: "PUT",
          headers: headers(),
          body: JSON.stringify({
            items: nextItems,
            notes: nextNotes ?? notes,
          }),
        },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProgressPct(Number(data.progress_pct ?? 0));
    } catch {
      toast({ title: "Error", description: "No se pudo guardar el checklist", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: string) => {
    const next = items.map((i) => (i.key === key ? { ...i, done: !i.done } : i));
    setItems(next);
    save(next);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cargando preparación…
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold flex items-center gap-1.5 text-primary">
          <ClipboardCheck className="h-3.5 w-3.5" />
          Preparación pre-consulta
        </span>
        <span className="text-[10px] text-muted-foreground">{progressPct}%</span>
      </div>
      <Progress value={progressPct} className="h-1.5" />
      <div className="space-y-2">
        {items.map((item) => (
          <label key={item.key} className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              checked={item.done}
              onCheckedChange={() => toggle(item.key)}
              disabled={saving}
              className="mt-0.5"
            />
            <span className={`text-xs leading-snug ${item.done ? "line-through text-muted-foreground" : ""}`}>
              {item.label}
            </span>
          </label>
        ))}
      </div>
      <Textarea
        placeholder="Notas o preguntas para tu nutricionista (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="text-xs min-h-[60px] resize-none"
        rows={2}
      />
      <Button
        size="sm"
        variant="secondary"
        className="text-xs h-7"
        disabled={saving}
        onClick={() => save(items, notes)}
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar notas"}
      </Button>
    </div>
  );
}
