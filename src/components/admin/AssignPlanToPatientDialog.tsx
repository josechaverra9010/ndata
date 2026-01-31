import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2 } from "lucide-react";

interface MealPlan {
    id: number;
    name: string;
    description: string;
    category: string;
}

interface Patient {
    id: number;
    nombres: string;
    apellidos: string;
}

interface AssignPlanToPatientDialogProps {
    patient: Patient;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function AssignPlanToPatientDialog({
    patient,
    open,
    onOpenChange,
    onSuccess,
}: AssignPlanToPatientDialogProps) {
    const { toast } = useToast();
    const [plans, setPlans] = useState<MealPlan[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string>("");
    const [startDate, setStartDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [endDate, setEndDate] = useState("");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingPlans, setLoadingPlans] = useState(false);

    useEffect(() => {
        if (open) {
            fetchPlans();
        }
    }, [open]);

    const fetchPlans = async () => {
        try {
            setLoadingPlans(true);
            const token = localStorage.getItem("userToken");
            // We use the basic listing endpoint. In a real app we might paginate or filter.
            const response = await fetch(`${API_URL}/meal-plans`, {
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                }
            });
            if (response.ok) {
                const data = await response.json();
                setPlans(data);
            }
        } catch (error) {
            console.error("Error fetching plans:", error);
            toast({
                title: "Error",
                description: "No se pudieron cargar los planes",
                variant: "destructive",
            });
        } finally {
            setLoadingPlans(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlanId) return;

        setLoading(true);
        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/meal-plans/assign`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    patient_id: patient.id,
                    meal_plan_id: parseInt(selectedPlanId),
                    start_date: startDate,
                    end_date: endDate || null,
                    notes: notes || null,
                }),
            });

            if (response.ok) {
                toast({
                    title: "¡Éxito!",
                    description: "Plan asignado correctamente",
                });
                onSuccess();
                onOpenChange(false);
                resetForm();
            } else {
                const error = await response.json();
                toast({
                    title: "Error",
                    description: error.detail || "No se pudo asignar el plan",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Error assigning plan:", error);
            toast({
                title: "Error",
                description: "Error al asignar el plan",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSelectedPlanId("");
        setStartDate(new Date().toISOString().split("T")[0]);
        setEndDate("");
        setNotes("");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    {/*<DialogTitle>Asignar Plan Nutricional</DialogTitle>
                    <DialogDescription>
                        Paciente: {patient.nombres} {patient.apellidos}
                    </DialogDescription>*/}
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="plan">Seleccionar Plan *</Label>
                        <Select
                            value={selectedPlanId}
                            onValueChange={setSelectedPlanId}
                            disabled={loadingPlans}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un plan" />
                            </SelectTrigger>
                            <SelectContent>
                                {plans.map((plan) => (
                                    <SelectItem key={plan.id} value={plan.id.toString()}>
                                        {plan.name} ({plan.category})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {loadingPlans && <p className="text-xs text-muted-foreground">Cargando planes...</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="start-date">Fecha de Inicio *</Label>
                            <Input
                                id="start-date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="end-date">Fecha de Fin (Opcional)</Label>
                            <Input
                                id="end-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                min={startDate}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (Opcional)</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={!selectedPlanId || loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Asignar Plan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
