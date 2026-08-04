import { useEffect, useState } from "react";
import { API_URL } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Star } from "lucide-react";

interface PendingAppt {
  appointment_id: number;
  date: string;
  time: string;
  type: string;
}

export function NpsSurveyPrompt() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingAppt | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) return;
    fetch(`${API_URL}/analytics/nps/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { pending: [] }))
      .then((data) => {
        if (data.pending?.length) {
          setPending(data.pending[0]);
          setOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  const submit = async () => {
    if (score === null || !pending) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/analytics/nps`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score,
          comment: comment.trim() || undefined,
          appointment_id: pending.appointment_id,
          context: "post_consultation",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error al enviar");
      }
      toast.success("¡Gracias por tu opinión!");
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la encuesta");
    } finally {
      setSubmitting(false);
    }
  };

  if (!pending) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            ¿Cómo fue tu consulta?
          </DialogTitle>
          <DialogDescription>
            Cita del {pending.date} — Tu feedback nos ayuda a mejorar NutriData.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm text-muted-foreground mb-3">
            Del 0 al 10, ¿qué tan probable es que recomiendes NutriData?
          </p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setScore(i)}
                className={`h-9 w-9 rounded-lg text-sm font-semibold transition-colors ${
                  score === i
                    ? i >= 9
                      ? "bg-emerald-500 text-white"
                      : i >= 7
                        ? "bg-amber-400 text-white"
                        : "bg-red-500 text-white"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
            <span>Nada probable</span>
            <span>Muy probable</span>
          </div>
        </div>

        <Textarea
          placeholder="Comentario opcional..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="resize-none"
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Después
          </Button>
          <Button onClick={submit} disabled={score === null || submitting}>
            {submitting ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
