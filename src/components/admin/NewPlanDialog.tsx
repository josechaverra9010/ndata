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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NewPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePlan: (planData: any) => void;
}

export function NewPlanDialog({ open, onOpenChange, onCreatePlan }: NewPlanDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    calories: "",
    duration: "",
    category: "",
    color: "primary",
    protein_target: "",
    carbs_target: "",
    fat_target: "",
    meals_per_day: "3",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const planData = {
      name: formData.name,
      description: formData.description,
      calories: parseInt(formData.calories),
      duration: formData.duration,
      category: formData.category,
      color: formData.color,
      protein_target: formData.protein_target ? parseInt(formData.protein_target) : 0,
      carbs_target: formData.carbs_target ? parseInt(formData.carbs_target) : 0,
      fat_target: formData.fat_target ? parseInt(formData.fat_target) : 0,
      meals_per_day: parseInt(formData.meals_per_day),
    };

    onCreatePlan(planData);

    // Reset form
    setFormData({
      name: "",
      description: "",
      calories: "",
      duration: "",
      category: "",
      color: "primary",
      protein_target: "",
      carbs_target: "",
      fat_target: "",
      meals_per_day: "3",
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const categories = [
    "Pérdida de peso",
    "Ganancia muscular",
    "Deportivo",
    "Médico",
    "Vegetariano",
    "Vegano",
    "Embarazo",
    "Mantenimiento",
  ];

  const colors = [
    { value: "primary", label: "Azul" },
    { value: "accent", label: "Naranja" },
    { value: "success", label: "Verde" },
    { value: "info", label: "Cyan" },
    { value: "warning", label: "Amarillo" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Plan Nutricional</DialogTitle>
          <DialogDescription>
            Define los detalles del plan de alimentación para tus pacientes
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Información Básica */}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Plan *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría *</Label>
                <Select value={formData.category} onValueChange={(value) => handleChange("category", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color del Plan</Label>
                <Select value={formData.color} onValueChange={(value) => handleChange("color", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colors.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        {color.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Calorías y Duración */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="calories">Calorías Diarias *</Label>
                <Input
                  id="calories"
                  type="number"
                  value={formData.calories}
                  onChange={(e) => handleChange("calories", e.target.value)}
                  required
                  min="800"
                  max="5000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duración *</Label>
                <Input
                  id="duration"
                  value={formData.duration}
                  onChange={(e) => handleChange("duration", e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Macronutrientes */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Objetivos de Macronutrientes (opcionales)</Label>
              <p className="text-sm text-muted-foreground">Define las metas diarias en gramos</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="protein">Proteína (g)</Label>
                <Input
                  id="protein"
                  type="number"
                  value={formData.protein_target}
                  onChange={(e) => handleChange("protein_target", e.target.value)}
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="carbs">Carbohidratos (g)</Label>
                <Input
                  id="carbs"
                  type="number"
                  value={formData.carbs_target}
                  onChange={(e) => handleChange("carbs_target", e.target.value)}
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fat">Grasas (g)</Label>
                <Input
                  id="fat"
                  type="number"
                  value={formData.fat_target}
                  onChange={(e) => handleChange("fat_target", e.target.value)}
                  min="0"
                />
              </div>
            </div>

            {/* Comidas por día */}
            <div className="space-y-2">
              <Label htmlFor="meals">Comidas por Día *</Label>
              <Select value={formData.meals_per_day} onValueChange={(value) => handleChange("meals_per_day", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 comidas</SelectItem>
                  <SelectItem value="4">4 comidas</SelectItem>
                  <SelectItem value="5">5 comidas</SelectItem>
                  <SelectItem value="6">6 comidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary border-0">
              Crear Plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}