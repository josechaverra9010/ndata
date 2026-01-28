import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Loader2 } from "lucide-react";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

interface AddMeetingLinkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    appointmentId: number;
    patientName: string;
    onSuccess: () => void;
}

export function AddMeetingLinkDialog({
    open,
    onOpenChange,
    appointmentId,
    patientName,
    onSuccess,
}: AddMeetingLinkDialogProps) {
    const [link, setLink] = useState("");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!link.trim()) return;

        setLoading(true);
        try {
            await axios.put(`${API_URL}/appointments/${appointmentId}`, {
                meeting_link: link.trim(),
            });

            toast({
                title: "¡Enlace guardado!",
                description: "El enlace de la videollamada ha sido actualizado correctamente.",
            });

            setLink("");
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error("Error saving meeting link:", error);
            toast({
                title: "Error",
                description: "No se pudo guardar el enlace. Intenta de nuevo.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Video className="h-5 w-5 text-primary" />
                        </div>
                        <DialogTitle>Enlace de Videollamada</DialogTitle>
                    </div>
                    <DialogDescription>
                        Ingresa el enlace de Zoom, Google Meet o Teams para la consulta con{" "}
                        <span className="font-semibold text-foreground">{patientName}</span>.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="link">URL de la reunión</Label>
                        <Input
                            id="link"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            disabled={loading}
                            autoFocus
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={!link.trim() || loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                "Guardar Enlace"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
