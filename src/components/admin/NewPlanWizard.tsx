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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, CheckCircle2, Calculator, ClipboardList, FileText, Utensils, Flame, Users, Clock, AlertCircle } from "lucide-react";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { FOOD_NUTRIENTS } from "@/lib/foodNutrients";

interface NewPlanWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePlan: (planData: any) => void;
  patientId?: number;
}

const PHASES = [
  {
    id: 1,
    title: "REQUERIMIENTO ENERGÉTICO Y PESO SALUDABLE",
    icon: Calculator,
    description: "Calcula las necesidades energéticas, peso saludable y peso ajustado"
  },
  {
    id: 2,
    title: "FÓRMULA SINTÉTICA PLANEADA",
    icon: ClipboardList,
    description: "Define la distribución de macronutrientes (AMDR) y micronutrientes"
  },
  {
    id: 3,
    title: "FÓRMULA SINTÉTICA DESARROLLADA",
    icon: FileText,
    description: "Distribución por grupos de alimentos y cálculo de nutrientes totales"
  },
  {
    id: 4,
    title: "MINUTA PATRÓN Y DETALLE DE INGREDIENTES",
    icon: Utensils,
    description: "Especifica los gramos de cada ingrediente para el paciente"
  }
];

// Grupos de alimentos dinámicos desde FOOD_NUTRIENTS
const GRUPOS_ALIMENTOS = Object.keys(FOOD_NUTRIENTS);

