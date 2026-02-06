import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { List, Utensils, Loader2 } from "lucide-react";

export interface MealDetail {
  meal?: string;
  food?: string;
  receta?: string;
  name?: string;
  description?: string;
  calories?: number;
  calorias?: number;
  ingredients?: (string | { name?: string; portion?: string; grams?: string; cantidad?: string; amount?: string; quantity?: string })[];
  instructions?: string[];
  image?: string;
}

interface MealDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealDetail | null;
  /** Si se pasa, se usa para construir la URL de la imagen (ej. path relativo -> URL completa) */
  getImageUrl?: (imagePath: string | undefined) => string;
  loading?: boolean;
}

function normalizeList<T>(val: unknown, stringKeys?: string[]): T[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return [];
    if (trimmed.includes("\n")) return trimmed.split("\n").map((s) => s.trim()).filter(Boolean) as T[];
    if (trimmed.includes(",")) return trimmed.split(",").map((s) => s.trim()).filter(Boolean) as T[];
    return [trimmed] as T[];
  }
  return [];
}

export function MealDetailDialog({
  open,
  onOpenChange,
  meal,
  getImageUrl,
  loading = false,
}: MealDetailDialogProps) {
  const title = meal?.receta ?? meal?.food ?? meal?.name ?? meal?.description ?? "Detalle de comida";
  const kcal = meal?.calories ?? meal?.calorias ?? 0;
  const imgSrc = meal?.image
    ? (getImageUrl ? getImageUrl(meal.image) : meal.image)
    : "";
  const ingredients = Array.isArray(meal?.ingredients)
    ? meal.ingredients
    : normalizeList((meal as Record<string, unknown>)?.ingredients ?? (meal as Record<string, unknown>)?.ingredientes);
  const instructions = Array.isArray(meal?.instructions)
    ? meal.instructions
    : normalizeList<string>((meal as Record<string, unknown>)?.instructions ?? (meal as Record<string, unknown>)?.instrucciones ?? (meal as Record<string, unknown>)?.steps);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md lg:max-w-2xl h-[90vh] sm:h-[85vh] overflow-hidden flex flex-col p-0 border-none sm:rounded-3xl">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 rounded-3xl">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cargando receta...</p>
            </div>
          </div>
        )}

        {meal && (
          <>
            <div className="relative h-32 shrink-0 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b border-border/50">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]" />
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex items-end justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      {meal.meal ?? "Comida"}
                    </div>
                    <DialogTitle className="text-2xl font-extrabold tracking-tight text-foreground line-clamp-1">
                      {title}
                    </DialogTitle>
                  </div>
                  <Badge variant="secondary" className="mb-1 font-bold bg-primary/10 text-primary border-primary/20 px-3 py-1">
                    {kcal} kcal
                  </Badge>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0 px-6">
              <div className="space-y-8 py-6 pb-10">
                {imgSrc && (
                  <div className="group relative rounded-2xl overflow-hidden border border-border/50 shadow-2xl transition-all duration-500 hover:shadow-primary/10">
                    <div className="aspect-video w-full">
                      <img
                        src={imgSrc}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).parentElement?.parentElement?.style.setProperty("display", "none");
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                      <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                        <List className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold text-foreground tracking-tight">Ingredientes</h3>
                    </div>

                    {meal.ingredients && meal.ingredients.length > 0 ? (
                      <div className="grid gap-2.5">
                        {meal.ingredients.map((ingredient, idx) => {
                          const isObject = typeof ingredient === "object" && ingredient !== null;
                          let name: string;
                          let amount: string | null = null;
                          if (isObject) {
                            const ing = ingredient as { name?: string; portion?: string; grams?: string; cantidad?: string; amount?: string; quantity?: string };
                            name = ing.name ?? "";
                            amount = ing.portion ?? ing.grams ?? ing.cantidad ?? ing.amount ?? ing.quantity ?? null;
                          } else {
                            const str = String(ingredient ?? "").trim();
                            const colonIdx = str.indexOf(":");
                            if (colonIdx > 0) {
                              name = str.slice(0, colonIdx).trim();
                              amount = str.slice(colonIdx + 1).trim() || null;
                            } else {
                              name = str;
                            }
                          }
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/20 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                                <span className="text-sm font-semibold text-foreground/80 group-hover:text-foreground capitalize leading-tight">
                                  {name}
                                </span>
                              </div>
                              {amount && (
                                <Badge variant="outline" className="text-[10px] uppercase font-black px-2 py-0 border-primary/20 text-primary bg-primary/10 shadow-sm">
                                  {amount}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 bg-muted/20 rounded-2xl border-2 border-dashed border-border/50 text-center px-4">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                          <List className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No hay ingredientes listados.</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                        <Utensils className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold text-foreground tracking-tight">Preparación</h3>
                    </div>

                    {instructions.length > 0 ? (
                      <div className="space-y-4">
                        {instructions.map((step, idx) => (
                          <div key={idx} className="flex gap-4 group">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-black shadow-sm group-hover:bg-primary group-hover:text-white transition-colors">
                              {idx + 1}
                            </span>
                            <p className="text-sm leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors pt-0.5 font-medium">
                              {typeof step === "string" ? step : String(step)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 bg-muted/20 rounded-2xl border-2 border-dashed border-border/50 text-center px-4">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                          <Utensils className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No hay pasos disponibles.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
