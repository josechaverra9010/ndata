import { useState, useEffect } from "react";
import React from "react";
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
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, CheckCircle2, Calculator, ClipboardList, FileText, Utensils, Flame, Users } from "lucide-react";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface NewPlanWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePlan: (planData: any) => void;
}

const PHASES = [
  {
    id: 1,
    title: "REQUERIMIENTO ENERGÉTICO Y PESO SALUDABLE",
    icon: Calculator,
    description: "Calcula las necesidades energéticas y el peso saludable del paciente"
  },
  {
    id: 2,
    title: "FÓRMULA SINTÉTICA DE CONSUMO Y PLANEADA",
    icon: ClipboardList,
    description: "Define la fórmula sintética de consumo actual y planeada"
  },
  {
    id: 3,
    title: "FÓRMULA SINTÉTICA DESARROLLADA",
    icon: FileText,
    description: "Desarrolla la fórmula sintética con detalles específicos"
  },
  {
    id: 4,
    title: "MINUTA PATRÓN",
    icon: Utensils,
    description: "Crea la minuta patrón con las comidas del plan"
  }
];

// Grupos de alimentos para Fase 3
const GRUPOS_ALIMENTOS = [
  "Leches enteras frescas y fermentadas",
  "Leches semidescremadas frescas y fermentadas",
  "Leches descremadas frescas y fermentadas",
  "Sustitutos",
  "Carnes magras crudas y proteínas texturizada",
  "Leguminosas adultos",
  "Cereales adultos",
  "Tubérculos y plátanos adultos",
  "Verduras y hortalizas adultos y niños",
  "Frutas adultos",
  "Nueces adultos",
  "Azucares y dulces adultos",
  "Productos con reducción de grasa adultos y niños",
  "Grasas animales adultos",
  "Grasas vegetales adultos",
  "Aceites adultos",
  "Bebidas adultos",
  "Otros alimentos adultos",
  "Promedio \"Harinas\" adultos"
];

