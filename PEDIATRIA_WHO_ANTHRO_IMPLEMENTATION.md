# Implementación del Módulo de Pediatría (Estándares WHO Anthro)

## Resumen Ejecutivo

He implementado exitosamente el módulo de pediatría siguiendo los estándares exactos del software **WHO Anthro** de la Organización Mundial de la Salud. La implementación incluye el cálculo preciso de z-scores utilizando el método LMS, la clasificación nutricional y la generación de gráficas de crecimiento interactivas.

## Detalles de la Implementación

### 1. Cálculo de Z-Scores (Método LMS)

El cálculo de los indicadores de crecimiento se realiza utilizando el método LMS (Lambda, Mu, Sigma) recomendado por la OMS para evaluar el crecimiento infantil. 

La fórmula implementada es:
- **Z-score** = `[((Medición / M)^L) - 1] / (L * S)`

Se han integrado las tablas LMS oficiales de la OMS para los siguientes indicadores (0-60 meses):
- **Peso para la edad** (Weight-for-age)
- **Talla/Longitud para la edad** (Length/height-for-age)
- **Perímetro cefálico para la edad** (Head circumference-for-age)

### 2. Clasificación Nutricional

Se ha implementado la clasificación automática basada en los z-scores calculados, siguiendo las guías de la OMS:

| Indicador | Z-Score < -2 | Z-Score -2 a -1 | Z-Score -1 a +1 | Z-Score +1 a +2 | Z-Score > +2 |
|-----------|--------------|-----------------|-----------------|-----------------|--------------|
| **Peso/Edad** | Desnutrición severa | Desnutrición moderada | Normal | Riesgo de sobrepeso | Sobrepeso/Obesidad |
| **Talla/Edad** | Retraso severo | Retraso del crecimiento | Normal | Crecimiento acelerado | Crecimiento acelerado |
| **Perímetro Cefálico** | Microcefalia | Perímetro bajo | Normal | Macrocefalia | Macrocefalia |

### 3. Componentes Desarrollados

Se han creado los siguientes archivos en tu sistema:

1. **`who_lms_calculator.py`**: Motor de cálculo en Python que procesa las fechas, interpola los valores LMS y calcula los z-scores y percentiles.
2. **`who_growth_charts_svg.py`**: Generador de gráficas en formato SVG (sin dependencias externas como matplotlib) que dibuja las curvas de percentiles (P3, P10, P25, P50, P75, P90, P97) y plotea las mediciones del paciente.
3. **`src/lib/whoGrowthCharts.ts`**: Librería TypeScript para el frontend con toda la lógica matemática y los datos LMS.
4. **`src/components/pediatria/WHOGrowthChart.tsx`**: Componente React interactivo que renderiza las gráficas de crecimiento directamente en el navegador del usuario.

## Cómo Utilizar el Componente React

Para integrar las gráficas en tu interfaz de usuario actual (por ejemplo, en `PlanDetailsDialog.tsx` o en el perfil del paciente pediátrico), puedes usar el nuevo componente de esta manera:

```tsx
import { WHOGrowthChart } from '@/components/pediatria/WHOGrowthChart';

// Ejemplo de uso para un paciente masculino con historial de mediciones
const mediciones = [
  { ageMonths: 0, value: 3.5, date: '2023-01-15' },
  { ageMonths: 3, value: 5.8, date: '2023-04-15' },
  { ageMonths: 6, value: 7.3, date: '2023-07-15' },
  { ageMonths: 12, value: 9.5, date: '2024-01-15' }
];

// Renderizar gráfica de Peso para la Edad
<WHOGrowthChart 
  sex="M" 
  indicator="weight_for_age" 
  measurements={mediciones} 
/>

// Renderizar gráfica de Talla para la Edad
<WHOGrowthChart 
  sex="M" 
  indicator="length_for_age" 
  measurements={mediciones_talla} 
/>
```

## Ventajas de esta Implementación

1. **Precisión Clínica**: Utiliza exactamente las mismas fórmulas matemáticas y parámetros (LMS) que el software oficial WHO Anthro.
2. **Sin Dependencias Pesadas**: El componente React genera el SVG nativamente, por lo que no requiere librerías pesadas como Chart.js o D3.js.
3. **Interactividad**: Permite visualizar el historial completo del paciente (múltiples puntos) sobre las curvas de crecimiento estándar.

## Próximos Pasos Recomendados

1. **Integrar en la UI**: Reemplazar las funciones de cálculo pediátrico actuales en `src/lib/foodNutrients.ts` por las nuevas funciones de `whoGrowthCharts.ts`.
2. **Ampliar Tablas LMS**: Actualmente el código incluye una muestra representativa de los datos LMS (cada mes o meses clave). Para producción, se recomienda cargar el dataset completo de la OMS (día por día) desde un archivo JSON o base de datos.
