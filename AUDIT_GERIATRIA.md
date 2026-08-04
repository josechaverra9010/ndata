# Auditoría del Módulo de Geriatría - NutriData

**Fecha de Auditoría:** 30 de Julio de 2026  
**Estado General:** ⚠️ **CRÍTICO - NO IMPLEMENTADO**

---

## Resumen Ejecutivo

El módulo de geriatría está **parcialmente definido pero NO completamente implementado** en el sistema NutriData. Aunque existe como opción en la base de datos (`tipo = "geriatrico"`), **carece de**:

1. **Fórmulas de cálculo de requerimientos energéticos** específicas para población geriátrica
2. **Archivo de verificación** (`verify_geriatria.py`) para validar cálculos
3. **Funciones de cálculo en TypeScript** en el frontend
4. **Pruebas unitarias** para el módulo
5. **Integración completa** en el flujo de creación de planes

---

## Hallazgos Detallados

### 1. Definición en Base de Datos ✓ (Parcial)

**Ubicación:** `main.py` líneas 822 y 1142

```python
# Línea 822 - Modelo SQLAlchemy
tipo = Column(String(50), default="adulto")  # adulto, pediatria, gestante, gestante_adolescente, hospitalizado, geriatrico, deportista

# Línea 1142 - Modelo Pydantic
tipo: str = "adulto"  # adulto, pediatria, gestante, gestante_adolescente, hospitalizado, geriatrico, deportista
```

**Hallazgo:** El tipo `"geriatrico"` está documentado en comentarios pero **no hay validación explícita** en los modelos.

---

### 2. Falta de Verificación de Fórmulas ✗

**Archivos de Verificación Existentes:**
- ✓ `verify_pediatria.py` - Fórmulas GER para menores
- ✓ `verify_gestante.py` - Fórmulas para gestantes
- ✓ `verify_gest_adoles.py` - Fórmulas para gestantes adolescentes
- ✓ `verify_hospitalizado.py` - Fórmulas de Harris, Mifflin, Ireton, Chumlea
- ✓ `verify_deportista.py` - Fórmulas antropométricas
- ✓ `verify_formulas.py` - Validaciones adicionales
- ✗ **NO EXISTE** `verify_geriatria.py`

**Ubicación de Verificación Maestra:** `verify_all_planes.py` (líneas 147-154)

```python
for script in (
    "verify_gestante.py",
    "verify_gest_adoles.py",
    "verify_pediatria.py",
    "verify_deportista.py",
    "verify_hospitalizado.py",
    "verify_formulas.py",
):
    run_script(script)
```

**Hallazgo:** Geriatría **NO está incluida** en el ciclo de verificación automática.

---

### 3. Ausencia de Lógica de Cálculo en Backend ✗

**Búsqueda realizada:** Se rastreó `main.py` (13,988 líneas) buscando:
- Funciones de cálculo de GER para geriatría
- Condicionales `if tipo == "geriatrico"`
- Fórmulas específicas para adultos mayores

**Resultado:** No se encontró **ninguna lógica específica** para calcular requerimientos en población geriátrica.

**Comparación con otros módulos:**
- **Pediatría:** Fórmulas GER según edad y peso (línea 4 en `verify_pediatria.py`)
- **Gestante:** Fórmulas TMR + suplementos según trimestre (línea 95 en `verify_all_planes.py`)
- **Hospitalizado:** Fórmulas Harris, Mifflin, Ireton (líneas 4-20 en `verify_hospitalizado.py`)
- **Geriatría:** ❌ **NO EXISTE**

---

### 4. Falta de Integración en Frontend ✗

**Archivo:** `verify_all_planes.py` líneas 18-44 (Verificación de wiring en UI)

```python
required_wiz = [
    'value: "adulto"',
    'value: "pediatria"',
    'value: "gestante"',
    'value: "gestante_adolescente"',
    'value: "deportista"',
    'value: "hospitalizado"',
    # ❌ FALTA: 'value: "geriatrico"'
    "function calculateDeportistaMetrics",
    "function calculatePediatriaEnergia",
    "function calculateGestanteEnergia",
    "function calculateGestanteAdolescenteEnergia",
    "function calculateHospitalizadoEnergia",
    # ❌ FALTA: "function calculateGeriatriaEnergia",
]
```

**Hallazgo:** No hay funciones TypeScript para calcular energía geriátrica en:
- `src/components/admin/NewPlanWizard.tsx`
- `src/components/admin/PlanDetailsDialog.tsx`
- `src/lib/foodNutrients.ts`

---

### 5. Ausencia en Ciclo de Verificación ✗

**Ubicación:** `verify_all_planes.py` línea 52

```python
for tipo in ("deportista", "pediatria", "gestante", "gestante_adolescente", "hospitalizado"):
    # ❌ FALTA: "geriatrico"
    assert f'tipo_fase === "{tipo}"' in dlg, f"PlanDetailsDialog missing branch: {tipo}"
```

**Hallazgo:** El script de verificación **no valida** que geriatría esté correctamente integrada.

---

## Impacto en Funcionalidad

