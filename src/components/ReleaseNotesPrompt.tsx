import { useEffect, useState } from "react";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const SEEN_KEY = "nd_release_notes_seen";

interface ReleaseNote {
  id: number;
  version: string;
  title: string;
  body: string;
  published_at?: string;
}

export function ReleaseNotesPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<ReleaseNote[]>([]);

  useEffect(() => {
    if (!user?.role) return;
    const role = user.role === "admin" ? "admin" : user.role;
    fetch(`${API_URL}/release-notes?role=${role}`)
      .then((r) => (r.ok ? r.json() : { notes: [] }))
      .then((data) => {
        const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as number[];
        const unread = (data.notes || []).filter((n: ReleaseNote) => !seen.includes(n.id));
        if (unread.length) {
          setNotes(unread);
          setOpen(true);
        }
      })
      .catch(() => {});
  }, [user?.role]);

  const dismiss = () => {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as number[];
    const ids = new Set([...seen, ...notes.map((n) => n.id)]);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
    setOpen(false);
  };

  if (!notes.length) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Novedades NutriData
          </DialogTitle>
          <DialogDescription>Changelog para tu rol</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {notes.map((n) => (
            <div key={n.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">v{n.version}</Badge>
                <span className="font-semibold text-sm">{n.title}</span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
        </div>
        <Button className="w-full" onClick={dismiss}>Entendido</Button>
      </DialogContent>
    </Dialog>
  );
}