export function NewPlanWizard({ open, onOpenChange, onCreatePlan }: NewPlanWizardProps) {
  const [currentPhase, setCurrentPhase] = useState(1);
  const [formData, setFormData] = useState({
    // Fase 1: Requerimiento Energético y Peso Saludable
    peso_actual: "",
    altura: "",
    edad: "",
    genero: "",
    peso_saludable: "",
    peso_objetivo: "",
    requerimiento_energetico: "",
    imc: "",
    tmb: "",
    factor_actividad: "",
    
    // Fase 2: Fórmula Sintética de Consumo y Planeada
    proteinas_gramos_f2: "",
    proteinas_calorias_f2: "",
    proteinas_amdr_f2: "",
    proteinas_avb_gramos: "",
    proteinas_avb_porcentaje: "",
    proteinas_kg_peso: "",
    grasas_gramos_f2: "",
    grasas_calorias_f2: "",
    grasas_amdr_f2: "",
    grasas_gs_gramos: "",
    grasas_gs_amdr: "",
    grasas_gm_gramos: "",
    grasas_gm_amdr: "",
    grasas_gp_gramos: "",
    grasas_gp_amdr: "",
    grasas_colesterol: "",
    cho_gramos_f2: "",
    cho_calorias_f2: "",
    cho_amdr_f2: "",
    cho_concent_gramos: "",
    cho_concent_amdr: "",
    total_calorias_f2: "",
    total_amdr_f2: "",
    total_fibra: "",
    peso_referencia_f2: "",
    
    // Fase 3: Grupos de Alimentos - Solo porciones
    grupos_alimentos_f3: GRUPOS_ALIMENTOS.reduce((acc, grupo) => {
      acc[grupo] = {
        porciones: ""
      };
      return acc;
    }, {} as Record<string, any>),
    
    // Fase 4: Minuta Patrón
    nombre_plan: "",
    descripcion: "",
    categoria: "",
    color: "primary",
    duracion: "",
    comidas_dia: "3",
    desayuno: "",
    media_manana: "",
    almuerzo: "",
    media_tarde: "",
    cena: "",
    snack_nocturno: "",
    observaciones: "",
    weekly_menu_id: ""
  });

  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [weeklyMenus, setWeeklyMenus] = useState<any[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const { toast } = useToast();

  const currentPhaseData = PHASES.find(p => p.id === currentPhase) || PHASES[0];

  // Cargar menús semanales cuando se abre la Fase 4
  useEffect(() => {
    if (currentPhase === 4 && open) {
      fetchWeeklyMenus();
    }
  }, [currentPhase, open]);

  const fetchWeeklyMenus = async () => {
    setLoadingMenus(true);
    try {
      const response = await fetch(`${API_URL}/weekly-menus-complete`);
      if (response.ok) {
        const data = await response.json();
        setWeeklyMenus(data);
      }
    } catch (error) {
      console.error("Error fetching weekly menus:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los menús semanales",
        variant: "destructive"
      });
    } finally {
      setLoadingMenus(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Calcular IMC
  const calculateIMC = (pesoValue: string, alturaValue: string) => {
    const peso = parseFloat(pesoValue);
    const altura = parseFloat(alturaValue);
    
    if (isNaN(peso) || isNaN(altura) || peso <= 0 || altura <= 0) {
      handleChange("imc", "");
      return;
    }
    
    // Convertir altura de cm a metros
    const alturaMetros = altura / 100;
    const imc = peso / (alturaMetros * alturaMetros);
    handleChange("imc", imc.toFixed(2));
    
    // Calcular peso saludable después de calcular IMC
    calculatePesoSaludable(alturaValue, imc.toString(), pesoValue);
  };

  // Calcular TMB FAO/Schofield
  const calculateTMB = (pesoValue: string, edadValue: string, generoValue: string) => {
    const peso = parseFloat(pesoValue);
    const edad = parseFloat(edadValue);
    const genero = generoValue;
    
    if (isNaN(peso) || isNaN(edad) || peso <= 0 || edad <= 0 || !genero) {
      handleChange("tmb", "");
      return;
    }
    
    // Usar peso objetivo si está disponible, sino peso actual
    const pesoParaCalculo = parseFloat(formData.peso_objetivo) || peso;
    
    let tmb = 0;
    
    if (genero === "masculino") {
      if (edad >= 18 && edad <= 30) {
        tmb = (15.057 * pesoParaCalculo) + 692.2;
      } else if (edad >= 31 && edad <= 60) {
        tmb = (11.472 * pesoParaCalculo) + 873.1;
      } else if (edad > 60) {
        tmb = (11.711 * pesoParaCalculo) + 587.7;
      }
    } else if (genero === "femenino") {
      if (edad >= 18 && edad <= 30) {
        tmb = (14.818 * pesoParaCalculo) + 486.6;
      } else if (edad >= 31 && edad <= 60) {
        tmb = (8.126 * pesoParaCalculo) + 845.6;
      } else if (edad > 60) {
        tmb = (9.082 * pesoParaCalculo) + 658.5;
      }
    }
    
    handleChange("tmb", tmb.toFixed(2));
    
    // Calcular requerimiento energético después de calcular TMB
    calculateRequerimientoEnergetico(tmb.toString(), formData.factor_actividad);
  };

  // Calcular Peso Saludable
  const calculatePesoSaludable = (alturaValue: string, imcValue: string, pesoActualValue: string) => {
    const altura = parseFloat(alturaValue);
    const imc = parseFloat(imcValue);
    const pesoActual = parseFloat(pesoActualValue);
    
    if (isNaN(altura) || isNaN(imc) || altura <= 0) {
      handleChange("peso_saludable", "");
      return;
    }
    
    const alturaMetros = altura / 100;
    let pesoSaludable = 0;
    
    if (imc <= 25) {
      // Si IMC <= 25, peso saludable = peso para IMC 25
      pesoSaludable = 25 * (alturaMetros * alturaMetros);
    } else if (imc > 30) {
      // Si IMC > 30, peso ajustado = peso actual - (peso actual - peso IMC 25) * 0.25
      const pesoIMC25 = 25 * (alturaMetros * alturaMetros);
      pesoSaludable = pesoActual - ((pesoActual - pesoIMC25) * 0.25);
    } else {
      // Si 25 < IMC <= 30, peso saludable = peso para IMC 25
      pesoSaludable = 25 * (alturaMetros * alturaMetros);
    }
    
    handleChange("peso_saludable", pesoSaludable.toFixed(2));
  };

  // Calcular Requerimiento Energético
  const calculateRequerimientoEnergetico = (tmbValue: string, factorValue: string) => {
    const tmb = parseFloat(tmbValue);
    const factor = parseFloat(factorValue);
    
    if (isNaN(tmb) || isNaN(factor) || tmb <= 0 || factor <= 0) {
      handleChange("requerimiento_energetico", "");
      return;
    }
    
    const requerimiento = tmb * factor;
    handleChange("requerimiento_energetico", requerimiento.toFixed(2));
  };

  // Calcular valores de Fase 2
  const calculateFase2Values = () => {
    const totalCalorias = parseFloat(formData.requerimiento_energetico) || 0;
    if (totalCalorias <= 0) return;

    // Obtener valores editables
    const proteinasAMDR = parseFloat(formData.proteinas_amdr_f2) || 0;
    const grasasAMDR = parseFloat(formData.grasas_amdr_f2) || 0;
    const choAMDR = parseFloat(formData.cho_amdr_f2) || 0;
    const grasasGSAMDR = parseFloat(formData.grasas_gs_amdr) || 0;
    const grasasGPAMDR = parseFloat(formData.grasas_gp_amdr) || 0;
    const choConcentAMDR = parseFloat(formData.cho_concent_amdr) || 0;
    const proteinasAVB = parseFloat(formData.proteinas_avb_porcentaje) || 0;
    const proteinasKgPeso = parseFloat(formData.proteinas_kg_peso) || 0;
    const pesoRef = parseFloat(formData.peso_referencia_f2 || formData.peso_objetivo) || 0;

    // Calcular calorías de cada macronutriente
    const proteinasCalorias = (totalCalorias * proteinasAMDR) / 100;
    const grasasCalorias = (totalCalorias * grasasAMDR) / 100;
    const choCalorias = (totalCalorias * choAMDR) / 100;

    // Calcular gramos (1g proteína = 4 kcal, 1g grasa = 9 kcal, 1g CHO = 4 kcal)
    const proteinasGramos = proteinasCalorias / 4;
    const grasasGramos = grasasCalorias / 9;
    const choGramos = choCalorias / 4;

    // Calcular grasas saturadas, monoinsaturadas y poliinsaturadas
    const grasasGSCalorias = (totalCalorias * grasasGSAMDR) / 100;
    const grasasGSCaloriasResto = grasasCalorias - grasasGSCalorias;
    const grasasGPCalorias = (totalCalorias * grasasGPAMDR) / 100;
    const grasasGMCalorias = grasasGSCaloriasResto - grasasGPCalorias;

    const grasasGSGramos = grasasGSCalorias / 9;
    const grasasGMGramos = grasasGMCalorias / 9;
    const grasasGPGramos = grasasGPCalorias / 9;

    // Calcular proteínas AVB
    const proteinasAVBGramos = (proteinasGramos * proteinasAVB) / 100;

    // Calcular CHO concentrados
    const choConcentGramos = (choGramos * choConcentAMDR) / 100;

    // Calcular total AMDR
    const totalAMDR = proteinasAMDR + grasasAMDR + choAMDR;

    // Actualizar valores calculados
    handleChange("proteinas_calorias_f2", proteinasCalorias.toFixed(1));
    handleChange("proteinas_gramos_f2", proteinasGramos.toFixed(1));
    handleChange("grasas_calorias_f2", grasasCalorias.toFixed(1));
    handleChange("grasas_gramos_f2", grasasGramos.toFixed(1));
    handleChange("cho_calorias_f2", choCalorias.toFixed(1));
    handleChange("cho_gramos_f2", choGramos.toFixed(1));
    handleChange("grasas_gs_gramos", grasasGSGramos.toFixed(1));
    handleChange("grasas_gm_gramos", grasasGMGramos.toFixed(1));
    handleChange("grasas_gp_gramos", grasasGPGramos.toFixed(1));
    handleChange("proteinas_avb_gramos", proteinasAVBGramos.toFixed(1));
    handleChange("cho_concent_gramos", choConcentGramos.toFixed(1));
    handleChange("total_calorias_f2", totalCalorias.toFixed(1));
    handleChange("total_amdr_f2", totalAMDR.toFixed(1));
  };

  // Efecto para calcular Fase 2 cuando cambian los valores
  useEffect(() => {
    if (currentPhase === 2 && formData.requerimiento_energetico) {
      calculateFase2Values();
    }
  }, [
    currentPhase,
    formData.requerimiento_energetico,
    formData.proteinas_amdr_f2,
    formData.grasas_amdr_f2,
    formData.cho_amdr_f2,
    formData.grasas_gs_amdr,
    formData.grasas_gp_amdr,
    formData.cho_concent_amdr,
    formData.proteinas_avb_porcentaje,
    formData.peso_referencia_f2,
    formData.peso_objetivo
  ]);

  const handleNext = () => {
    if (currentPhase < 4) {
      if (!completedPhases.includes(currentPhase)) {
        setCompletedPhases([...completedPhases, currentPhase]);
      }
      setCurrentPhase(currentPhase + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPhase > 1) {
      setCurrentPhase(currentPhase - 1);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    // Solo permitir submit en la Fase 4
    if (currentPhase !== 4) {
      return;
    }
    
    const planData = {
      name: formData.nombre_plan || "Plan Nutricional",
      description: formData.descripcion,
      calories: parseInt(formData.requerimiento_energetico) || 0,
      duration: formData.duracion,
      category: formData.categoria,
      color: formData.color,
      meals_per_day: parseInt(formData.comidas_dia) || 3,
      
      // Datos de las 4 fases
      fase_1: {
        peso_actual: formData.peso_actual,
        altura: formData.altura,
        edad: formData.edad,
        genero: formData.genero,
        peso_saludable: formData.peso_saludable,
        peso_objetivo: formData.peso_objetivo,
        requerimiento_energetico: formData.requerimiento_energetico,
        imc: formData.imc,
        tmb: formData.tmb,
        factor_actividad: formData.factor_actividad
      },
      fase_2: {
        proteinas_gramos: formData.proteinas_gramos_f2,
        proteinas_calorias: formData.proteinas_calorias_f2,
        proteinas_amdr: formData.proteinas_amdr_f2,
        proteinas_avb_gramos: formData.proteinas_avb_gramos,
        proteinas_avb_porcentaje: formData.proteinas_avb_porcentaje,
        proteinas_kg_peso: formData.proteinas_kg_peso,
        grasas_gramos: formData.grasas_gramos_f2,
        grasas_calorias: formData.grasas_calorias_f2,
        grasas_amdr: formData.grasas_amdr_f2,
        grasas_gs_gramos: formData.grasas_gs_gramos,
        grasas_gs_amdr: formData.grasas_gs_amdr,
        grasas_gm_gramos: formData.grasas_gm_gramos,
        grasas_gm_amdr: formData.grasas_gm_amdr,
        grasas_gp_gramos: formData.grasas_gp_gramos,
        grasas_gp_amdr: formData.grasas_gp_amdr,
        grasas_colesterol: formData.grasas_colesterol,
        cho_gramos: formData.cho_gramos_f2,
        cho_calorias: formData.cho_calorias_f2,
        cho_amdr: formData.cho_amdr_f2,
        cho_concent_gramos: formData.cho_concent_gramos,
        cho_concent_amdr: formData.cho_concent_amdr,
        total_calorias: formData.total_calorias_f2,
        total_amdr: formData.total_amdr_f2,
        total_fibra: formData.total_fibra,
        peso_referencia: formData.peso_referencia_f2
      },
      fase_3: {
        grupos_alimentos: formData.grupos_alimentos_f3
      },
      fase_4: {
        nombre_plan: formData.nombre_plan,
        descripcion: formData.descripcion,
        categoria: formData.categoria,
        color: formData.color,
        duracion: formData.duracion,
        comidas_dia: formData.comidas_dia,
        desayuno: formData.desayuno,
        media_manana: formData.media_manana,
        almuerzo: formData.almuerzo,
        media_tarde: formData.media_tarde,
        cena: formData.cena,
        snack_nocturno: formData.snack_nocturno,
        observaciones: formData.observaciones
      }
    };

    // Crear el plan y asignar menú si existe
    try {
      // Crear el plan primero
      const response = await fetch(`${API_URL}/meal-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planData),
      });

      if (response.ok) {
        const newPlan = await response.json();
        const planId = newPlan.id;

        // Si se seleccionó un menú semanal, asignarlo al plan recién creado
        if (formData.weekly_menu_id) {
          try {
            const menuResponse = await fetch(`${API_URL}/meal-plans/${planId}/assign-menu`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ weekly_menu_id: parseInt(formData.weekly_menu_id) }),
            });

            if (menuResponse.ok) {
              toast({
                title: "¡Éxito!",
                description: "Plan nutricional creado y menú asignado correctamente",
              });
            } else {
              toast({
                title: "Plan creado",
                description: "El plan se creó pero no se pudo asignar el menú semanal",
                variant: "default",
              });
            }
          } catch (error) {
            console.error("Error assigning menu:", error);
            toast({
              title: "Plan creado",
              description: "El plan se creó pero hubo un error al asignar el menú",
              variant: "default",
            });
          }
        } else {
          toast({
            title: "¡Éxito!",
            description: "Plan nutricional creado correctamente",
          });
        }

        // Llamar al callback del padre con el plan creado (ya incluye el menú asignado si se seleccionó)
        // El padre solo necesita actualizar la lista, no crear el plan de nuevo
        onCreatePlan(newPlan);
        
        // Reset form
        setFormData({
          peso_actual: "",
          altura: "",
          edad: "",
          genero: "",
          peso_saludable: "",
          peso_objetivo: "",
          requerimiento_energetico: "",
          imc: "",
          tmb: "",
          factor_actividad: "",
          proteinas_gramos_f2: "",
          proteinas_calorias_f2: "",
          proteinas_amdr_f2: "",
          proteinas_avb_gramos: "",
          proteinas_avb_porcentaje: "",
          proteinas_kg_peso: "",
          grasas_gramos_f2: "",
          grasas_calorias_f2: "",
          grasas_amdr_f2: "",
          grasas_gs_gramos: "",
          grasas_gs_amdr: "",
          grasas_gm_gramos: "",
          grasas_gm_amdr: "",
          grasas_gp_gramos: "",
          grasas_gp_amdr: "",
          grasas_colesterol: "",
          cho_gramos_f2: "",
          cho_calorias_f2: "",
          cho_amdr_f2: "",
          cho_concent_gramos: "",
          cho_concent_amdr: "",
          total_calorias_f2: "",
          total_amdr_f2: "",
          total_fibra: "",
          peso_referencia_f2: "",
          grupos_alimentos_f3: GRUPOS_ALIMENTOS.reduce((acc, grupo) => {
            acc[grupo] = { porciones: "" };
            return acc;
          }, {} as Record<string, any>),
          nombre_plan: "",
          descripcion: "",
          categoria: "",
          color: "primary",
          duracion: "",
          comidas_dia: "3",
          desayuno: "",
          media_manana: "",
          almuerzo: "",
          media_tarde: "",
          cena: "",
          snack_nocturno: "",
          observaciones: "",
          weekly_menu_id: ""
        });
        setCurrentPhase(1);
        setCompletedPhases([]);
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo crear el plan",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating plan:", error);
      toast({
        title: "Error",
        description: "Error al crear el plan nutricional",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Plan Nutricional</DialogTitle>
          <DialogDescription>
            Completa las 4 fases para crear un plan nutricional completo
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Fase {currentPhase} de {PHASES.length}</span>
            <span>{Math.round((currentPhase / PHASES.length) * 100)}% completado</span>
          </div>
          <Progress value={(currentPhase / PHASES.length) * 100} />
        </div>

        {/* Phase Indicators */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {PHASES.map((phase) => {
            const Icon = phase.icon;
            const isActive = currentPhase === phase.id;
            const isCompleted = completedPhases.includes(phase.id);
            
            return (
              <div
                key={phase.id}
                className={`flex flex-col items-center p-2 rounded-lg border-2 transition-colors ${
                  isActive
                    ? "border-primary bg-primary/10"
                    : isCompleted
                    ? "border-green-500 bg-green-50"
                    : "border-muted bg-muted/50"
                }`}
              >
                <Icon className={`h-5 w-5 mb-1 ${
                  isActive ? "text-primary" : isCompleted ? "text-green-600" : "text-muted-foreground"
                }`} />
                <span className={`text-xs text-center font-medium ${
                  isActive ? "text-primary" : isCompleted ? "text-green-600" : "text-muted-foreground"
                }`}>
                  {phase.id}
                </span>
                {isCompleted && (
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-1" />
                )}
              </div>
            );
          })}
        </div>

        <div>
          {/* Phase 1: Requerimiento Energético y Peso Saludable */}
          {currentPhase === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  {currentPhaseData.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{currentPhaseData.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="peso_actual">Peso Actual (kg)</Label>
                    <Input
                      id="peso_actual"
                      type="number"
                      step="0.1"
                      value={formData.peso_actual}
                      onChange={(e) => {
                        handleChange("peso_actual", e.target.value);
                        calculateIMC(e.target.value, formData.altura);
                      }}
                      placeholder="70.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="altura">Altura (cm)</Label>
                    <Input
                      id="altura"
                      type="number"
                      step="0.1"
                      value={formData.altura}
                      onChange={(e) => {
                        handleChange("altura", e.target.value);
                        calculateIMC(formData.peso_actual, e.target.value);
                      }}
                      placeholder="170"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edad">Edad</Label>
                    <Input
                      id="edad"
                      type="number"
                      value={formData.edad}
                      onChange={(e) => {
                        handleChange("edad", e.target.value);
                        calculateTMB(formData.peso_objetivo || formData.peso_actual, e.target.value, formData.genero);
                      }}
                      placeholder="30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="genero">Género</Label>
                    <Select value={formData.genero} onValueChange={(value) => {
                      handleChange("genero", value);
                      calculateTMB(formData.peso_objetivo || formData.peso_actual, formData.edad, value);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="femenino">Femenino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="factor_actividad">Factor de Actividad</Label>
                    <Input
                      id="factor_actividad"
                      type="number"
                      step="0.1"
                      value={formData.factor_actividad}
                      onChange={(e) => {
                        handleChange("factor_actividad", e.target.value);
                        calculateRequerimientoEnergetico(formData.tmb, e.target.value);
                      }}
                      placeholder="1.5"
                    />
                    <p className="text-xs text-muted-foreground">Referencia: Sedentario 1.2, Activo 1.5, Muy activo 1.7</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="peso_objetivo">Peso Objetivo (kg)</Label>
                    <Input
                      id="peso_objetivo"
                      type="number"
                      step="0.1"
                      value={formData.peso_objetivo}
                      onChange={(e) => {
                        handleChange("peso_objetivo", e.target.value);
                        calculateTMB(e.target.value || formData.peso_actual, formData.edad, formData.genero);
                      }}
                      placeholder="65.0"
                    />
                  </div>
                </div>
                
                {/* Campos calculados */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="imc">IMC</Label>
                    <Input
                      id="imc"
                      type="number"
                      step="0.01"
                      value={formData.imc}
                      readOnly
                      className="bg-muted"
                      placeholder="21.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="peso_saludable">Peso Saludable (kg)</Label>
                    <Input
                      id="peso_saludable"
                      type="number"
                      step="0.1"
                      value={formData.peso_saludable}
                      readOnly
                      className="bg-muted"
                      placeholder="72.3"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tmb">TMR FAO/Schofield (kcal)</Label>
                    <Input
                      id="tmb"
                      type="number"
                      step="0.1"
                      value={formData.tmb}
                      readOnly
                      className="bg-muted"
                      placeholder="1650.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requerimiento_energetico">Requerimiento Energético (kcal)</Label>
                    <Input
                      id="requerimiento_energetico"
                      type="number"
                      step="0.1"
                      value={formData.requerimiento_energetico}
                      readOnly
                      className="bg-muted"
                      placeholder="2475.8"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Phase 2: Fórmula Sintética de Consumo y Planeada */}
          {currentPhase === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  {currentPhaseData.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{currentPhaseData.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tabla de Resumen */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-cyan-200 text-black">
                        <th className="border border-cyan-300 p-2 text-center font-semibold">Kcal</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">Prot</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">Grasa</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">GS</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">GM</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">GP</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">COL</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">CHOS</th>
                        <th className="border border-cyan-300 p-2 text-center font-semibold">Fibra</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-cyan-50">
                        <td className="border border-cyan-200 p-2 text-center font-medium">{formData.total_calorias_f2 || formData.requerimiento_energetico || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center">{formData.proteinas_gramos_f2 || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center">{formData.grasas_gramos_f2 || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center">{formData.grasas_gs_gramos || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center">{formData.grasas_gm_gramos || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center">{formData.grasas_gp_gramos || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center font-medium">
                          {formData.grasas_colesterol ? parseFloat(formData.grasas_colesterol).toFixed(0) : "---"}
                        </td>
                        <td className="border border-cyan-200 p-2 text-center">{formData.cho_gramos_f2 || "---"}</td>
                        <td className="border border-cyan-200 p-2 text-center font-medium">
                          {formData.total_fibra ? parseFloat(formData.total_fibra).toFixed(1) : "---"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Tabla Detallada */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-teal-600 text-black">
                        <th className="border border-teal-300 p-2 text-left font-semibold">Nutrientes</th>
                        <th className="border border-teal-300 p-2 text-center font-semibold">Gramos</th>
                        <th className="border border-teal-300 p-2 text-center font-semibold">Calorías</th>
                        <th className="border border-teal-300 p-2 text-center font-semibold">% AMDR</th>
                        <th className="border border-teal-300 p-2 text-center font-semibold" colSpan={2}>Otros</th>
                      </tr>
                      <tr className="bg-teal-50 text-black">
                        <th className="border border-teal-300 p-1"></th>
                        <th className="border border-teal-300 p-1"></th>
                        <th className="border border-teal-300 p-1"></th>
                        <th className="border border-teal-300 p-1"></th>
                        <th className="border border-teal-300 p-1 text-xs">Métrica</th>
                        <th className="border border-teal-300 p-1 text-xs">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Proteínas */}
                      <tr className="bg-white">
                        <td className="border border-teal-200 p-2 font-medium">Proteínas</td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_gramos_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                            placeholder="127.5"
                          />
                        </td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_calorias_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                            placeholder="510"
                          />
                        </td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_amdr_f2}
                            onChange={(e) => {
                              handleChange("proteinas_amdr_f2", e.target.value);
                              setTimeout(() => calculateFase2Values(), 0);
                            }}
                            className="h-8 text-center text-sm bg-white"
                            placeholder="20"
                          />
                        </td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50" colSpan={2}>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-right">% AVB:</div>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.proteinas_avb_porcentaje}
                              onChange={(e) => {
                                handleChange("proteinas_avb_porcentaje", e.target.value);
                                setTimeout(() => calculateFase2Values(), 0);
                              }}
                              className="h-6 text-xs bg-white"
                              placeholder="50"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-2 font-medium"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50" colSpan={2}>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-right">g AVB:</div>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.proteinas_avb_gramos}
                              readOnly
                              className="h-6 text-xs bg-muted"
                              placeholder="63.8"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-2 font-medium"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50" colSpan={2}>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-right">g/kg/peso:</div>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.proteinas_kg_peso}
                              onChange={(e) => {
                                handleChange("proteinas_kg_peso", e.target.value);
                                setTimeout(() => calculateFase2Values(), 0);
                              }}
                              className="h-6 text-xs bg-white"
                              placeholder="1.7"
                            />
                          </div>
                        </td>
                      </tr>
                      {/* Grasas */}
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-2 font-medium">Grasas</td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gramos_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                            placeholder="75.9"
                          />
                        </td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_calorias_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                            placeholder="683"
                          />
                        </td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_amdr_f2}
                            onChange={(e) => {
                              handleChange("grasas_amdr_f2", e.target.value);
                              setTimeout(() => calculateFase2Values(), 0);
                            }}
                            className="h-8 text-center text-sm bg-white"
                            placeholder="25"
                          />
                        </td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50" colSpan={2}>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-right">g GS:</div>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.grasas_gs_gramos}
                              readOnly
                              className="h-6 text-xs bg-muted"
                              placeholder="25.0"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-2 font-medium"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50" colSpan={2}>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-right">%AMDR GS:</div>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.grasas_gs_amdr}
                              onChange={(e) => {
                                handleChange("grasas_gs_amdr", e.target.value);
                                setTimeout(() => calculateFase2Values(), 0);
                              }}
                              className="h-6 text-xs bg-white"
                              placeholder="8"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-2 font-medium"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50" colSpan={2}>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-right">g GM:</div>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.grasas_gm_gramos}
                              readOnly
                              className="h-6 text-xs bg-muted"
                              placeholder="25.0"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-2 font-medium"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50" colSpan={2}>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-right">g GP:</div>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.grasas_gp_gramos}
                              readOnly
                              className="h-6 text-xs bg-muted"
                              placeholder="25.0"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-2 font-medium"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50" colSpan={2}>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-right">%AMDR GP:</div>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.grasas_gp_amdr}
                              onChange={(e) => {
                                handleChange("grasas_gp_amdr", e.target.value);
                                setTimeout(() => calculateFase2Values(), 0);
                              }}
                              className="h-6 text-xs bg-white"
                              placeholder="8"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-2 font-medium"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50" colSpan={2}>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-right">Colesterol (mg):</div>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.grasas_colesterol}
                              onChange={(e) => {
                                handleChange("grasas_colesterol", e.target.value);
                              }}
                              className="h-6 text-xs bg-white"
                              placeholder="300"
                            />
                          </div>
                        </td>
                      </tr>
                      {/* Carbohidratos */}
                      <tr className="bg-white">
                        <td className="border border-teal-200 p-2 font-medium">CHOs</td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_gramos_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                            placeholder="382.5"
                          />
                        </td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_calorias_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                            placeholder="1530"
                          />
                        </td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_amdr_f2}
                            onChange={(e) => {
                              handleChange("cho_amdr_f2", e.target.value);
                              setTimeout(() => calculateFase2Values(), 0);
                            }}
                            className="h-8 text-center text-sm bg-white"
                            placeholder="60"
                          />
                        </td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50" colSpan={2}>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-right">CHO Concent %AMDR:</div>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.cho_concent_amdr}
                              onChange={(e) => {
                                handleChange("cho_concent_amdr", e.target.value);
                                setTimeout(() => calculateFase2Values(), 0);
                              }}
                              className="h-6 text-xs bg-white"
                              placeholder="10"
                            />
                          </div>
                        </td>
                      </tr>
                      {/* Total */}
                      <tr className="bg-teal-100">
                        <td className="border border-teal-200 p-2 font-medium">Total</td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.total_calorias_f2}
                            readOnly
                            className="h-8 text-center text-sm font-semibold bg-muted"
                            placeholder="2723"
                          />
                        </td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.total_amdr_f2}
                            readOnly
                            className="h-8 text-center text-sm font-semibold bg-muted"
                            placeholder="100.0"
                          />
                        </td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50" colSpan={2}>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-right font-medium">Fibra (g):</div>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.total_fibra}
                              onChange={(e) => {
                                handleChange("total_fibra", e.target.value);
                              }}
                              className="h-6 text-xs bg-white"
                              placeholder="14"
                            />
                          </div>
                        </td>
                      </tr>
                      {/* Peso Referencia */}
                      <tr className="bg-teal-50">
                        <td className="border border-teal-200 p-2 font-medium">Kg Ref</td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.peso_referencia_f2 || formData.peso_objetivo}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                            placeholder="75"
                          />
                        </td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1"></td>
                        <td className="border border-teal-200 p-1" colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Phase 3: Fórmula Sintética Desarrollada - Tabla simplificada */}
          {currentPhase === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {currentPhaseData.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{currentPhaseData.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border border-blue-800 bg-blue-900 text-white p-3 text-left font-bold sticky left-0 z-20 shadow-md min-w-[300px]">
                          Grupo de alimentos
                        </th>
                        <th className="border border-green-600 bg-green-700 text-white p-3 text-center font-bold">
                          Porciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {GRUPOS_ALIMENTOS.map((grupo, index) => {
                        const grupoData = formData.grupos_alimentos_f3[grupo] || {};
                        const isEven = index % 2 === 0;
                        
                        return (
                          <tr key={grupo} className={`transition-colors hover:bg-gray-100 ${isEven ? "bg-green-50" : "bg-blue-50"}`}>
                            <td className="border border-gray-300 p-3 font-semibold text-gray-800 sticky left-0 z-10 bg-inherit shadow-sm min-w-[300px]">
                              {grupo}
                            </td>
                            <td className="border border-gray-200 p-2">
                              <Input
                                type="number"
                                step="0.1"
                                value={grupoData.porciones || ""}
                                onChange={(e) => {
                                  const newData = { ...formData.grupos_alimentos_f3 };
                                  if (!newData[grupo]) newData[grupo] = {};
                                  newData[grupo].porciones = e.target.value;
                                  handleChange("grupos_alimentos_f3", newData);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                  }
                                }}
                                className="h-9 text-sm text-center bg-white border-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 w-24 font-medium"
                                placeholder="0,0"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Phase 4: Minuta Patrón */}
          {currentPhase === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-primary" />
                  {currentPhaseData.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{currentPhaseData.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre_plan">Nombre del Plan</Label>
                    <Input
                      id="nombre_plan"
                      value={formData.nombre_plan}
                      onChange={(e) => handleChange("nombre_plan", e.target.value)}
                      placeholder="Plan Nutricional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duracion">Duración</Label>
                    <Input
                      id="duracion"
                      value={formData.duracion}
                      onChange={(e) => handleChange("duracion", e.target.value)}
                      placeholder="4 semanas"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) => handleChange("descripcion", e.target.value)}
                    placeholder="Descripción del plan nutricional..."
                    rows={3}
                  />
                </div>

                {/* Asignar Menú Semanal */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="weekly_menu">Menú Semanal (Opcional)</Label>
                  {loadingMenus ? (
                    <div className="text-sm text-muted-foreground">Cargando menús disponibles...</div>
                  ) : (
                    <Select 
                      value={formData.weekly_menu_id} 
                      onValueChange={(value) => handleChange("weekly_menu_id", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar menú semanal (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin menú semanal</SelectItem>
                        {weeklyMenus.map((menu) => (
                          <SelectItem key={menu.id} value={menu.id.toString()}>
                            {menu.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {formData.weekly_menu_id && (
                    (() => {
                      const selectedMenu = weeklyMenus.find(m => m.id.toString() === formData.weekly_menu_id);
                      return selectedMenu ? (
                        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 mt-2">
                          <div className="flex justify-between">
                            <span className="font-semibold">{selectedMenu.name}</span>
                            {selectedMenu.category && (
                              <Badge variant="outline">{selectedMenu.category}</Badge>
                            )}
                          </div>
                          {selectedMenu.description && (
                            <p className="text-sm text-muted-foreground">{selectedMenu.description}</p>
                          )}
                          <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                            {selectedMenu.total_calories && (
                              <span className="flex items-center gap-1">
                                <Flame className="h-3 w-3" /> {selectedMenu.total_calories} kcal
                              </span>
                            )}
                            {selectedMenu.assigned_patients !== undefined && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" /> {selectedMenu.assigned_patients} asignados
                              </span>
                            )}
                          </div>
                        </div>
                      ) : null;
                    })()
                  )}
                  <p className="text-xs text-muted-foreground">
                    Puedes asignar un menú semanal existente a este plan nutricional. Si no seleccionas uno, podrás asignarlo más tarde.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <DialogFooter className="mt-6">
            <div className="flex justify-between w-full">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentPhase === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <div className="flex gap-2">
                {currentPhase < 4 ? (
                  <Button type="button" onClick={handleNext}>
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit}>
                    Crear Plan
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
