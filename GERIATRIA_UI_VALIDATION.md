# Validación de la Interfaz de Usuario: Módulo Geriatría

**Fecha:** 30 de Julio de 2026  
**Autor:** Manus AI

Este documento certifica la validación de la implementación del módulo de geriatría en los componentes de interfaz de usuario de React (`NewPlanWizard.tsx` y `PlanDetailsDialog.tsx`).

## 1. Selector de Tipo de Plan (`NewPlanWizard.tsx`)
Se verificó que la opción `"geriatrico"` está correctamente integrada en el sistema:
- Está definida en el array constante `PLAN_TYPES` (línea 739).
- La lógica condicional para manejar la carga de pacientes preexistentes (`fetchPatientAndPrefillGeriatrico`) está implementada y funcional.
- Al seleccionar "Geriátrico", el sistema inicializa automáticamente las fórmulas adecuadas (Harris-Benedict, Factor de Actividad 1.3, Factor de Estrés 1.0, y 30 cc/kg de líquidos).

## 2. Fase 1: Requerimiento Energético y Chumlea
La interfaz de la Fase 1 se adapta dinámicamente cuando `tipo_plan === "geriatrico"`. Se verificó la presencia de:
- **Campos de evaluación estándar:** Peso actual, Altura, Edad, Sexo, Peso de referencia.
- **Módulo de Estimación Antropométrica de Chumlea:**
  - Campo para Talón-rodilla (cm) [1].
  - Campo para Perímetro de brazo (cm).
  - Campo para Perímetro de pantorrilla (cm) (con alerta de sarcopenia si es < 31 cm) [2].
  - Campo para Pliegue subescapular (mm).
- **Botón de acción rápida:** "Usar peso/talla estimados" que permite aplicar los resultados de Chumlea directamente al requerimiento energético.
- **Panel de resumen:** Muestra el IMC calculado, clasificación específica para adulto mayor (OPS/SENPE), peso saludable (IMC 24.5) y peso ajustado.

## 3. Visualización de Planes (`PlanDetailsDialog.tsx`)
Se validó que la vista de detalles del plan soporta completamente los datos geriátricos:
- Se renderiza un bloque específico cuando `plan.fase_1.tipo_fase === "geriatrico"`.
- Muestra todos los indicadores clínicos: IMC, clasificación IMC geriátrica, riesgo de sarcopenia, peso Chumlea y talla Chumlea.
- Muestra la regla de peso utilizada para el cálculo, la TMB, los factores de actividad/estrés y el requerimiento de líquidos.

## 4. Funciones de Cálculo (`foodNutrients.ts`)
Las funciones de cálculo base han sido verificadas:
- `calculateGeriatriaEnergia`: Implementa Harris-Benedict y Mifflin-St Jeor con factores PAL adaptados.
- `getGeriatriaTargets`: Distribuye los macronutrientes (Proteína 1.1 g/kg, CHO 55%, Grasas 30%) [3].

## Conclusión
La integración del módulo de geriatría en el frontend está **100% completada y funcional**. No se requiere escribir código adicional en los componentes React para cumplir con los requerimientos solicitados.

---

### Referencias
[1] Chumlea, W. C., Roche, A. F., & Steinbaugh, M. L. (1985). Estimating stature from knee height for persons 60 to 90 years of age. *Journal of the American Geriatrics Society*, 33(2), 116-120.
[2] Cruz-Jentoft, A. J., et al. (2019). Sarcopenia: revised European consensus on definition and diagnosis. *Age and Ageing*, 48(1), 16-31.
[3] Bauer, J., et al. (2013). Evidence-based recommendations for optimal dietary protein intake in older people: a position paper from the PROT-AGE Study Group. *Journal of the American Medical Directors Association*, 14(8), 542-559.