export function NewPlanWizard({ open, onOpenChange, onCreatePlan, patientId }: NewPlanWizardProps) {
  const [currentPhase, setCurrentPhase] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [formData, setFormData] = useState({
    // Fase 1: Requerimiento Energético y Peso Saludable
    peso_actual: "",
    altura: "",
    edad: "",
    genero: "",
    peso_saludable: "",
    peso_ajustado: "",
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
    cho_kg_peso: "",

    // Fase 3: Grupos de Alimentos - Detalles completos
    grupos_alimentos_f3: GRUPOS_ALIMENTOS.reduce((acc, grupo) => {
      acc[grupo] = {
        porciones: "",
        kcal: 0,
        prot: 0,
        grasa: 0,
        gs: 0,
        gm: 0,
        gp: 0,
        col: 0,
        chos: 0,
        fd: 0,
        calcio: 0,
        p: 0,
        fe: 0,
        na: 0,
        k: 0,
        mg: 0,
        zn: 0,
        cu: 0
      };
      return acc;
    }, {} as Record<string, any>),

    totals_f3: {
      kcal: 0,
      prot: 0,
      grasa: 0,
      gs: 0,
      gm: 0,
      gp: 0,
      col: 0,
      chos: 0,
      fd: 0,
      calcio: 0,
      p: 0,
      fe: 0,
      na: 0,
      k: 0,
      mg: 0,
      zn: 0,
      cu: 0
    },

    // Fase 4: Minuta Patrón e Ingredientes
    nombre_plan: "",
    descripcion: "",
    categoria: "",
    color: "primary",
    duracion: "",
    comidas_dia: "3",
    ingredientes_f4: {} as Record<string, any>, // [DayName][MealType][IngredientName] = grams
    observaciones: "",
    weekly_menu_id: ""
  });

  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [weeklyMenus, setWeeklyMenus] = useState<any[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [detailedMenu, setDetailedMenu] = useState<any>(null);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const { toast } = useToast();

  const currentPhaseData = PHASES.find(p => p.id === currentPhase) || PHASES[0];

  const computeTmbValue = (pesoValue: string, edadValue: string, generoValue: string) => {
    const peso = parseFloat(pesoValue);
    const edad = parseFloat(edadValue);
    const genero = generoValue;

    if (isNaN(peso) || isNaN(edad) || peso <= 0 || edad <= 0 || !genero) {
      return null;
    }

    let tmb = 0;
    if (genero === "masculino") {
      if (edad >= 18 && edad <= 30) {
        tmb = (15.057 * peso) + 692.2;
      } else if (edad >= 31 && edad <= 60) {
        tmb = (11.472 * peso) + 873.1;
      } else if (edad > 60) {
        tmb = (11.711 * peso) + 587.7;
      }
    } else if (genero === "femenino") {
      if (edad >= 18 && edad <= 30) {
        tmb = (14.818 * peso) + 486.6;
      } else if (edad >= 31 && edad <= 60) {
        tmb = (8.126 * peso) + 845.6;
      } else if (edad > 60) {
        tmb = (9.082 * peso) + 658.5;
      }
    }

    return tmb;
  };

  const computeAgeYears = (fechaNacimiento?: string | null) => {
    if (!fechaNacimiento) return "";
    const birth = new Date(fechaNacimiento);
    if (Number.isNaN(birth.getTime())) return "";
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      years -= 1;
    }
    return years > 0 ? String(years) : "";
  };

  const mapNivelActividadToPAL = (nivelActividad?: string | null) => {
    if (!nivelActividad) return "";
    const v = String(nivelActividad).toLowerCase();
    if (v.includes("sed")) return "1.53";
    if (v.includes("mod")) return "1.76";
    if (v.includes("vig") || v.includes("alto") || v.includes("intens")) return "2.25";
    return "";
  };

  const fetchPatientAndPrefill = async (pid: number) => {
    setLoadingPatient(true);
    try {
      const response = await fetch(`${API_URL}/patients/${pid}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.detail || "No se pudo cargar el paciente");
      }
      const patient = await response.json();

      const pesoActual = patient?.peso_actual != null ? String(patient.peso_actual) : "";
      const altura = patient?.altura != null ? String(patient.altura) : "";
      const genero = patient?.genero ? String(patient.genero).toLowerCase() : "";
      const edad = computeAgeYears(patient?.fecha_nacimiento);
      const pal = mapNivelActividadToPAL(patient?.nivel_actividad);
      const pesoObjetivo = patient?.peso_objetivo != null ? String(patient.peso_objetivo) : "";

      setFormData((prev: any) => {
        const next = {
          ...prev,
          peso_actual: pesoActual,
          altura,
          genero,
          edad,
          peso_objetivo: pesoObjetivo,
          peso_referencia_f2: pesoObjetivo,
          factor_actividad: patient?.pal_factor ? String(patient.pal_factor) : (pal || "1.55"), // Priorizar manual, luego mapeado, luego default
        };
        return next;
      });

      // Disparar cálculos con valores locales (evitar estado desfasado)
      const tmbComputed = computeTmbValue(pesoObjetivo, edad, genero);
      if (pesoActual && altura) {
        calculateIMC(pesoActual, altura);
      }
      if (pesoObjetivo && edad && genero) {
        calculateTMB(pesoObjetivo, edad, genero);
      }
      if (pal && tmbComputed != null) {
        calculateRequerimientoEnergetico(String(tmbComputed), pal);
      }
    } catch (error: any) {
      console.error("Error prefill patient:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo autocompletar con los datos del paciente",
        variant: "destructive",
      });
    } finally {
      setLoadingPatient(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    // Resetear a fase 1 al abrir
    setCurrentPhase(1);
    setCompletedPhases([]);
    if (typeof patientId === "number") {
      fetchPatientAndPrefill(patientId);
    }
  }, [open, patientId]);

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

  const fetchRecipeById = async (recipeId: number) => {
    try {
      const response = await fetch(`${API_URL}/recipes/${recipeId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error(`Error fetching recipe ${recipeId}:`, error);
    }
    return null;
  };

  const fetchDetailedMenu = async (menuId: string) => {
    if (!menuId || menuId === "__none__") {
      setDetailedMenu(null);
      return;
    }

    console.log("🔍 Cargando menú detallado:", menuId);
    setLoadingRecipes(true);
    try {
      const response = await fetch(`${API_URL}/weekly-menus/${menuId}`);
      if (!response.ok) throw new Error("Error en la respuesta del servidor");

      const menu = await response.json();
      console.log("📦 Menú base cargado:", menu);

      if (!menu.week || !Array.isArray(menu.week)) {
        console.error("❌ El menú no tiene una estructura de semanas válida:", menu);
        setLoadingRecipes(false);
        return;
      }

      // Enriquecer el menú con detalles de recetas
      const enrichedWeek = await Promise.all(menu.week.map(async (day: any) => {
        if (!day.meals || !Array.isArray(day.meals)) return day;

        const enrichedMeals = await Promise.all(day.meals.map(async (meal: any) => {
          // Soporte para ambos formatos de ID de receta
          const rId = meal.recipe_id || meal.recipeId || meal.id_receta;
          if (rId) {
            console.log(`🧪 Buscando receta ${rId} para ${meal.type}...`);
            const recipeDetails = await fetchRecipeById(rId);

            // Asegurar que ingredients sea array
            if (recipeDetails && typeof recipeDetails.ingredients === "string") {
              try {
                recipeDetails.ingredients = JSON.parse(recipeDetails.ingredients);
              } catch (e) {
                console.error(`Error parsing ingredients for recipe ${rId}:`, e);
                recipeDetails.ingredients = [];
              }
            }

            return { ...meal, recipe_id: rId, recipeDetails };
          }
          return meal;
        }));
        return { ...day, meals: enrichedMeals };
      }));

      // Si el menú solo tiene 7 días (1 semana), expandirlo a 28 días (4 semanas) para permitir
      // configurar los ingredientes de todo el mes.
      let finalWeek = enrichedWeek;
      if (enrichedWeek.length === 7) {
        finalWeek = [...enrichedWeek, ...enrichedWeek, ...enrichedWeek, ...enrichedWeek];
      }

      const fullEnrichedMenu = { ...menu, week: finalWeek };
      setDetailedMenu(fullEnrichedMenu);
      console.log("✅ Menú enriquecido satisfactoriamente:", fullEnrichedMenu);

      // Inicializar ingredientes_f4 de forma inteligente preservando los existentes
      const currentIngredients = { ...formData.ingredientes_f4 };
      const initialIngredients: Record<string, any> = { ...currentIngredients };

      finalWeek.forEach((day: any, dayIdx: number) => {
        if (!initialIngredients[dayIdx]) initialIngredients[dayIdx] = {};

        day.meals.forEach((meal: any, mealIdx: number) => {
          // Intentar obtener por Tipo y también por Índice (retrocompatibilidad)
          const mealKey = meal.type || mealIdx.toString();
          if (!initialIngredients[dayIdx][mealKey]) initialIngredients[dayIdx][mealKey] = {};

          if (meal.recipeDetails?.ingredients && Array.isArray(meal.recipeDetails.ingredients)) {
            meal.recipeDetails.ingredients.forEach((ing: string) => {
              // SOLO inicializar a vacío si no existe ya un valor (para no borrar lo que el usuario escribió)
              if (initialIngredients[dayIdx][mealKey][ing] === undefined) {
                initialIngredients[dayIdx][mealKey][ing] = "";
              }
            });
          }
        });
      });
      handleChange("ingredientes_f4", initialIngredients);
    } catch (error) {
      console.error("Error fetching detailed menu:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles del menú. Verifique su conexión y las recetas.",
        variant: "destructive"
      });
    } finally {
      setLoadingRecipes(false);
    }
  };

  useEffect(() => {
    if (formData.weekly_menu_id) {
      fetchDetailedMenu(formData.weekly_menu_id);
    } else {
      setDetailedMenu(null);
    }
  }, [formData.weekly_menu_id]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Calcular IMC
  // Actualizar gramos de ingredientes
  const updateIngredientGrams = (dayIdx: number, mealType: string, ingredient: string, grams: string) => {
    setFormData(prev => ({
      ...prev,
      ingredientes_f4: {
        ...prev.ingredientes_f4,
        [dayIdx]: {
          ...(prev.ingredientes_f4[dayIdx] || {}),
          [mealType]: {
            ...(prev.ingredientes_f4[dayIdx]?.[mealType] || {}),
            [ingredient]: grams
          }
        }
      }
    }));
  };

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

    // El peso de referencia para TMB según Excel es el peso de referencia (WeightActual o PA)
    // Pero aquí usamos el peso que se nos pase
    let tmb = 0;

    if (genero === "masculino") {
      if (edad >= 18 && edad <= 30) {
        tmb = (15.057 * peso) + 692.2;
      } else if (edad >= 31 && edad <= 60) {
        tmb = (11.472 * peso) + 873.1;
      } else if (edad > 60) {
        tmb = (11.711 * peso) + 587.7;
      }
    } else if (genero === "femenino") {
      if (edad >= 18 && edad <= 30) {
        tmb = (14.818 * peso) + 486.6;
      } else if (edad >= 31 && edad <= 60) {
        tmb = (8.126 * peso) + 845.6;
      } else if (edad > 60) {
        tmb = (9.082 * peso) + 658.5;
      }
    }

    handleChange("tmb", tmb.toFixed(2));

    // Calcular requerimiento energético después de calcular TMB
    calculateRequerimientoEnergetico(tmb.toString(), formData.factor_actividad);
  };

  // Calcular Peso Saludable y Peso Ajustado
  const calculatePesoSaludable = (alturaValue: string, imcValue: string, pesoActualValue: string) => {
    const altura = parseFloat(alturaValue);
    const imc = parseFloat(imcValue);
    const pesoActual = parseFloat(pesoActualValue);

    if (isNaN(altura) || isNaN(imc) || altura <= 0) {
      handleChange("peso_saludable", "");
      handleChange("peso_ajustado", "");
      return;
    }

    const alturaMetros = altura / 100;
    // PS = 25 * (Talla m^2)
    const pesoSaludable = 25 * (alturaMetros * alturaMetros);
    handleChange("peso_saludable", pesoSaludable.toFixed(2));

    // PA = (PesoActual - PS) * 0.25 + PS
    const pesoAjustado = ((pesoActual - pesoSaludable) * 0.25) + pesoSaludable;
    handleChange("peso_ajustado", pesoAjustado.toFixed(2));

    // Peso de referencia automático: SIEMPRE usar Peso Objetivo
    handleChange("peso_referencia_f2", formData.peso_objetivo);
  };

  // Calcular Requerimiento Energético
  const calculateRequerimientoEnergetico = (tmbValue: string, factorValue: string) => {
    const tmb = parseFloat(tmbValue);
    const factor = parseFloat(factorValue);

    if (isNaN(tmb) || isNaN(factor) || tmb <= 0 || factor <= 0) {
      handleChange("requerimiento_energetico", "");
      return;
    }

    // Excel usa TMR * PAL
    const requerimiento = tmb * factor;
    handleChange("requerimiento_energetico", Math.round(requerimiento).toString());
  };

  // Calcular valores de Fase 2
  const calculateFase2Values = () => {
    const totalCalorias = parseFloat(formData.requerimiento_energetico) || 0;
    if (totalCalorias <= 0) return;

    // Obtener valores primarios (inputs)
    const grasasAMDR_Input = parseFloat(formData.grasas_amdr_f2) || 0;
    const proteinasKgPeso_Input = parseFloat(formData.proteinas_kg_peso) || 0;
    const pesoRef = parseFloat(formData.peso_referencia_f2 || formData.peso_objetivo) || 0;

    // 1. Calcular Proteína % AMDR basado en g/kg/peso
    let proteinasAMDR_Calc = 0;
    if (totalCalorias > 0 && pesoRef > 0) {
      proteinasAMDR_Calc = (proteinasKgPeso_Input * pesoRef * 4) / totalCalorias * 100;
    }

    // REDONDEO CRÍTICO para coherencia en UI (1 decimal)
    const pAMDRFinal = parseFloat(proteinasAMDR_Calc.toFixed(1));
    const gAMDRFinal = parseFloat(grasasAMDR_Input.toFixed(1));

    // 2. CHO % AMDR es el remanente de 100 (permitir negativos por balance clínico)
    const cAMDRFinal = 100 - pAMDRFinal - gAMDRFinal;

    // Calcular calorías basadas en los porcentajes finales
    const proteinasCalorias = (totalCalorias * pAMDRFinal) / 100;
    const grasasCalorias = (totalCalorias * gAMDRFinal) / 100;
    const choCalorias = (totalCalorias * cAMDRFinal) / 100;

    // Calcular gramos
    const proteinasGramos = proteinasCalorias / 4;
    const grasasGramos = grasasCalorias / 9;
    const choGramos = choCalorias / 4;
    const choKgPeso_Calc = pesoRef > 0 ? (choGramos / pesoRef) : 0;

    // Otros campos detallados
    const grasasGS_AMDR = parseFloat(formData.grasas_gs_amdr) || 0;
    const grasasGP_AMDR = parseFloat(formData.grasas_gp_amdr) || 0;
    const choConcent_AMDR = parseFloat(formData.cho_concent_amdr) || 0;
    const proteinasAVB_Pct = parseFloat(formData.proteinas_avb_porcentaje) || 0;

    const grasasGSCalorias = (totalCalorias * grasasGS_AMDR) / 100;
    const grasasGSCaloriasResto = grasasCalorias - grasasGSCalorias;
    const grasasGPCalorias = (totalCalorias * grasasGP_AMDR) / 100;
    const grasasGMCalorias = grasasGSCaloriasResto - grasasGPCalorias;

    const grasasGSGramos = grasasGSCalorias / 9;
    const grasasGMGramos = grasasGMCalorias / 9;
    const grasasGPGramos = grasasGPCalorias / 9;
    const grasasGM_AMDR = gAMDRFinal - grasasGS_AMDR - grasasGP_AMDR;

    const proteinasAVBGramos = (proteinasGramos * proteinasAVB_Pct) / 100;
    const choConcentGramos = (totalCalorias * choConcent_AMDR) / 100 / 4;

    const totalAMDR = pAMDRFinal + gAMDRFinal + cAMDRFinal;

    // Actualizar estados
    handleChange("proteinas_amdr_f2", pAMDRFinal.toFixed(1));
    handleChange("proteinas_calorias_f2", proteinasCalorias.toFixed(1));
    handleChange("proteinas_gramos_f2", proteinasGramos.toFixed(1));
    handleChange("grasas_calorias_f2", grasasCalorias.toFixed(1));
    handleChange("grasas_gramos_f2", grasasGramos.toFixed(1));
    handleChange("grasas_gm_amdr", grasasGM_AMDR.toFixed(1));
    handleChange("cho_amdr_f2", cAMDRFinal.toFixed(1));
    handleChange("cho_calorias_f2", choCalorias.toFixed(1));
    handleChange("cho_gramos_f2", choGramos.toFixed(1));
    handleChange("cho_kg_peso", choKgPeso_Calc.toFixed(2));
    handleChange("grasas_gs_gramos", grasasGSGramos.toFixed(1));
    handleChange("grasas_gm_gramos", grasasGMGramos.toFixed(1));
    handleChange("grasas_gp_gramos", grasasGPGramos.toFixed(1));
    handleChange("proteinas_avb_gramos", proteinasAVBGramos.toFixed(1));
    handleChange("cho_concent_gramos", choConcentGramos.toFixed(1));
    handleChange("total_calorias_f2", totalCalorias.toFixed(1));
    handleChange("total_amdr_f2", totalAMDR.toFixed(1));
  };

  // Calcular totales de Fase 3
  const calculateFase3Totals = (updatedGrupos?: Record<string, any>) => {
    const grupos = updatedGrupos || formData.grupos_alimentos_f3;
    const totals = {
      kcal: 0, prot: 0, grasa: 0, gs: 0, gm: 0, gp: 0, col: 0, chos: 0, fd: 0,
      calcio: 0, p: 0, fe: 0, na: 0, k: 0, mg: 0, zn: 0, cu: 0
    };

    Object.keys(grupos).forEach(nombre => {
      const data = grupos[nombre];
      const porciones = parseFloat(data.porciones) || 0;
      const nutrients = FOOD_NUTRIENTS[nombre];

      if (nutrients && porciones > 0) {
        totals.kcal += nutrients.kcal * porciones;
        totals.prot += nutrients.prot * porciones;
        totals.grasa += nutrients.grasa * porciones;
        totals.gs += nutrients.gs * porciones;
        totals.gm += nutrients.gm * porciones;
        totals.gp += nutrients.gp * porciones;
        totals.col += nutrients.col * porciones;
        totals.chos += nutrients.chos * porciones;
        totals.fd += nutrients.fd * porciones;
        totals.calcio += (nutrients.calcio || 0) * porciones;
        totals.p += (nutrients.p || 0) * porciones;
        totals.fe += (nutrients.fe || 0) * porciones;
        totals.na += (nutrients.na || 0) * porciones;
        totals.k += (nutrients.k || 0) * porciones;
        totals.mg += (nutrients.mg || 0) * porciones;
        totals.zn += (nutrients.zn || 0) * porciones;
        totals.cu += (nutrients.cu || 0) * porciones;
      }
    });

    handleChange("totals_f3", totals);
  };

  // Manejar cambio en porciones de Fase 3
  const handleFase3PorcionesChange = (nombre: string, value: string) => {
    const porciones = parseFloat(value) || 0;
    const nutrients = FOOD_NUTRIENTS[nombre];

    const newGrupos = {
      ...formData.grupos_alimentos_f3,
      [nombre]: {
        porciones: value,
        kcal: nutrients ? nutrients.kcal * porciones : 0,
        prot: nutrients ? nutrients.prot * porciones : 0,
        grasa: nutrients ? nutrients.grasa * porciones : 0,
        gs: nutrients ? nutrients.gs * porciones : 0,
        gm: nutrients ? nutrients.gm * porciones : 0,
        gp: nutrients ? nutrients.gp * porciones : 0,
        col: nutrients ? nutrients.col * porciones : 0,
        chos: nutrients ? nutrients.chos * porciones : 0,
        fd: nutrients ? nutrients.fd * porciones : 0,
        calcio: nutrients ? (nutrients.calcio || 0) * porciones : 0,
        p: nutrients ? (nutrients.p || 0) * porciones : 0,
        fe: nutrients ? (nutrients.fe || 0) * porciones : 0,
        na: nutrients ? (nutrients.na || 0) * porciones : 0,
        k: nutrients ? (nutrients.k || 0) * porciones : 0,
        mg: nutrients ? (nutrients.mg || 0) * porciones : 0,
        zn: nutrients ? (nutrients.zn || 0) * porciones : 0,
        cu: nutrients ? (nutrients.cu || 0) * porciones : 0,
      }
    };

    handleChange("grupos_alimentos_f3", newGrupos);
    calculateFase3Totals(newGrupos);
  };

  // Efecto para calcular Fase 2 cuando cambian los valores
  useEffect(() => {
    if (currentPhase === 2 && formData.requerimiento_energetico) {
      calculateFase2Values();
    }
  }, [
    currentPhase,
    formData.requerimiento_energetico,
    formData.grasas_amdr_f2,
    formData.grasas_gs_amdr,
    formData.grasas_gp_amdr,
    formData.cho_concent_amdr,
    formData.proteinas_avb_porcentaje,
    formData.proteinas_kg_peso,
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
        peso_ajustado: formData.peso_ajustado,
        peso_objetivo: formData.peso_objetivo,
        requerimiento_energetico: formData.requerimiento_energetico,
        imc: formData.imc,
        tmb: formData.tmb,
        factor_actividad: formData.factor_actividad,
        peso_referencia: formData.peso_referencia_f2
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
        grupos_alimentos: formData.grupos_alimentos_f3,
        totales: formData.totals_f3
      },
      fase_4: {
        nombre_plan: formData.nombre_plan,
        descripcion: formData.descripcion,
        categoria: formData.categoria,
        color: formData.color,
        duracion: formData.duracion,
        comidas_dia: formData.comidas_dia,
        ingredientes_f4: formData.ingredientes_f4,
        observaciones: formData.observaciones,
        weekly_menu_id: formData.weekly_menu_id
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

        // ASIGNACIÓN AUTOMÁTICA AL PACIENTE
        if (patientId) {
          try {
            const startDate = new Date().toISOString().split('T')[0];
            let endDate = null;

            // Calcular fecha de fin basada en la duración (ej. "4 semanas")
            if (formData.duracion && formData.duracion.toLowerCase().includes("semana")) {
              const weeks = parseInt(formData.duracion);
              if (!isNaN(weeks)) {
                const end = new Date();
                end.setDate(end.getDate() + weeks * 7);
                endDate = end.toISOString().split('T')[0];
              }
            }

            const assignResponse = await fetch(`${API_URL}/meal-plans/assign`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                patient_id: patientId,
                meal_plan_id: planId,
                start_date: startDate,
                end_date: endDate,
                notes: "Asignado automáticamente al crear el plan"
              }),
            });

            if (assignResponse.ok) {
              toast({
                title: "¡Asignación Automática!",
                description: `El plan "${formData.nombre_plan}" ha sido asignado al paciente.`,
              });
            }
          } catch (error) {
            console.error("Error in automatic assignment:", error);
          }
        }

        // Reset form
        setFormData({
          peso_actual: "",
          altura: "",
          edad: "",
          genero: "",
          peso_saludable: "",
          peso_ajustado: "",
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
            acc[grupo] = {
              porciones: "", kcal: 0, prot: 0, grasa: 0, gs: 0, gm: 0, gp: 0, col: 0, chos: 0, fd: 0,
              calcio: 0, p: 0, fe: 0, na: 0, k: 0, mg: 0, zn: 0, cu: 0
            };
            return acc;
          }, {} as Record<string, any>),
          totals_f3: {
            kcal: 0, prot: 0, grasa: 0, gs: 0, gm: 0, gp: 0, col: 0, chos: 0, fd: 0,
            calcio: 0, p: 0, fe: 0, na: 0, k: 0, mg: 0, zn: 0, cu: 0
          },
          nombre_plan: "",
          descripcion: "",
          categoria: "",
          color: "primary",
          duracion: "",
          comidas_dia: "3",
          ingredientes_f4: {},
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
                className={`flex flex-col items-center p-2 rounded-lg border-2 transition-colors ${isActive
                  ? "border-primary bg-primary/10"
                  : isCompleted
                    ? "border-green-500 bg-green-50"
                    : "border-muted bg-muted/50"
                  }`}
              >
                <Icon className={`h-5 w-5 mb-1 ${isActive ? "text-primary" : isCompleted ? "text-green-600" : "text-muted-foreground"
                  }`} />
                <span className={`text-xs text-center font-medium ${isActive ? "text-primary" : isCompleted ? "text-green-600" : "text-muted-foreground"
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
                      readOnly
                      className="bg-muted"
                      onChange={(e) => {
                        handleChange("peso_actual", e.target.value);
                        calculateIMC(e.target.value, formData.altura);
                        // Cuando cambia el peso actual, recalculamos PS y PA
                        calculatePesoSaludable(formData.altura, formData.imc, e.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="altura">Altura (cm)</Label>
                    <Input
                      id="altura"
                      type="number"
                      step="0.1"
                      value={formData.altura}
                      readOnly
                      className="bg-muted"
                      onChange={(e) => {
                        handleChange("altura", e.target.value);
                        calculateIMC(formData.peso_actual, e.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edad">Edad</Label>
                    <Input
                      id="edad"
                      type="number"
                      value={formData.edad}
                      readOnly
                      className="bg-muted"
                      onChange={(e) => {
                        handleChange("edad", e.target.value);
                        calculateTMB(formData.peso_objetivo, e.target.value, formData.genero);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="genero">Género</Label>
                    <Select value={formData.genero} disabled onValueChange={(value) => {
                      handleChange("genero", value);
                      // Usar peso de referencia (objetivo) para TMB
                      calculateTMB(formData.peso_referencia_f2, formData.edad, value);
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
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="factor_actividad">Factor de Actividad Física PAL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="factor_actividad"
                        type="number"
                        step="0.01"
                        value={formData.factor_actividad}
                        readOnly
                        className="w-24 bg-muted"
                        onChange={(e) => {
                          handleChange("factor_actividad", e.target.value);
                          calculateRequerimientoEnergetico(formData.tmb, e.target.value);
                        }}
                      />
                      <Select
                        disabled
                        onValueChange={(value) => {
                          handleChange("factor_actividad", value);
                          calculateRequerimientoEnergetico(formData.tmb, value);
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecciona Nivel (Preset)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1.53">Sedentario (1.4 - 1.69) - Valor: 1.53</SelectItem>
                          <SelectItem value="1.76">Moderado (1.7 - 1.99) - Valor: 1.76</SelectItem>
                          <SelectItem value="2.25">Vigoroso (2.0 - 2.4) - Valor: 2.25</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">Escribe un valor manual o selecciona un nivel predefinido.</p>
                  </div>
                </div>

                {/* Campos calculados */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="imc">IMC Actual</Label>
                    <Input
                      id="imc"
                      type="number"
                      step="0.01"
                      value={formData.imc}
                      readOnly
                      className="bg-muted font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="peso_saludable">Peso Saludable (IMC 25) (kg)</Label>
                    <Input
                      id="peso_saludable"
                      type="number"
                      step="0.1"
                      value={formData.peso_saludable}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="peso_ajustado">Peso Ajustado (&gt;30 IMC) (kg)</Label>
                    <Input
                      id="peso_ajustado"
                      type="number"
                      step="0.1"
                      value={formData.peso_ajustado}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  {/*<div className="space-y-2">
                    <Label htmlFor="peso_referencia">Peso de Referencia (Peso Objetivo)</Label>
                    <Input
                      id="peso_referencia"
                      type="number"
                      value={formData.peso_referencia_f2}
                      readOnly
                      className="bg-muted font-bold"
                    />
                  </div>*/}
                  <div className="space-y-2">
                    <Label htmlFor="tmb">TMR FAO/Schofield (kcal)</Label>
                    <Input
                      id="tmb"
                      type="number"
                      step="0.1"
                      value={formData.tmb}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requerimiento_energetico">Requerimiento Total (kcal)</Label>
                    <Input
                      id="requerimiento_energetico"
                      type="number"
                      value={formData.requerimiento_energetico}
                      readOnly
                      className="bg-primary/10 border-primary font-bold text-lg"
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
                        <td className="border border-teal-200 p-2 font-medium" rowSpan={3}>
                          Proteínas
                          <div className="text-[10px] text-teal-600 font-normal">Target: 14-20% AMDR</div>
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={3}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_gramos_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={3}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_calorias_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={3}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_amdr_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted font-bold"
                          />
                        </td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">g AVB</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_avb_gramos}
                            readOnly
                            className="h-6 text-xs bg-muted"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">% AVB</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.proteinas_avb_porcentaje}
                            onChange={(e) => {
                              handleChange("proteinas_avb_porcentaje", e.target.value);
                            }}
                            className="h-6 text-xs bg-white"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">g/kg/peso</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.proteinas_kg_peso}
                            onChange={(e) => {
                              handleChange("proteinas_kg_peso", e.target.value);
                            }}
                            className="h-6 text-xs bg-white font-semibold border-teal-300"
                          />
                        </td>
                      </tr>

                      {/* Grasas */}
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-2 font-medium" rowSpan={7}>
                          Grasas
                          <div className="text-[10px] text-teal-600 font-normal">Target: 20-35% AMDR</div>
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={7}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gramos_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={7}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_calorias_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={7}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_amdr_f2}
                            onChange={(e) => {
                              handleChange("grasas_amdr_f2", e.target.value);
                            }}
                            className="h-8 text-center text-sm bg-white"
                          />
                        </td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">g GS</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gs_gramos}
                            readOnly
                            className="h-6 text-xs bg-muted"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">%AMDR GS</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gs_amdr}
                            onChange={(e) => {
                              handleChange("grasas_gs_amdr", e.target.value);
                            }}
                            className="h-6 text-xs bg-white border-teal-200"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">g GM</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gm_gramos}
                            readOnly
                            className="h-6 text-xs bg-muted"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">%AMDR GM</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gm_amdr || "30"}
                            readOnly
                            className="h-6 text-xs bg-muted"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">g GP</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gp_gramos}
                            readOnly
                            className="h-6 text-xs bg-muted"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">%AMDR GP</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_gp_amdr}
                            onChange={(e) => {
                              handleChange("grasas_gp_amdr", e.target.value);
                            }}
                            className="h-6 text-xs bg-white"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">Colesterol</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.grasas_colesterol}
                            onChange={(e) => {
                              handleChange("grasas_colesterol", e.target.value);
                            }}
                            className="h-6 text-xs bg-white"
                          />
                        </td>
                      </tr>

                      {/* Carbohidratos */}
                      <tr className="bg-white">
                        <td className="border border-teal-200 p-2 font-medium" rowSpan={2}>
                          CHOs
                          <div className="text-[10px] text-teal-600 font-normal">Target: 50-65% AMDR</div>
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={2}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_gramos_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={2}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_calorias_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1" rowSpan={2}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_amdr_f2}
                            readOnly
                            className="h-8 text-center text-sm bg-muted font-bold"
                          />
                        </td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">g Concent</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_concent_gramos}
                            readOnly
                            className="h-6 text-xs bg-muted"
                          />
                        </td>
                      </tr>
                      <tr className="bg-teal-50/30">
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">%AMDR</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.cho_concent_amdr}
                            onChange={(e) => {
                              handleChange("cho_concent_amdr", e.target.value);
                            }}
                            className="h-6 text-xs bg-white"
                          />
                        </td>
                      </tr>

                      {/* Total */}
                      <tr className="bg-teal-100">
                        <td className="border border-teal-200 p-2 font-medium" colSpan={2}>Total:</td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.total_calorias_f2}
                            readOnly
                            className="h-8 text-center text-sm font-semibold bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.total_amdr_f2}
                            readOnly
                            className="h-8 text-center text-sm font-semibold bg-muted"
                          />
                        </td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">Fibra</td>
                        <td className="border border-teal-200 p-1 text-xs bg-teal-50">
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.total_fibra}
                            onChange={(e) => {
                              handleChange("total_fibra", e.target.value);
                            }}
                            className="h-6 text-xs bg-white border-teal-200"
                            placeholder="14"
                          />
                        </td>
                      </tr>

                      {/* Peso Referencia */}
                      <tr className="bg-teal-50">
                        <td className="border border-teal-200 p-2 font-medium">Kg Ref</td>
                        <td className="border border-teal-200 p-1" colSpan={5}>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.peso_referencia_f2 || formData.peso_objetivo}
                            readOnly
                            className="h-8 text-center text-sm bg-muted"
                            placeholder="75"
                          />
                        </td>
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
                      <tr className="bg-primary hover:bg-primary/95 text-white sticky top-0 z-30">
                        <th className="border border-primary-foreground/20 p-2 text-left font-bold sticky left-0 z-40 bg-inherit shadow-md min-w-[250px]">
                          Grupo de alimentos
                        </th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Port.</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Kcal</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Prot</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Grasa</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">GS</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">GM</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">GP</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">COL</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">CHOS</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">FD</th>
                        {/* <th className="border border-primary-foreground/20 p-2 text-center font-bold">Ca</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">P</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Fe</th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {GRUPOS_ALIMENTOS.map((grupo, index) => {
                        const grupoData = formData.grupos_alimentos_f3[grupo] || {};
                        const isEven = index % 2 === 0;

                        return (
                          <tr key={grupo} className={`transition-colors hover:bg-gray-100 ${isEven ? "bg-gray-50" : "bg-white"}`}>
                            <td className="border border-gray-300 p-2 font-medium text-gray-800 sticky left-0 z-10 bg-inherit shadow-sm min-w-[250px] text-xs">
                              {grupo}
                            </td>
                            <td className="border border-gray-200 p-1">
                              <Input
                                type="number"
                                step="0.1"
                                value={grupoData.porciones || ""}
                                onChange={(e) => handleFase3PorcionesChange(grupo, e.target.value)}
                                className="h-8 text-xs text-center bg-white border-primary/20 w-16 font-bold"
                                placeholder="0"
                              />
                            </td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.kcal || 0).toFixed(1)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.prot || 0).toFixed(1)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.grasa || 0).toFixed(1)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.gs || 0).toFixed(1)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.gm || 0).toFixed(1)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.gp || 0).toFixed(1)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.col || 0).toFixed(0)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.chos || 0).toFixed(1)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.fd || 0).toFixed(1)}</td>
                            {/*<td className="border border-gray-200 p-1 text-center text-xs font-mono">{(grupoData.calcio || 0).toFixed(0)}</td>
                              <td className="border border-gray-200 p-1 text-center text-xs font-mono">{(grupoData.p || 0).toFixed(0)}</td>
                              <td className="border border-gray-200 p-1 text-center text-xs font-mono">{(grupoData.fe || 0).toFixed(1)}</td>*/}
                          </tr>
                        );
                      })}
                      {/* Fila de Totales */}
                      <tr className="bg-primary/10 font-bold sticky bottom-0 z-20 shadow-lg">
                        <td className="border border-primary/30 p-2 sticky left-0 bg-primary/20">TOTAL CALCULADO</td>
                        <td className="border border-primary/30 p-1"></td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.kcal || 0).toFixed(1)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.prot || 0).toFixed(1)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.grasa || 0).toFixed(1)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.gs || 0).toFixed(1)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.gm || 0).toFixed(1)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.gp || 0).toFixed(1)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.col || 0).toFixed(0)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.chos || 0).toFixed(1)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.fd || 0).toFixed(1)}</td>
                        {/* <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.calcio || 0).toFixed(0)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.p || 0).toFixed(0)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.fe || 0).toFixed(1)}</td> */}
                      </tr>
                      {/* Diferencia con Fase 2 */}
                      <tr className="bg-red-50 font-bold text-red-700">
                        <td className="border border-red-200 p-2 sticky left-0 bg-red-100">DIFERENCIA (Requerimiento)</td>
                        <td className="border border-red-200 p-1"></td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.total_calorias_f2) - formData.totals_f3.kcal).toFixed(1)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.proteinas_gramos_f2) - formData.totals_f3.prot).toFixed(1)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_gramos_f2) - formData.totals_f3.grasa).toFixed(1)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_gs_gramos) - formData.totals_f3.gs).toFixed(1)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_gm_gramos) - formData.totals_f3.gm).toFixed(1)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_gp_gramos) - formData.totals_f3.gp).toFixed(1)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_colesterol) - formData.totals_f3.col).toFixed(0)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.cho_gramos_f2) - formData.totals_f3.chos).toFixed(1)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.total_fibra) - formData.totals_f3.fd).toFixed(1)}
                        </td>
                        <td className="border border-red-200 p-1" colSpan={3}></td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary hover:bg-primary/95 text-white sticky top-0 z-30">
                        <th className="border border-primary-foreground/20 p-2 text-left font-bold sticky left-0 z-40 bg-inherit shadow-md min-w-[250px]">
                          Grupo de alimentos
                        </th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Port.</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Kcal</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Prot</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Grasa</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">GS</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">GM</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">GP</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">COL</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">CHOS</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">FD</th>
                        {/* <th className="border border-primary-foreground/20 p-2 text-center font-bold">Ca</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">P</th>
                        <th className="border border-primary-foreground/20 p-2 text-center font-bold">Fe</th> */}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Phase 4: Minuta Patrón */}
          {currentPhase === 4 && (
            <Card className="max-h-[70vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-primary" />
                  {currentPhaseData.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{currentPhaseData.description}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Información Básica */}
                <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg">
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
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Textarea
                      id="descripcion"
                      value={formData.descripcion}
                      onChange={(e) => handleChange("descripcion", e.target.value)}
                      placeholder="Descripción del plan nutricional..."
                      rows={2}
                    />
                  </div>
                </div>

                {/* Asignar Menú Semanal */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="weekly_menu" className="text-base font-bold flex items-center gap-2 text-primary">
                      <ClipboardList className="h-5 w-5" />
                      SELECCIONAR MENÚ BASE
                    </Label>
                    {loadingMenus ? (
                      <div className="text-sm text-muted-foreground">Cargando menús disponibles...</div>
                    ) : (
                      <Select
                        value={formData.weekly_menu_id}
                        onValueChange={(value) =>
                          handleChange("weekly_menu_id", value === "__none__" ? "" : value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar menú semanal base" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin menú semanal</SelectItem>
                          {weeklyMenus.map((menu) => (
                            <SelectItem key={menu.id} value={menu.id.toString()}>
                              {menu.name} ({menu.total_calories} kcal)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {loadingRecipes && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-lg bg-muted/5">
                      <Flame className="h-8 w-8 animate-pulse mb-4 text-primary" />
                      <p className="animate-pulse">Cargando detalles de recetas e ingredientes...</p>
                    </div>
                  )}

                  {!loadingRecipes && detailedMenu && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b pb-2">
                        <Label className="text-base font-bold flex items-center gap-2 text-primary">
                          <Utensils className="h-5 w-5" />
                          DETALLE POR INGREDIENTE (GRAMOS)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="week_selector" className="text-xs font-medium">Semana:</Label>
                          <Select
                            value={selectedWeek.toString()}
                            onValueChange={(value) => setSelectedWeek(parseInt(value))}
                          >
                            <SelectTrigger id="week_selector" className="w-32 h-8 text-xs">
                              <SelectValue placeholder="Semana" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Semana 1</SelectItem>
                              <SelectItem value="2">Semana 2</SelectItem>
                              <SelectItem value="3">Semana 3</SelectItem>
                              <SelectItem value="4">Semana 4</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Tabs defaultValue={detailedMenu.week[0]?.day} className="w-full">
                        <TabsList className="grid w-full grid-cols-7 mb-6">
                          {detailedMenu.week.slice((selectedWeek - 1) * 7, selectedWeek * 7).map((day: any) => (
                            <TabsTrigger key={day.day} value={day.day} className="text-xs">
                              {day.day.substring(0, 3)}
                            </TabsTrigger>
                          ))}
                        </TabsList>

                        {detailedMenu.week.map((day: any, dayIdx: number) => {
                          // Solo mostrar si el día pertenece a la semana seleccionada
                          const isCurrentWeek = dayIdx >= (selectedWeek - 1) * 7 && dayIdx < selectedWeek * 7;
                          if (!isCurrentWeek) return null;

                          return (
                            <TabsContent key={`day-${dayIdx}`} value={day.day} className="space-y-6 mt-0">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-bold text-lg text-primary">{day.day} - Semana {selectedWeek}</h4>
                                <Badge variant="outline" className="text-xs uppercase px-2 py-0.5">
                                  {day.meals.length} Comidas
                                </Badge>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {day.meals.map((meal: any, mealIdx: number) => (
                                  <Card key={`${day.day}-${dayIdx}-${mealIdx}`} className="border-primary/20 shadow-sm">
                                    <CardHeader className="py-3 px-4 bg-primary/5 border-b flex flex-row items-center justify-between space-y-0">
                                      <div>
                                        <CardTitle className="text-sm font-bold uppercase text-primary">
                                          {meal.type}
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground font-medium">{meal.recipe_name}</p>
                                      </div>
                                      <Badge variant="secondary" className="text-[10px] font-bold">
                                        {meal.calories} kcal
                                      </Badge>
                                    </CardHeader>
                                    <CardContent className="py-4 px-4 space-y-3">
                                      {meal.recipeDetails?.ingredients && meal.recipeDetails.ingredients.length > 0 ? (
                                        <div className="space-y-3">
                                          <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                                            <FileText className="h-3 w-3" />
                                            Ingredientes y Gramos
                                          </Label>
                                          <div className="grid gap-2">
                                            {meal.recipeDetails.ingredients.map((ing: string, ingIdx: number) => (
                                              <div key={ingIdx} className="flex items-center gap-3 bg-muted/10 p-2 rounded border border-transparent hover:border-primary/10 transition-colors">
                                                <span className="text-xs flex-1 truncate font-medium">{ing}</span>
                                                <div className="flex items-center gap-1 w-24 shrink-0">
                                                  <Input
                                                    type="text"
                                                    placeholder="0"
                                                    className="h-7 text-xs text-right font-bold pr-1 focus-visible:ring-primary border-primary/20"
                                                    value={formData.ingredientes_f4[dayIdx]?.[meal.type]?.[ing] || formData.ingredientes_f4[dayIdx]?.[mealIdx]?.[ing] || ""}
                                                    onChange={(e) => updateIngredientGrams(dayIdx, meal.type, ing, e.target.value)}
                                                  />
                                                  <span className="text-[10px] font-bold text-muted-foreground">g</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-center py-4 bg-muted/5 rounded flex flex-col items-center gap-2">
                                          <AlertCircle className="h-4 w-4 text-muted-foreground opacity-30" />
                                          <p className="text-[11px] text-muted-foreground">No se encontraron ingredientes para esta receta</p>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </div>
                  )}

                  {!formData.weekly_menu_id && (
                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-lg text-center space-y-3">
                      <Utensils className="h-10 w-10 text-amber-400 mx-auto" />
                      <div className="space-y-1">
                        <p className="font-bold text-amber-800">No se ha seleccionado menú</p>
                        <p className="text-sm text-amber-700">Debe seleccionar un menú semanal base para poder especificar los gramos de los ingredientes.</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="observaciones" className="text-base font-bold text-primary">Observaciones Generales</Label>
                    <Textarea
                      id="observaciones"
                      value={formData.observaciones}
                      onChange={(e) => handleChange("observaciones", e.target.value)}
                      placeholder="Recomendaciones adicionales para la minuta patrón..."
                      rows={3}
                    />
                  </div>
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
