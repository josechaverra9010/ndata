import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export const FOOD_GROUPS = [
    "Lácteos enteros",
    "Lácteos semi/desnatados",
    "Huevos",
    "Carnes magras",
    "Carnes grasas",
    "Pescado blanco",
    "Pescado azul",
    "Verduras",
    "Frutas",
    "Frutos secos",
    "Legumbres",
    "Aceite de oliva",
    "Otras grasas",
    "Cereales refinados",
    "Cereales integrales",
    "Repostería industrial",
    "Azúcares",
    "Alcohol",
    "Agua",
];

export const FREQUENCY_COLUMNS = [
    { id: "never", label: "Nunca o casi nunca", category: "Nunca" },
    { id: "month_1", label: "1", category: "Al mes" },
    { id: "month_2", label: "2", category: "Al mes" },
    { id: "month_3", label: "3", category: "Al mes" },
    { id: "week_1", label: "1", category: "A la semana" },
    { id: "week_2", label: "2", category: "A la semana" },
    { id: "week_3", label: "3", category: "A la semana" },
    { id: "week_4", label: "4", category: "A la semana" },
    { id: "week_5", label: "5", category: "A la semana" },
    { id: "week_6", label: "6", category: "A la semana" },
    { id: "day_1", label: "1", category: "Al día" },
    { id: "day_2", label: "2", category: "Al día" },
    { id: "day_3", label: "3", category: "Al día" },
    { id: "day_4", label: "4", category: "Al día" },
    { id: "day_5", label: "5", category: "Al día" },
    { id: "day_6", label: "≥ 6", category: "Al día" },
];

interface FoodFrequencyFormProps {
    data: any[];
    onChange: (newData: any[]) => void;
    readOnly?: boolean;
}

export function FoodFrequencyForm({ data, onChange, readOnly = false }: FoodFrequencyFormProps) {
    const handleValueChange = (index: number, val: string) => {
        const newData = [...data];
        newData[index] = { ...newData[index], frecuencia: val };
        onChange(newData);
    };

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-md border border-emerald-200 bg-emerald-50/40 min-w-full">
                <table className="w-full text-[10px] sm:text-xs text-black">
                    <thead>
                        <tr className="bg-emerald-600 text-black border-b">
                            <th rowSpan={2} className="p-2 border-r text-left font-bold w-[20%]">Grupo de alimentos</th>
                            <th rowSpan={2} className="p-2 border-r text-center font-bold">Nunca o casi nunca</th>
                            <th colSpan={3} className="p-1 border-r border-b text-center font-bold">Al mes</th>
                            <th colSpan={6} className="p-1 border-r border-b text-center font-bold">A la semana</th>
                            <th colSpan={6} className="p-1 text-center font-bold border-b">Al día</th>
                        </tr>
                        <tr className="bg-emerald-50 border-b text-black">
                            {[1, 2, 3].map(n => <th key={`m-${n}`} className="p-1 border-r text-center font-bold">{n}</th>)}
                            {[1, 2, 3, 4, 5, 6].map(n => <th key={`w-${n}`} className="p-1 border-r text-center font-bold">{n}</th>)}
                            {[1, 2, 3, 4, 5, "≥ 6"].map(n => <th key={`d-${n}`} className="p-1 border-r last:border-r-0 text-center font-bold">{n}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {data.map((item, index) => (
                            <tr
                                key={item.grupo}
                                className={index % 2 === 0 ? "bg-[#fdf6e9]" : "bg-white"}
                            >
                                <td className="p-2 border-r font-medium text-left">{item.grupo}</td>
                                {FREQUENCY_COLUMNS.map((col) => (
                                    <td key={col.id} className="p-0 border-r last:border-r-0 text-center vertical-middle">
                                        <label className="flex items-center justify-center w-full h-8 cursor-pointer hover:bg-emerald-100/60 transition-colors">
                                            <input
                                                type="radio"
                                                name={`freq-${index}-${item.grupo}`}
                                                checked={item.frecuencia === col.id}
                                                onChange={() => !readOnly && handleValueChange(index, col.id)}
                                                disabled={readOnly}
                                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-emerald-300"
                                            />
                                        </label>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="text-[10px] text-muted-foreground mt-2 italic px-1">
                Figura 1. Cuestionario de Frecuencia de Consumo de Grupos de Alimentos (CFCGA).
            </div>
        </div>
    );
}
