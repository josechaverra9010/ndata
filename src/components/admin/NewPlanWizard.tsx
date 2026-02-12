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
import { ChevronLeft, ChevronRight, CheckCircle2, Calculator, ClipboardList, FileText, Utensils, Flame, Clock, AlertCircle, PieChart } from "lucide-react";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { FOOD_NUTRIENTS, EVANUT_GRUPOS_ALIMENTOS, getCompositionRowForIngredient } from "@/lib/foodNutrients";

interface NewPlanWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePlan: (planData: any) => void;
  patientId?: number;
  /** Tipo de plan preseleccionado al abrir (ej. desde el selector de tipos en MealPlans) */
  initialTipoPlan?: string;
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

// Grupos de alimentos de Fase 3 según EVANUT 4.1 (solo los del Excel)
const GRUPOS_ALIMENTOS = EVANUT_GRUPOS_ALIMENTOS;

const PLAN_WIZARD_DRAFT_KEY = "ndata_plan_wizard_draft";

export const PLAN_TYPES = [
  { value: "adulto", label: "Adulto" },
  { value: "pediatria", label: "Pediatría" },
  { value: "gestante", label: "Gestante" },
  { value: "gestante_adolescente", label: "Gestante adolescente" },
  { value: "hospitalizado", label: "Hospitalizado" },
  { value: "deportista", label: "Deportista" },
] as const;

function getDefaultFormData() {
  return {
    tipo_plan: "adulto" as string,
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
    cho_kg_peso: "",
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
    nombre_plan: "",
    descripcion: "",
    categoria: "",
    color: "primary",
    duracion: "",
    comidas_dia: "3",
    ingredientes_f4: {} as Record<string, any>,
    observaciones: "",
    weekly_menu_id: "",
    patient_id: "" as string | number,
    // Fase 1 Deportista: Somatotipo y composición corporal
    deportista_peso: "",
    deportista_triceps: "",
    deportista_subescapular: "",
    deportista_supraespinal: "",
    deportista_estatura: "",
    deportista_diametro_humero: "",
    deportista_diametro_femur: "",
    deportista_perim_brazo_tenso: "",
    deportista_perim_pantorrilla: "",
    deportista_pliegue_pantorrilla: "",
    deportista_yuhasz_sexo: "masculino",
    deportista_yuhasz_abdominal: "",
    deportista_yuhasz_muslo_medio: "",
    deportista_pct_grasa_esperado: "",
  };
}

function getDraftKey(patientIdOrFormPatient: number | string | undefined | null): string {
  const id = patientIdOrFormPatient === "" || patientIdOrFormPatient == null ? 0 : patientIdOrFormPatient;
  return `${PLAN_WIZARD_DRAFT_KEY}_${id}`;
}

function mergeFormDataWithDefaults(saved: any): any {
  const defaultData = getDefaultFormData();
  if (!saved || typeof saved !== "object") return defaultData;
  const merged = { ...defaultData };
  for (const key of Object.keys(defaultData)) {
    if (saved[key] === undefined) continue;
    if (key === "grupos_alimentos_f3" && saved[key] && typeof saved[key] === "object") {
      const defaultGroups = defaultData.grupos_alimentos_f3;
      merged.grupos_alimentos_f3 = { ...defaultGroups };
      for (const g of Object.keys(saved.grupos_alimentos_f3 || {})) {
        if (defaultGroups[g]) {
          merged.grupos_alimentos_f3[g] = { ...defaultGroups[g], ...(saved.grupos_alimentos_f3[g] || {}) };
        } else {
          merged.grupos_alimentos_f3[g] = saved.grupos_alimentos_f3[g];
        }
      }
    } else if (key === "totals_f3" && saved[key] && typeof saved[key] === "object") {
      merged.totals_f3 = { ...defaultData.totals_f3, ...saved.totals_f3 };
    } else if (key === "ingredientes_f4" && saved[key] && typeof saved[key] === "object") {
      merged.ingredientes_f4 = { ...(saved.ingredientes_f4 || {}) };
    } else {
      merged[key] = saved[key];
    }
  }
  return merged;
}

