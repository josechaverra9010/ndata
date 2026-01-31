import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, Clock } from "lucide-react";

interface Patient {
    id: number;
    nombres: string;
    apellidos: string;
    email: string;
}

interface ScheduleAppointmentDialogProps {
    patient: Patient;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function ScheduleAppointmentDialog({
    patient,
    open,
    onOpenChange,
    onSuccess
}: ScheduleAppointmentDialogProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        date: "",
        time: "",
        duration: "30 min",
        type: "presencial",
        notes: "",
    });

    // Generar horarios disponibles (8:00 AM - 7:00 PM cada 30 min)
    const generateTimeSlots = () => {
        const slots = [];
        for (let hour = 8; hour < 19; hour++) {
            slots.push(`${hour.toString().padStart(2, '0')}:00`);
            slots.push(`${hour.toString().padStart(2, '0')}:30`);
        }
        return slots;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.date || !formData.time) {
            toast({
                title: "Error",
                description: "Por favor completa todos los campos requeridos",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        try {
            const appointmentData = {
                patient_id: patient.id,
                patient_name: `${patient.nombres} ${patient.apellidos}`,
                date: formData.date,
                time: formData.time,
                duration: formData.duration,
                type: formData.type,
                notes: formData.notes || null,
            };

            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/appointments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(appointmentData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Error al crear la cita");
            }

            toast({
                title: "¡Cita agendada!",
                description: `Cita programada para ${formData.date} a las ${formData.time}`,
            });

            onSuccess();
            onOpenChange(false);

            // Reset form
            setFormData({
                date: "",
                time: "",
                duration: "30 min",
                type: "presencial",
                notes: "",
            });
        } catch (error) {
            console.error("Error scheduling appointment:", error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "No se pudo agendar la cita",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    // Obtener fecha mínima (hoy)
    const today = new Date().toISOString().split('T')[0];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Agendar Cita</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Paciente: {patient.nombres} {patient.apellidos}
                    </p>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Fecha y Hora */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">
                                Fecha <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                    id="date"
                                    type="date"
                                    min={today}
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="pl-10"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="time">
                                Hora <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={formData.time}
                                onValueChange={(value) => setFormData({ ...formData, time: value })}
                                disabled={loading}
                                required
                            >
                                <SelectTrigger>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="Selecciona hora" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {generateTimeSlots().map((slot) => (
                                        <SelectItem key={slot} value={slot}>
                                            {slot}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Duración y Tipo */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="duration">Duración</Label>
                            <Select
                                value={formData.duration}
                                onValueChange={(value) => setFormData({ ...formData, duration: value })}
                                disabled={loading}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="30 min">30 minutos</SelectItem>
                                    <SelectItem value="45 min">45 minutos</SelectItem>
                                    <SelectItem value="60 min">1 hora</SelectItem>
                                    <SelectItem value="90 min">1.5 horas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="type">Tipo de cita</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value) => setFormData({ ...formData, type: value })}
                                disabled={loading}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="presencial">Presencial</SelectItem>
                                    <SelectItem value="videollamada">Videollamada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Notas */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (opcional)</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            disabled={loading}
                            rows={3}
                            className="resize-none"
                        />
                    </div>

                    {/* Información adicional */}
                    <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                        <p className="font-medium mb-1">Resumen de la cita:</p>
                        <ul className="space-y-1">
                            <li>• Paciente: {patient.nombres} {patient.apellidos}</li>
                            {formData.date && (
                                <li>• Fecha: {new Date(formData.date + 'T00:00:00').toLocaleDateString('es-ES', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}</li>
                            )}
                            {formData.time && <li>• Hora: {formData.time}</li>}
                            <li>• Duración: {formData.duration}</li>
                            <li>• Modalidad: {formData.type === 'presencial' ? 'Presencial' : 'Videollamada'}</li>
                        </ul>
                    </div>

                    {/* Botones */}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Agendar Cita
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}