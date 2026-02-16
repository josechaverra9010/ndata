import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save } from "lucide-react";
import { API_URL } from "@/config/api";

interface Recordatorio24hFormProps {
    patientId: number;
    onSuccess: () => void;
    onCancel: () => void;
}

export function Recordatorio24hForm({ patientId, onSuccess, onCancel }: Recordatorio24hFormProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const MEAL_TIMES = [
        { id: "desayuno", label: "DESAYUNO", time: "7:00am - 9:30am", rows: 4 },
        { id: "media_manana", label: "SNACK #1", time: "10:00am - 11:00am", rows: 3 },
        { id: "almuerzo", label: "ALMUERZO", time: "12:00pm - 1:30pm", rows: 6 },
        { id: "media_tarde", label: "SNACK #2", time: "4:00pm - 5:00pm", rows: 3 },
        { id: "cena", label: "CENA", time: "7:00pm - 8:00pm", rows: 6 },
    ];

    const createEmptyRow = () => ({ prep: "", ingredients: "", qty: "" });
    const createEmptySection = (rowCount: number) => Array(rowCount).fill(null).map(() => createEmptyRow());

    const [formData, setFormData] = useState({
        desayuno: createEmptySection(4),
        media_manana: createEmptySection(3),
        almuerzo: createEmptySection(6),
        media_tarde: createEmptySection(3),
        cena: createEmptySection(6),
        observaciones: "",
        date: new Date().toISOString().split("T")[0],
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Convert structured data to strings before sending to backend
        const payload = {
            ...formData,
            desayuno: JSON.stringify(formData.desayuno),
            media_manana: JSON.stringify(formData.media_manana),
            almuerzo: JSON.stringify(formData.almuerzo),
            media_tarde: JSON.stringify(formData.media_tarde),
            cena: JSON.stringify(formData.cena),
            snack_nocturno: JSON.stringify([]), // Not in the image but in schema
        };

        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/patients/${patientId}/recalls`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error("Error al guardar el recordatorio");

            toast({
                title: "Éxito",
                description: "Recordatorio de 24 horas guardado correctamente",
            });
            onSuccess();
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

    const handleCellChange = (mealId: string, rowIndex: number, field: string, value: string) => {
        setFormData((prev: any) => {
            const newMealData = [...prev[mealId]];
            newMealData[rowIndex] = { ...newMealData[rowIndex], [field]: value };
            return { ...prev, [mealId]: newMealData };
        });
    };

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <Card className="border-0 shadow-none">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-lg">Nuevo Recordatorio de 24 Horas</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">Fecha del Recordatorio</Label>
                            <input
                                id="date"
                                type="date"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.date}
                                onChange={(e) => handleChange("date", e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Detalle de Ingesta (24 Horas)</Label>
                            <div className="overflow-x-auto rounded-md border">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-muted/50 border-b">
                                            <th className="p-2 border-r text-center font-bold w-[120px]">TIEMPO DE COMIDA/HORA</th>
                                            <th className="p-2 border-r text-center font-bold">PREPARACIÓN</th>
                                            <th className="p-2 border-r text-center font-bold">INGREDIENTES</th>
                                            <th className="p-2 text-center font-bold w-[100px]">CANTIDAD (g)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {MEAL_TIMES.map((meal) => (
                                            <>
                                                {Array(meal.rows).fill(null).map((_, i) => (
                                                    <tr key={`${meal.id}-${i}`}>
                                                        {i === 0 && (
                                                            <td rowSpan={meal.rows} className="p-2 border-r bg-muted/10 text-center font-bold">
                                                                <div className="uppercase tracking-wider">{meal.label}</div>
                                                                <div className="text-[10px] text-muted-foreground mt-1">{meal.time}</div>
                                                            </td>
                                                        )}
                                                        <td className="p-0 border-r h-8">
                                                            <input
                                                                className="w-full h-full px-2 border-0 bg-transparent focus:ring-1 focus:ring-primary outline-none"
                                                                value={(formData as any)[meal.id][i].prep}
                                                                onChange={(e) => handleCellChange(meal.id, i, "prep", e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-0 border-r h-8">
                                                            <input
                                                                className="w-full h-full px-2 border-0 bg-transparent focus:ring-1 focus:ring-primary outline-none"
                                                                value={(formData as any)[meal.id][i].ingredients}
                                                                onChange={(e) => handleCellChange(meal.id, i, "ingredients", e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-0 h-8 text-center">
                                                            <input
                                                                className="w-full h-full px-1 border-0 bg-transparent text-center focus:ring-1 focus:ring-primary outline-none"
                                                                value={(formData as any)[meal.id][i].qty}
                                                                onChange={(e) => handleCellChange(meal.id, i, "qty", e.target.value)}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="observaciones">Observaciones Adicionales</Label>
                            <Textarea
                                id="observaciones"
                                value={formData.observaciones}
                                onChange={(e) => handleChange("observaciones", e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                            Cancelar
                        </Button>
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
                </form>
            </CardContent>
        </Card>
    );
}
