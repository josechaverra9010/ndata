import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, ChefHat, Users } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MealPlan {
    id: number;
    name: string;
    category?: string;
    calories?: number;
}

interface Patient {
    id: number;
    nombres: string;
    apellidos: string;
}

interface WeeklyMenu {
    id: number;
    name: string;
    description: string;
    category: string;
    total_calories: number;
    assigned_patients: number;
}

interface AssignPlanWithMenuDialogProps {
    plan: MealPlan | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAssignSuccess: () => void;
    preselectedPatient?: Patient | null;
}

export function AssignPlanWithMenuDialog({ plan, open, onOpenChange, onAssignSuccess, preselectedPatient }: AssignPlanWithMenuDialogProps) {
    const { toast } = useToast();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [weeklyMenus, setWeeklyMenus] = useState<WeeklyMenu[]>([]);
    const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<string>("");
    const [selectedMenu, setSelectedMenu] = useState<string>("");
    const [selectedPlanId, setSelectedPlanId] = useState<string>("");
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchPatients();
            fetchWeeklyMenus();
            fetchMealPlans();
            // Si se pasa un plan, preseleccionarlo
            if (plan && plan.id) {
                setSelectedPlanId(plan.id.toString());
            }
            // Si se pasa un paciente preseleccionado, seleccionarlo
            if (preselectedPatient && preselectedPatient.id) {
                setSelectedPatient(preselectedPatient.id.toString());
            }
        }
    }, [open, plan, preselectedPatient]);

    const fetchPatients = async () => {
        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/patients`, {
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                }
            });
            if (response.ok) {
                const data = await response.json();
                setPatients(data);
            }
        } catch (error) {
            console.error("Error fetching patients:", error);
        }
    };

    const fetchWeeklyMenus = async () => {
        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/weekly-menus-complete`, {
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                }
            });
            if (response.ok) {
                const data = await response.json();
                setWeeklyMenus(data);
            }
        } catch (error) {
            console.error("Error fetching weekly menus:", error);
        }
    };

    const fetchMealPlans = async () => {
        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/meal-plans`, {
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                }
            });
            if (response.ok) {
                const data = await response.json();
                setMealPlans(data);
            }
        } catch (error) {
            console.error("Error fetching meal plans:", error);
        }
    };

    const handleAssign = async () => {
        if (!selectedPatient || !selectedMenu || !selectedPlanId) {
            toast({
                title: "Campos incompletos",
                description: "Por favor completa todos los campos",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/assign-plan-with-menu`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    patient_id: parseInt(selectedPatient),
                    meal_plan_id: parseInt(selectedPlanId),
                    weekly_menu_id: parseInt(selectedMenu),
                    start_date: format(startDate, "yyyy-MM-dd"),
                }),
            });

            if (response.ok) {
                toast({
                    title: "¡Éxito!",
                    description: "Plan y menú semanal asignado correctamente",
                });
                onAssignSuccess();
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
        setSelectedPatient("");
        setSelectedMenu("");
        setSelectedPlanId("");
        setStartDate(new Date());
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ChefHat className="h-5 w-5 text-primary" />
                        Asignar Plan con Menú Semanal
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Plan Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="plan" className="flex items-center gap-2">
                            <ChefHat className="h-4 w-4" />
                            Plan Nutricional
                        </Label>
                        <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                            <SelectTrigger id="plan">
                                <SelectValue placeholder="Selecciona un plan" />
                            </SelectTrigger>
                            <SelectContent>
                                {mealPlans.map((mealPlan) => (
                                    <SelectItem key={mealPlan.id} value={mealPlan.id.toString()}>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{mealPlan.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {mealPlan.category} • {mealPlan.calories} kcal
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Patient Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="patient" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Paciente
                        </Label>
                        <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                            <SelectTrigger id="patient">
                                <SelectValue placeholder="Selecciona un paciente" />
                            </SelectTrigger>
                            <SelectContent>
                                {patients.map((patient) => (
                                    <SelectItem key={patient.id} value={patient.id.toString()}>
                                        {patient.nombres} {patient.apellidos}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Weekly Menu Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="menu" className="flex items-center gap-2">
                            <ChefHat className="h-4 w-4" />
                            Menú Semanal
                        </Label>
                        <Select value={selectedMenu} onValueChange={setSelectedMenu}>
                            <SelectTrigger id="menu">
                                <SelectValue placeholder="Selecciona un menú semanal" />
                            </SelectTrigger>
                            <SelectContent>
                                {weeklyMenus.map((menu) => (
                                    <SelectItem key={menu.id} value={menu.id.toString()}>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{menu.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {menu.category} • {menu.total_calories} kcal
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Start Date */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            Fecha de inicio
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !startDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {startDate ? format(startDate, "PPP", { locale: es }) : "Selecciona una fecha"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={startDate}
                                    onSelect={(date) => date && setStartDate(date)}
                                    initialFocus
                                    locale={es}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Selected Menu Preview */}
                    {selectedMenu && (
                        <div className="rounded-lg border border-border bg-card p-4">
                            <p className="text-sm font-medium text-muted-foreground mb-2">Vista previa</p>
                            {weeklyMenus
                                .filter((m) => m.id.toString() === selectedMenu)
                                .map((menu) => (
                                    <div key={menu.id} className="space-y-1">
                                        <p className="font-medium text-foreground">{menu.name}</p>
                                        <p className="text-sm text-muted-foreground">{menu.description}</p>
                                        <div className="flex gap-3 pt-2 text-xs">
                                            <span className="text-muted-foreground">
                                                <span className="font-semibold text-foreground">{menu.total_calories}</span> kcal/día
                                            </span>
                                            <span className="text-muted-foreground">
                                                <span className="font-semibold text-foreground">{menu.assigned_patients}</span> pacientes
                                            </span>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleAssign} disabled={loading} className="gradient-primary border-0">
                        {loading ? "Asignando..." : "Asignar Plan y Menú"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
