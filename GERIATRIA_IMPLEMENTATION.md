# Implementación del Módulo de Geriatría - NutriData

**Fecha de Implementación:** 30 de Julio de 2026  
**Autor:** Manus AI

Este documento detalla los cambios realizados para implementar el soporte completo para pacientes geriátricos en el sistema NutriData.

---

## 1. Fórmulas de Cálculo y Verificación

Se creó el archivo `verify_geriatria.py` que contiene y valida las siguientes fórmulas específicas para adultos mayores (≥60 años):

### Estimación de Talla (Chumlea et al., 1985)
Se utiliza cuando no es posible medir la talla de pie. Utiliza la altura de rodilla (Knee Height).
- **Hombres:** `64.19 - 0.04 * edad + 2.02 * altura_rodilla_cm`
- **Mujeres:** `84.88 - 0.24 * edad + 1.83 * altura_rodilla_cm`

### Tasa Metabólica Basal (TMB)
Se implementaron dos opciones estándar:
1. **Harris-Benedict** (original)
2. **Mifflin-St Jeor** (más moderna)

### Requerimiento Energético Total
El factor de Actividad Física (PAL) se ajustó a la realidad de la población geriátrica:
- **Sedentario:** 1.2 (Confinado a cama o silla)
- **Ligero:** 1.375 (Vida independiente, actividad ligera)
- **Moderado:** 1.55 (Ejercicio regular)

### Macronutrientes
La distribución de macronutrientes se ajustó a las recomendaciones para adultos mayores:
- **Proteína:** 1.1 g/kg (mayor que el adulto joven, para preservar masa muscular y prevenir sarcopenia)
- **Carbohidratos:** 55% del requerimiento energético total
- **Grasas:** 30% del requerimiento energético total

*Todas las fórmulas pasaron las pruebas unitarias.*

---

## 2. Integración en el Frontend (TypeScript)

Se modificó el archivo `src/lib/foodNutrients.ts` para incluir las funciones de cálculo que la interfaz de usuario necesita:

- `calculateGeriatriaEnergia(peso, alturaCm, edad, sexo, actividad, formula)`: Calcula la TMB y el requerimiento total.
- `getGeriatriaTargets(requerimientoKcal, pesoKg)`: Devuelve la distribución de macronutrientes en gramos, kilocalorías y porcentajes.

Estas funciones están listas para ser consumidas por los componentes React (`NewPlanWizard.tsx` y `PlanDetailsDialog.tsx`).

---

## 3. Integración en el Backend (Python/FastAPI)

Se modificó `main.py` para:
1. **Validar el tipo de plan:** Ahora el endpoint `/api/meal-plans` valida estrictamente que el tipo de plan sea uno de los permitidos, incluyendo `"geriatrico"`.
2. **Metadatos específicos:** Al crear un plan geriátrico, se inyectan metadatos en la `fase_1` (`plan_type: "geriatrico"`, `created_with_geriatric_formulas: True`) para asegurar que el sistema lo identifique correctamente en futuras ediciones.

---

## 4. Ciclo de Verificación Automática

Se actualizó `verify_all_planes.py` para:
1. Incluir `"geriatrico"` en la lista de tipos de planes válidos para los componentes de UI.
2. Exigir la presencia de las funciones `calculateGeriatriaEnergia` y `getGeriatriaTargets` en TypeScript.
3. Ejecutar pruebas inline (Harris × PAL) durante la verificación general.
4. Incluir `verify_geriatria.py` en la batería de scripts que se ejecutan automáticamente.

---

## Próximos Pasos para el Desarrollador Frontend

Para completar la experiencia visual, el desarrollador frontend debe:

1. **En `NewPlanWizard.tsx`:** Agregar la opción `"geriatrico"` en el selector de tipo de plan.
2. **En `PlanDetailsDialog.tsx`:** Importar y usar las nuevas funciones `calculateGeriatriaEnergia` y `getGeriatriaTargets` cuando `tipo_plan === "geriatrico"`.
3. **En la UI de Fase 1 (Requerimiento Energético):** Mostrar la opción de usar la estimación de talla de Chumlea si el paciente tiene ≥60 años.