export function NewPlanWizard({ open, onOpenChange, onCreatePlan, patientId, initialTipoPlan }: NewPlanWizardProps) {
  const [currentPhase, setCurrentPhase] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [formData, setFormData] = useState(getDefaultFormData);

  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [weeklyMenus, setWeeklyMenus] = useState<any[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [detailedMenu, setDetailedMenu] = useState<any>(null);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  // Guardar gramos base de Fase 4 (sin multiplicador) y multiplicadores por ingrediente
  const [baseIngredientsF4, setBaseIngredientsF4] = useState<Record<string, any>>({});
  const [ingredientMultipliers, setIngredientMultipliers] = useState<Record<string, any>>({});
  const [patientsList, setPatientsList] = useState<{ id: number; name: string }[]>([]);
  const [loadingPatientsList, setLoadingPatientsList] = useState(false);
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
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${pid}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.detail || "No se pudo cargar el paciente");
      }
      const patient = await response.json();

      const pesoActual = patient?.peso_actual != null ? String(patient.peso_actual) : "";
      const altura = patient?.altura != null ? String(patient.altura) : "";
      const genero = patient?.genero ? String(patient.genero).toLowerCase() : "";
      const edad = computeAgeYears(patient?.fecha_nacimiento);
      const pal = mapNivelActividadToPAL(patient?.nivel_actividad);
      const pesoObjetivo = patient?.peso_objetivo != null ? String(patient.peso_objetivo) : "";
      const factorActividad = patient?.pal_factor ? String(patient.pal_factor) : (pal || "1.55");

      // Calcular todos los valores derivados con los datos del paciente (un solo setFormData para evitar estado desfasado)
      let imc = "";
      let pesoSaludable = "";
      let pesoAjustado = "";
      let tmb = "";
      let requerimientoEnergetico = "";

      const pesoNum = parseFloat(pesoActual);
      const alturaNum = parseFloat(altura);
      if (!isNaN(pesoNum) && !isNaN(alturaNum) && alturaNum > 0) {
        const alturaMetros = alturaNum / 100;
        const imcVal = pesoNum / (alturaMetros * alturaMetros);
        imc = imcVal.toFixed(2);
        pesoSaludable = (25 * alturaMetros * alturaMetros).toFixed(2);
        pesoAjustado = ((pesoNum - 25 * alturaMetros * alturaMetros) * 0.25 + 25 * alturaMetros * alturaMetros).toFixed(2);
      }

      const tmbComputed = computeTmbValue(pesoObjetivo || pesoActual, edad, genero);
      if (tmbComputed != null) {
        tmb = tmbComputed.toFixed(2);
        const factorNum = parseFloat(factorActividad) || 1.55;
        requerimientoEnergetico = String(Math.round(tmbComputed * factorNum));
      }

      setFormData((prev: any) => ({
        ...prev,
        patient_id: pid,
        peso_actual: pesoActual,
        altura,
        genero,
        edad,
        peso_objetivo: pesoObjetivo,
        peso_referencia_f2: pesoObjetivo,
        factor_actividad: factorActividad,
        imc: imc || prev.imc,
        peso_saludable: pesoSaludable || prev.peso_saludable,
        peso_ajustado: pesoAjustado || prev.peso_ajustado,
        tmb: tmb || prev.tmb,
        requerimiento_energetico: requerimientoEnergetico || prev.requerimiento_energetico,
      }));

      toast({
        title: "Datos cargados",
        description: `Se cargaron los datos de ${patient?.nombres || "el paciente"}`,
      });
    } catch (error: any) {
      console.error("Error prefill patient:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo cargar los datos del paciente",
        variant: "destructive",
      });
    } finally {
      setLoadingPatient(false);
    }
  };

  /** Carga datos del paciente desde la API y rellena la fase 1 deportista (peso, estatura, sexo) */
  const fetchPatientAndPrefillDeportista = async (pid: number) => {
    setLoadingPatient(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${pid}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail || "No se pudo cargar el paciente");
      }
      const patient = await response.json();
      const peso = patient?.peso_actual != null ? String(patient.peso_actual) : "";
      const estatura = patient?.altura != null ? String(patient.altura) : "";
      const generoRaw = patient?.genero ? String(patient.genero).toLowerCase() : "";
      const genero = generoRaw === "mujer" || generoRaw === "femenino" ? "femenino" : "masculino";
      setFormData((prev: any) => ({
        ...prev,
        patient_id: pid,
        deportista_peso: peso,
        deportista_estatura: estatura,
        deportista_yuhasz_sexo: genero || prev.deportista_yuhasz_sexo,
      }));
      toast({
        title: "Datos cargados",
        description: `Se cargaron los datos de ${patient?.nombres || "el paciente"} desde la base de datos`,
      });
    } catch (error: any) {
      console.error("Error prefill deportista:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo cargar los datos del paciente",
        variant: "destructive",
      });
    } finally {
      setLoadingPatient(false);
    }
  };

  /** Obtiene el ID del paciente a cargar: el pasado por prop o el primero de la lista desde la API */
  const getPatientIdToLoad = (): Promise<number | null> => {
    if (typeof patientId === "number") return Promise.resolve(patientId);
    const token = localStorage.getItem("userToken");
    return fetch(`${API_URL}/patients`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: number }[]) => (list?.length > 0 ? list[0].id : null))
      .catch(() => null);
  };

  // Cargar lista de pacientes para el selector de Fase 1 (cuando se abre el wizard)
  useEffect(() => {
    if (!open || currentPhase !== 1) return;
    setLoadingPatientsList(true);
    const token = localStorage.getItem("userToken");
    fetch(`${API_URL}/patients`, {
      headers: { ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((list: { id: number; nombres?: string; apellidos?: string; name?: string }[]) => {
        setPatientsList(
          (list || []).map((p) => ({
            id: p.id,
            name: [p.nombres, p.apellidos].filter(Boolean).join(" ") || (p as any).name || `Paciente ${p.id}`,
          }))
        );
      })
      .catch(() => setPatientsList([]))
      .finally(() => setLoadingPatientsList(false));
  }, [open, currentPhase]);

  // Al abrir: restaurar borrador del paciente actual si existe; si no, empezar desde cero y opcionalmente prefill
  useEffect(() => {
    if (!open) return;
    const draftKey = getDraftKey(patientId);
    try {
      const raw = localStorage.getItem(draftKey);
      const draft = raw ? JSON.parse(raw) : null;
      if (draft && typeof draft.currentPhase === "number" && draft.formData) {
        const merged = mergeFormDataWithDefaults(draft.formData);
        // Asegurar que el borrador cargado tenga el patient_id correcto (por si es antiguo o se abrió con paciente)
        const mergedWithPatient = patientId != null
          ? { ...merged, patient_id: merged.patient_id || patientId }
          : merged;
        setFormData(mergedWithPatient);
        setCurrentPhase(Math.min(4, Math.max(0, draft.currentPhase)));
        setCompletedPhases(Array.isArray(draft.completedPhases) ? draft.completedPhases : []);
        toast({
          title: "Borrador restaurado",
          description: "Puedes continuar desde donde habías quedado.",
        });
        return;
      }
    } catch (e) {
      console.warn("Error loading plan wizard draft:", e);
    }
    const defaultData = getDefaultFormData();
    setFormData({
      ...defaultData,
      ...(initialTipoPlan && { tipo_plan: initialTipoPlan }),
    });
    setCurrentPhase(initialTipoPlan ? 1 : 0);
    setCompletedPhases([]);
    if (typeof patientId === "number") {
      fetchPatientAndPrefill(patientId);
    }
  }, [open, patientId, initialTipoPlan]);

  // Persistir borrador del paciente actual mientras el modal está abierto
  useEffect(() => {
    if (!open) return;
    try {
      const payload = {
        formData,
        currentPhase,
        completedPhases,
      };
      const draftKey = getDraftKey(formData.patient_id);
      localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch (e) {
      console.warn("Error saving plan wizard draft:", e);
    }
  }, [open, formData, currentPhase, completedPhases]);

  // Cargar menús semanales cuando se abre la Fase 4
  useEffect(() => {
    if (currentPhase === 4 && open) {
      fetchWeeklyMenus();
    }
  }, [currentPhase, open]);

  const fetchWeeklyMenus = async () => {
    setLoadingMenus(true);
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
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/recipes/${recipeId}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
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
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/weekly-menus/${menuId}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
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

      // Inicializar ingredientes_f4 con los gramos de la tabla de composición (por receta), no editables
      const currentIngredients = { ...formData.ingredientes_f4 };
      const initialIngredients: Record<string, any> = { ...currentIngredients };

      finalWeek.forEach((day: any, dayIdx: number) => {
        if (!initialIngredients[dayIdx]) initialIngredients[dayIdx] = {};

        day.meals.forEach((meal: any, mealIdx: number) => {
          const mealKey = meal.type || mealIdx.toString();
          if (!initialIngredients[dayIdx][mealKey]) initialIngredients[dayIdx][mealKey] = {};

          if (meal.recipeDetails?.ingredients && Array.isArray(meal.recipeDetails.ingredients)) {
            meal.recipeDetails.ingredients.forEach((ing: string) => {
              const baseName = (ing && typeof ing === "string") ? ing.replace(/\s*:.*$/, "").trim() : String(ing);
              const row = getCompositionRowForIngredient(ing) ?? getCompositionRowForIngredient(baseName);
              const grams = row?.portion_grams != null ? String(row.portion_grams) : "";
              initialIngredients[dayIdx][mealKey][ing] = grams;
            });
          }
        });
      });

      // Guardar gramos base y multiplicadores iniciales (1) por ingrediente
      const initialMultipliers: Record<string, any> = {};
      Object.entries(initialIngredients).forEach(([dayKey, meals]) => {
        if (!meals || typeof meals !== "object") return;
        initialMultipliers[dayKey] = {};
        Object.entries(meals as Record<string, any>).forEach(([mealKey, ingredients]) => {
          if (!ingredients || typeof ingredients !== "object") return;
          initialMultipliers[dayKey][mealKey] = {};
          Object.keys(ingredients as Record<string, any>).forEach((ingredientName) => {
            initialMultipliers[dayKey][mealKey][ingredientName] = 1;
          });
        });
      });

      setBaseIngredientsF4(initialIngredients);
      setIngredientMultipliers(initialMultipliers);
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
  // Actualizar gramos de un ingrediente concreto (Fase 4)
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
    const pAMDRFinal = parseFloat(proteinasAMDR_Calc.toFixed(2));
    const gAMDRFinal = parseFloat(grasasAMDR_Input.toFixed(2));

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
    handleChange("proteinas_amdr_f2", pAMDRFinal.toFixed(2));
    handleChange("proteinas_calorias_f2", proteinasCalorias.toFixed(2));
    handleChange("proteinas_gramos_f2", proteinasGramos.toFixed(2));
    handleChange("grasas_calorias_f2", grasasCalorias.toFixed(2));
    handleChange("grasas_gramos_f2", grasasGramos.toFixed(2));
    handleChange("grasas_gm_amdr", grasasGM_AMDR.toFixed(2));
    handleChange("cho_amdr_f2", cAMDRFinal.toFixed(2));
    handleChange("cho_calorias_f2", choCalorias.toFixed(2));
    handleChange("cho_gramos_f2", choGramos.toFixed(2));
    handleChange("cho_kg_peso", choKgPeso_Calc.toFixed(2));
    handleChange("grasas_gs_gramos", grasasGSGramos.toFixed(2));
    handleChange("grasas_gm_gramos", grasasGMGramos.toFixed(2));
    handleChange("grasas_gp_gramos", grasasGPGramos.toFixed(2));
    handleChange("proteinas_avb_gramos", proteinasAVBGramos.toFixed(2));
    handleChange("cho_concent_gramos", choConcentGramos.toFixed(2));
    handleChange("total_calorias_f2", totalCalorias.toFixed(2));
    handleChange("total_amdr_f2", totalAMDR.toFixed(2));
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
    if (currentPhase > 0) {
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

    const calories = parseInt(formData.requerimiento_energetico) || parseInt(formData.total_calorias_f2) || 0;
    const proteinG = parseFloat(formData.proteinas_gramos_f2) || 0;
    const carbsG = parseFloat(formData.cho_gramos_f2) || 0;
    const fatG = parseFloat(formData.grasas_gramos_f2) || 0;

    const planData = {
      name: formData.nombre_plan || "Plan Nutricional",
      description: formData.descripcion,
      calories,
      duration: formData.duracion,
      category: formData.categoria,
      color: formData.color,
      tipo: formData.tipo_plan || "adulto",
      meals_per_day: parseInt(formData.comidas_dia) || 3,
      protein_target: Math.round(proteinG),
      carbs_target: Math.round(carbsG),
      fat_target: Math.round(fatG),

      // Datos de las 4 fases
      fase_1: formData.tipo_plan === "deportista"
        ? {
            tipo_fase: "deportista",
            deportista_peso: formData.deportista_peso,
            deportista_triceps: formData.deportista_triceps,
            deportista_subescapular: formData.deportista_subescapular,
            deportista_supraespinal: formData.deportista_supraespinal,
            deportista_estatura: formData.deportista_estatura,
            deportista_diametro_humero: formData.deportista_diametro_humero,
            deportista_diametro_femur: formData.deportista_diametro_femur,
            deportista_perim_brazo_tenso: formData.deportista_perim_brazo_tenso,
            deportista_perim_pantorrilla: formData.deportista_perim_pantorrilla,
            deportista_pliegue_pantorrilla: formData.deportista_pliegue_pantorrilla,
            deportista_yuhasz_sexo: formData.deportista_yuhasz_sexo,
            deportista_yuhasz_abdominal: formData.deportista_yuhasz_abdominal,
            deportista_yuhasz_muslo_medio: formData.deportista_yuhasz_muslo_medio,
            deportista_pct_grasa_esperado: formData.deportista_pct_grasa_esperado,
          }
        : {
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
      const token = localStorage.getItem("userToken");
      // Crear el plan primero
      const response = await fetch(`${API_URL}/meal-plans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
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
              headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {}),
              },
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

        // ASIGNACIÓN AUTOMÁTICA AL PACIENTE (prop o paciente seleccionado en fase 1)
        const effectivePatientId = patientId ?? (formData.patient_id ? Number(formData.patient_id) : null);
        if (effectivePatientId) {
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
              headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                patient_id: effectivePatientId,
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

        // Limpiar borrador de este paciente y reset form
        localStorage.removeItem(getDraftKey(patientId ?? formData.patient_id));
        setFormData(getDefaultFormData());
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
            {currentPhase === 0
              ? "Selecciona el tipo de plan para comenzar"
              : "Completa las 4 fases para crear un plan nutricional completo"}
          </DialogDescription>
        </DialogHeader>

        {/* Paso 0: Selección de tipo de plan */}
        {currentPhase === 0 && (
          <div className="space-y-6 py-4">
            <p className="text-sm font-medium text-foreground">Selecciona el tipo de plan nutricional</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PLAN_TYPES.map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  className="h-auto py-5 flex flex-col items-center justify-center gap-1 font-medium text-base hover:border-primary hover:bg-primary/5"
                  onClick={async () => {
                    handleChange("tipo_plan", value);
                    setCurrentPhase(1);
                    if (value === "adulto") {
                      const id = await getPatientIdToLoad();
                      if (id != null) await fetchPatientAndPrefill(id);
                    } else if (value === "deportista") {
                      const id = await getPatientIdToLoad();
                      if (id != null) await fetchPatientAndPrefillDeportista(id);
                      else toast({ title: "Sin pacientes", description: "No hay pacientes registrados. Crea uno primero para cargar sus datos.", variant: "destructive" });
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {currentPhase >= 1 && (
          <>
            {/* Tipo de plan (visible en fases 1-4 para poder cambiarlo) */}
            <div className="space-y-2">
              <Label className="text-base font-semibold text-primary">Tipo de plan</Label>
              <Select
                value={formData.tipo_plan}
                onValueChange={(value) => handleChange("tipo_plan", value)}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Progress Bar (5 pasos: tipo + 4 fases) */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Paso {currentPhase + 1} de 5</span>
                <span>{Math.round(((currentPhase + 1) / 5) * 100)}% completado</span>
              </div>
              <Progress value={((currentPhase + 1) / 5) * 100} />
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
                        ? "border-green-500 bg-green-50 dark:bg-green-950/30"
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
          </>
        )}

        <div>
          {/* Phase 1 Deportista: Somatotipo y composición corporal */}
          {currentPhase === 1 && formData.tipo_plan === "deportista" && (() => {
            const t = formData.deportista_triceps; const s = formData.deportista_subescapular; const sp = formData.deportista_supraespinal;
            const peso = parseFloat(formData.deportista_peso) || 0; const est = parseFloat(formData.deportista_estatura) || 0;
            const sumPliegues = (parseFloat(t) || 0) + (parseFloat(s) || 0) + (parseFloat(sp) || 0);
            const perimBrazo = parseFloat(formData.deportista_perim_brazo_tenso) || 0;
            const plieguePant = parseFloat(formData.deportista_pliegue_pantorrilla) || 0;
            const perimPant = parseFloat(formData.deportista_perim_pantorrilla) || 0;
            const diamHum = parseFloat(formData.deportista_diametro_humero) || 0;
            const diamFem = parseFloat(formData.deportista_diametro_femur) || 0;
            const correccionProp = est > 0 ? (170.18 / est) : 0;
            const perimBrazoCorr = perimBrazo - (Math.PI * (plieguePant / 10)); // pliegue en mm, simplificado
            const perimPantCorr = perimPant - (Math.PI * (plieguePant / 10));
            const hwr = peso > 0 && est > 0 ? est / (Math.pow(peso, 1 / 3)) : 0;
            const endomorfia = est > 0 && sumPliegues > 0 ? (sumPliegues * (170.18 / est) - 0.00001) * 0.7182 + 0.00001 : 0;
            const mesomorfia = est > 0 && diamHum > 0 && diamFem > 0 ? 0.858 * diamHum + 0.601 * diamFem + 0.188 * perimBrazoCorr + 0.161 * perimPantCorr - est * 0.131 + 4.5 : 0;
            let ectomorfia = 0;
            if (hwr >= 40.75) ectomorfia = 0.732 * hwr - 28.58;
            else if (hwr > 38.25) ectomorfia = 0.463 * hwr - 17.63;
            else if (hwr > 0) ectomorfia = 0.1;
            const sumYuhasz = (parseFloat(t) || 0) + (parseFloat(s) || 0) + (parseFloat(sp) || 0) + (parseFloat(formData.deportista_yuhasz_abdominal) || 0) + (parseFloat(formData.deportista_yuhasz_muslo_medio) || 0) + (parseFloat(formData.deportista_pliegue_pantorrilla) || 0);
            const isHombre = formData.deportista_yuhasz_sexo === "masculino";
            const pctGrasaYuhasz = sumYuhasz > 0 ? (isHombre ? 0.1051 * sumYuhasz + 2.585 : 0.1548 * sumYuhasz + 3.58) : 0;
            const pesoGraso = peso > 0 ? (peso * pctGrasaYuhasz) / 100 : 0;
            const masaLibreGrasa = peso - pesoGraso;
            const pctEsperado = parseFloat(formData.deportista_pct_grasa_esperado) || 0;
            const pesoOptimo = masaLibreGrasa > 0 && pctEsperado < 100 ? masaLibreGrasa / (1 - pctEsperado / 100) : 0;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    Somatotipo y composición corporal (Deportista)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Mediciones antropométricas y % grasa Yuhasz para el plan deportista</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                    <div className="space-y-1 min-w-[200px]">
                      <Label>Paciente (cargar desde BD)</Label>
                      <Select
                        value={formData.patient_id ? String(formData.patient_id) : ""}
                        onValueChange={(v) => handleChange("patient_id", v === "" ? "" : Number(v))}
                        disabled={loadingPatientsList}
                      >
                        <SelectTrigger><SelectValue placeholder={loadingPatientsList ? "Cargando..." : "Selecciona un paciente"} /></SelectTrigger>
                        <SelectContent>
                          {patientsList.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={loadingPatient || !formData.patient_id}
                      onClick={() => formData.patient_id && fetchPatientAndPrefillDeportista(Number(formData.patient_id))}
                    >
                      {loadingPatient ? "Cargando..." : "Cargar datos del paciente"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1"><Label>Peso (kg)</Label><Input type="number" step="0.1" value={formData.deportista_peso} onChange={(e) => handleChange("deportista_peso", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Tríceps (mm)</Label><Input type="number" step="0.1" value={formData.deportista_triceps} onChange={(e) => handleChange("deportista_triceps", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Subescapular (mm)</Label><Input type="number" step="0.1" value={formData.deportista_subescapular} onChange={(e) => handleChange("deportista_subescapular", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Supraespinal (mm)</Label><Input type="number" step="0.1" value={formData.deportista_supraespinal} onChange={(e) => handleChange("deportista_supraespinal", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Estatura (cm)</Label><Input type="number" step="0.1" value={formData.deportista_estatura} onChange={(e) => handleChange("deportista_estatura", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Diám. húmero (cm)</Label><Input type="number" step="0.01" value={formData.deportista_diametro_humero} onChange={(e) => handleChange("deportista_diametro_humero", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Diám. fémur (cm)</Label><Input type="number" step="0.01" value={formData.deportista_diametro_femur} onChange={(e) => handleChange("deportista_diametro_femur", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Perím. brazo tenso (cm)</Label><Input type="number" step="0.1" value={formData.deportista_perim_brazo_tenso} onChange={(e) => handleChange("deportista_perim_brazo_tenso", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Perím. pantorrilla (cm)</Label><Input type="number" step="0.1" value={formData.deportista_perim_pantorrilla} onChange={(e) => handleChange("deportista_perim_pantorrilla", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Pliegue pantorrilla (mm)</Label><Input type="number" step="0.1" value={formData.deportista_pliegue_pantorrilla} onChange={(e) => handleChange("deportista_pliegue_pantorrilla", e.target.value)} /></div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Sumatoria</span><p className="font-medium">{sumPliegues > 0 ? sumPliegues.toFixed(2) : "—"}</p></div>
                    <div><span className="text-muted-foreground">Corrección prop.</span><p className="font-medium">{correccionProp > 0 ? correccionProp.toFixed(4) : "—"}</p></div>
                    <div><span className="text-muted-foreground">Perím. brazo corregido</span><p className="font-medium">{perimBrazoCorr > 0 ? perimBrazoCorr.toFixed(2) : "—"}</p></div>
                    <div><span className="text-muted-foreground">Perím. pant. corregido</span><p className="font-medium">{perimPantCorr > 0 ? perimPantCorr.toFixed(2) : "—"}</p></div>
                    <div><span className="text-muted-foreground">HWR</span><p className="font-medium">{hwr > 0 ? hwr.toFixed(2) : "—"}</p></div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Componentes del somatotipo</h4>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded border p-2"><span className="text-muted-foreground block">Endomorfia</span><p className="font-bold">{endomorfia > 0 ? endomorfia.toFixed(2) : "—"}</p></div>
                      <div className="rounded border p-2"><span className="text-muted-foreground block">Mesomorfia</span><p className="font-bold">{mesomorfia > 0 ? mesomorfia.toFixed(2) : "—"}</p></div>
                      <div className="rounded border p-2"><span className="text-muted-foreground block">Ectomorfia</span><p className="font-bold">{ectomorfia > 0 ? ectomorfia.toFixed(2) : "—"}</p></div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">% Grasa Yuhasz</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1"><Label>Sexo</Label>
                        <Select value={formData.deportista_yuhasz_sexo} onValueChange={(v) => handleChange("deportista_yuhasz_sexo", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="masculino">Hombre</SelectItem><SelectItem value="femenino">Mujer</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label>Abdominal (mm)</Label><Input type="number" step="0.1" value={formData.deportista_yuhasz_abdominal} onChange={(e) => handleChange("deportista_yuhasz_abdominal", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Muslo medio (mm)</Label><Input type="number" step="0.1" value={formData.deportista_yuhasz_muslo_medio} onChange={(e) => handleChange("deportista_yuhasz_muslo_medio", e.target.value)} /></div>
                    </div>
                    <div className="mt-3 rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <div><span className="text-muted-foreground">% Grasa</span><p className="font-bold">{pctGrasaYuhasz > 0 ? pctGrasaYuhasz.toFixed(2) : "—"}</p></div>
                      <div><span className="text-muted-foreground">Peso graso (kg)</span><p className="font-medium">{pesoGraso > 0 ? pesoGraso.toFixed(2) : "—"}</p></div>
                      <div><span className="text-muted-foreground">Masa libre grasa (kg)</span><p className="font-medium">{masaLibreGrasa > 0 ? masaLibreGrasa.toFixed(2) : "—"}</p></div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Peso óptimo</h4>
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="space-y-1"><Label>% grasa esperado</Label><Input type="number" step="0.1" value={formData.deportista_pct_grasa_esperado} onChange={(e) => handleChange("deportista_pct_grasa_esperado", e.target.value)} placeholder="Ej. 15" className="w-24" /></div>
                      <div className="rounded border p-2"><span className="text-muted-foreground block text-sm">Peso óptimo (kg)</span><p className="font-bold text-lg">{pesoOptimo > 0 ? pesoOptimo.toFixed(2) : "—"}</p></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Phase 1: Requerimiento Energético y Peso Saludable (no deportista) */}
          {currentPhase === 1 && formData.tipo_plan !== "deportista" && (
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
                          {formData.total_fibra ? parseFloat(formData.total_fibra).toFixed(2) : "---"}
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
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.kcal || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.prot || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.grasa || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.gs || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.gm || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.gp || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.col || 0).toFixed(0)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.chos || 0).toFixed(2)}</td>
                            <td className="border border-gray-200 p-1 text-center text-xs">{(grupoData.fd || 0).toFixed(2)}</td>
                            {/*<td className="border border-gray-200 p-1 text-center text-xs font-mono">{(grupoData.calcio || 0).toFixed(0)}</td>
                              <td className="border border-gray-200 p-1 text-center text-xs font-mono">{(grupoData.p || 0).toFixed(0)}</td>
                              <td className="border border-gray-200 p-1 text-center text-xs font-mono">{(grupoData.fe || 0).toFixed(2)}</td>*/}
                          </tr>
                        );
                      })}
                      {/* Fila de Totales */}
                      <tr className="bg-primary/10 font-bold sticky bottom-0 z-20 shadow-lg">
                        <td className="border border-primary/30 p-2 sticky left-0 bg-primary/20">TOTAL CALCULADO</td>
                        <td className="border border-primary/30 p-1"></td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.kcal || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.prot || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.grasa || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.gs || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.gm || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.gp || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.col || 0).toFixed(0)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.chos || 0).toFixed(2)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.fd || 0).toFixed(2)}</td>
                        {/* <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.calcio || 0).toFixed(0)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.p || 0).toFixed(0)}</td>
                        <td className="border border-primary/30 p-1 text-center">{(formData.totals_f3.fe || 0).toFixed(2)}</td> */}
                      </tr>
                      {/* Diferencia con Fase 2 */}
                      <tr className="bg-red-50 font-bold text-red-700">
                        <td className="border border-red-200 p-2 sticky left-0 bg-red-100">DIFERENCIA (Requerimiento)</td>
                        <td className="border border-red-200 p-1"></td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.total_calorias_f2) - formData.totals_f3.kcal).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.proteinas_gramos_f2) - formData.totals_f3.prot).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_gramos_f2) - formData.totals_f3.grasa).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_gs_gramos) - formData.totals_f3.gs).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_gm_gramos) - formData.totals_f3.gm).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_gp_gramos) - formData.totals_f3.gp).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.grasas_colesterol) - formData.totals_f3.col).toFixed(0)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.cho_gramos_f2) - formData.totals_f3.chos).toFixed(2)}
                        </td>
                        <td className="border border-red-200 p-1 text-center">
                          {(parseFloat(formData.total_fibra) - formData.totals_f3.fd).toFixed(2)}
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
                {/* Resumen de Fases Previas - Sticky */}
                <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm pb-4 pt-1 -mt-1 border-b mb-6">
                  <Card className="bg-primary/5 border-primary/20 overflow-hidden shadow-sm">
                    <CardHeader className="py-2 px-4 bg-primary/10 border-b flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Utensils className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-bold uppercase text-primary">Resumen de Porciones (Fase 3)</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">
                        Referencia para Minuta
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-3">
                      <div className="max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                        <table className="w-full text-xs">
                          <tbody className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
                            {GRUPOS_ALIMENTOS.map(grupo => {
                              const porciones = parseFloat(formData.grupos_alimentos_f3[grupo]?.porciones) || 0;
                              if (porciones <= 0) return null;
                              return (
                                <tr key={grupo} className="flex justify-between items-center py-1 border-b border-primary/5 last:border-0">
                                  <td className="text-muted-foreground truncate mr-2">{grupo}</td>
                                  <td className="font-bold text-primary tabular-nums">{porciones}</td>
                                </tr>
                              );
                            })}
                            {Object.values(formData.grupos_alimentos_f3).every((g: any) => !(parseFloat(g.porciones) > 0)) && (
                              <tr className="col-span-full">
                                <td className="py-2 text-center text-muted-foreground italic" colSpan={2}>
                                  No se han asignado porciones en la Fase 3
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

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
                        value={formData.weekly_menu_id || "__none__"}
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
                                            Ingredientes y gramos (según receta / tabla de composición)
                                          </Label>
                                          <div className="grid gap-2">
                                            {meal.recipeDetails.ingredients.map((ing: string, ingIdx: number) => {
                                              const mealKey = meal.type || mealIdx.toString();
                                              const baseGramsStr =
                                                baseIngredientsF4?.[dayIdx]?.[mealKey]?.[ing] ??
                                                baseIngredientsF4?.[dayIdx]?.[mealIdx]?.[ing] ??
                                                "";
                                              const baseGrams = parseFloat(String(baseGramsStr));
                                              const currentMultiplier =
                                                ingredientMultipliers?.[dayIdx]?.[mealKey]?.[ing] ?? 1;
                                              const gramsValue =
                                                formData.ingredientes_f4[dayIdx]?.[mealKey]?.[ing] ?? "";

                                              const displayGrams =
                                                gramsValue ||
                                                (Number.isFinite(baseGrams)
                                                  ? (baseGrams * currentMultiplier).toFixed(2)
                                                  : "");

                                              return (
                                                <div
                                                  key={ingIdx}
                                                  className="flex items-center gap-3 bg-muted/10 p-2 rounded border border-transparent"
                                                >
                                                  <span className="text-xs flex-1 truncate font-medium">
                                                    {ing.replace(/\s*:.*$/, "").trim() || ing}
                                                  </span>
                                                  <span className="text-[11px] text-muted-foreground w-10 text-right tabular-nums">
                                                    {displayGrams ? `${displayGrams} g` : "—"}
                                                  </span>
                                                  <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-[10px] text-muted-foreground">x</span>
                                                    <Input
                                                      type="number"
                                                      step="0.1"
                                                      className="h-7 w-16 text-[11px] text-center"
                                                      value={currentMultiplier}
                                                      onChange={(e) => {
                                                        const raw = parseFloat(e.target.value);
                                                        const safeMultiplier =
                                                          Number.isFinite(raw) && raw >= 0 ? raw : 0;

                                                        setIngredientMultipliers(prev => ({
                                                          ...prev,
                                                          [dayIdx]: {
                                                            ...(prev[dayIdx] || {}),
                                                            [mealKey]: {
                                                              ...(prev[dayIdx]?.[mealKey] || {}),
                                                              [ing]: safeMultiplier,
                                                            },
                                                          },
                                                        }));

                                                        if (Number.isFinite(baseGrams)) {
                                                          const scaled = baseGrams * safeMultiplier;
                                                          updateIngredientGrams(
                                                            dayIdx,
                                                            mealKey,
                                                            ing,
                                                            scaled.toFixed(2)
                                                          );
                                                        }
                                                      }}
                                                    />
                                                  </div>
                                                </div>
                                              );
                                            })}
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

          {currentPhase >= 1 && (
          <DialogFooter className="mt-6">
            <div className="flex justify-between w-full">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentPhase === 0}
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