| Aspecto | Estado | Impacto |
|--------|--------|--------|
| Crear plan tipo "geriatrico" | ⚠️ Parcial | Se puede crear pero sin cálculos específicos |
| Calcular requerimientos | ✗ No | Usaría fórmulas por defecto (adulto) |
| Validar fórmulas | ✗ No | No hay pruebas de corrección |
| UI en wizard | ✗ No | No aparece como opción en interfaz |
| Asignar a pacientes | ⚠️ Parcial | Posible pero sin lógica geriátrica |
| Generar menús | ⚠️ Parcial | Usaría nutrientes genéricos |

---

## Recomendaciones de Corrección

### Fase 1: Implementar Fórmulas de Cálculo

**Crear:** `verify_geriatria.py`

Debe incluir fórmulas estándar para población geriátrica:

```python
# Estimación de peso en adultos mayores (Chumlea para >60 años)
def chumlea_talla_m(knee_height_cm, edad):
    return 64.19 - 0.04 * edad + 2.02 * knee_height_cm

# Harris-Benedict para mayores (ajustado por edad)
def harris_benedict_elderly(peso, altura_cm, edad, sexo="F"):
    if sexo == "F":
        return 655.0955 + 9.5634 * peso + 1.8496 * altura_cm - 4.6756 * edad
    else:
        return 88.362 + 13.397 * peso + 4.799 * altura_cm - 5.677 * edad

# Factor de actividad para mayores (sedentarios típicamente)
def pal_factor_elderly(nivel_actividad):
    return {
        "sedentario": 1.2,
        "ligero": 1.375,
        "moderado": 1.55,
    }.get(nivel_actividad, 1.2)

# Requerimiento energético total
def get_requerimiento_geriatrico(peso, altura_cm, edad, sexo, nivel_actividad):
    tmb = harris_benedict_elderly(peso, altura_cm, edad, sexo)
    pal = pal_factor_elderly(nivel_actividad)
    return tmb * pal
```

### Fase 2: Integrar en Backend

**Modificar:** `main.py`

Agregar condicional en la función de creación de planes:

```python
if plan.tipo == "geriatrico":
    # Aplicar lógica específica geriátrica
    plan.protein_target = calcular_proteina_geriatrica(peso, edad)
    plan.carbs_target = calcular_carbohidratos_geriatricos(requerimiento)
    plan.fat_target = calcular_grasas_geriatricas(requerimiento)
```

### Fase 3: Agregar Funciones TypeScript

**Crear/Modificar:** `src/lib/foodNutrients.ts`

```typescript
export function calculateGeriatriaEnergia(
  peso: number,
  altura: number,
  edad: number,
  sexo: "M" | "F",
  nivelActividad: string
): number {
  // Implementar cálculo de requerimiento geriátrico
}

export function getGeriatriaTargets(
  requerimiento: number
): { protein: number; carbs: number; fat: number } {
  // Retornar macronutrientes para geriatría
}
```

### Fase 4: Actualizar Verificación

**Modificar:** `verify_all_planes.py`

```python
# Línea 24: Agregar
'value: "geriatrico"',

# Línea 29: Agregar
"function calculateGeriatriaEnergia",

# Línea 52: Modificar
for tipo in ("deportista", "pediatria", "gestante", "gestante_adolescente", "hospitalizado", "geriatrico"):

# Línea 128: Agregar test
# --- Geriatría ---
tmb_g = 655.0955 + 9.5634 * 70 + 1.8496 * 160 - 4.6756 * 75  # edad 75
total_g = tmb_g * 1.2  # PAL sedentario
assert abs(total_g - tmb_g * 1.2) < 0.01
print(f"Geriatría OK: TMB={tmb_g:.1f} total~{total_g:.0f} kcal")
```

### Fase 5: Pruebas Unitarias

Crear tests para:
- Cálculo correcto de TMB en mayores de 60 años
- Aplicación correcta del factor PAL
- Validación de macronutrientes según requerimiento
- Integración en flujo de creación de planes

---

## Checklist de Implementación

- [ ] Crear `verify_geriatria.py` con fórmulas validadas
- [ ] Agregar lógica condicional en `main.py` para tipo "geriatrico"
- [ ] Implementar funciones TypeScript en `src/lib/foodNutrients.ts`
- [ ] Actualizar `NewPlanWizard.tsx` para mostrar opción geriatría
- [ ] Actualizar `PlanDetailsDialog.tsx` con rama geriátrica
- [ ] Modificar `verify_all_planes.py` para incluir geriatría
- [ ] Ejecutar `verify_all_planes.py` y confirmar "ALL PLAN TYPES OK"
- [ ] Crear tests unitarios
- [ ] Documentar fórmulas utilizadas con referencias científicas
- [ ] Validar con casos de prueba reales

---

## Conclusión

**El módulo de geriatría está en estado INCOMPLETO.** Aunque la infraestructura de base de datos permite crear planes de tipo "geriatrico", **no existe la lógica de cálculo específica** para población adulta mayor. Esto significa que cualquier plan creado como geriatría usaría fórmulas genéricas de adulto, lo que **NO es clínicamente apropiado** para este grupo poblacional.

**Prioridad:** ALTA - Debe completarse antes de usar el sistema con pacientes geriátricos.

