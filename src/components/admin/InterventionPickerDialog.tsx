import { useEffect, useState } from "react";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Loader2, Search } from "lucide-react";

interface Intervention {
  id: number;
  title: string;
  category_label: string;
  content_type_label: string;
  body: string;
  condition_tags: string[];
}

interface InterventionPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId?: number;
  patientName?: string;
  onSelect: (text: string, title: string) => void;
}

export function InterventionPickerDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  onSelect,
}: InterventionPickerDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Intervention[]>([]);
  const [search, setSearch] = useState("");
  const [applyingId, setApplyingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem("userToken");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    setLoading(true);
    fetch(`${API_URL}/nutritionist/interventions`, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error("Error al cargar plantillas");
        return res.json();
      })
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((e) => {
        toast({
          title: "Error",
          description: e?.message || "No se pudieron cargar las intervenciones",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [open, toast]);

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.body.toLowerCase().includes(q) ||
      item.category_label.toLowerCase().includes(q)
    );
  });

  const apply = async (item: Intervention) => {
    setApplyingId(item.id);
    try {
      const token = localStorage.getItem("userToken");
      const endpoint = patientId
        ? `${API_URL}/nutritionist/interventions/${item.id}/deliver`
        : `${API_URL}/nutritionist/interventions/${item.id}/apply`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          patient_id: patientId,
          patient_name: patientName,
        }),
      });
      if (!res.ok) throw new Error("No se pudo aplicar la plantilla");
      const data = await res.json();
      onSelect(data.text, data.title);
      onOpenChange(false);
      toast({
        title: patientId ? "Enviada al paciente" : "Plantilla insertada",
        description: data.title,
      });
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Error al aplicar",
        variant: "destructive",
      });
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Insertar intervención
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar plantilla…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[360px] pr-3">
            <div className="space-y-2">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border/70 p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-sm">{item.title}</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={applyingId === item.id}
                      onClick={() => apply(item)}
                    >
                      {applyingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Usar"
                      )}
                    </Button>
                  </div>
                  <div className="flex gap-1 mb-2">
                    <Badge variant="outline" className="text-[10px]">{item.category_label}</Badge>
                    <Badge variant="outline" className="text-[10px]">{item.content_type_label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{item.body}</p>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Sin resultados</p>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
