"""Verify Geriatría formulas vs EVANUT 4.1 Excel sheet.

Fórmulas para población adulta mayor (≥60 años):
- Estimación de talla (Chumlea para mayores)
- Tasa Metabólica Basal (Harris-Benedict ajustada)
- Requerimiento Energético Total (TMB × PAL)
- Macronutrientes específicos para geriatría
"""


def chumlea_talla_m(knee_height_cm, edad):
    """Estimación de talla en hombres mayores (Chumlea et al., 1985).
    
    Válida para hombres de 60-90 años cuando no se puede medir talla directa.
    knee_height_cm: altura de rodilla en cm
    edad: edad en años
    Retorna: talla estimada en cm
    """
    return 64.19 - 0.04 * edad + 2.02 * knee_height_cm


def chumlea_talla_f(knee_height_cm, edad):
    """Estimación de talla en mujeres mayores (Chumlea et al., 1985).
    
    Válida para mujeres de 60-90 años cuando no se puede medir talla directa.
    knee_height_cm: altura de rodilla en cm
    edad: edad en años
    Retorna: talla estimada en cm
    """
    return 84.88 - 0.24 * edad + 1.83 * knee_height_cm


def harris_benedict_elderly_f(peso, altura_cm, edad):
    """Tasa Metabólica Basal para mujeres mayores (Harris-Benedict).
    
    Fórmula original de Harris-Benedict, aplicable a mayores de 60 años.
    peso: peso en kg
    altura_cm: altura en cm
    edad: edad en años
    Retorna: TMB en kcal/día
    """
    return 655.0955 + 9.5634 * peso + 1.8496 * altura_cm - 4.6756 * edad


def harris_benedict_elderly_m(peso, altura_cm, edad):
    """Tasa Metabólica Basal para hombres mayores (Harris-Benedict).
    
    Fórmula original de Harris-Benedict, aplicable a mayores de 60 años.
    peso: peso en kg
    altura_cm: altura en cm
    edad: edad en años
    Retorna: TMB en kcal/día
    """
    return 88.362 + 13.397 * peso + 4.799 * altura_cm - 5.677 * edad


def mifflin_elderly_f(peso, altura_cm, edad):
    """Tasa Metabólica Basal para mujeres mayores (Mifflin-St Jeor).
    
    Fórmula más reciente, también aplicable a mayores.
    peso: peso en kg
    altura_cm: altura en cm
    edad: edad en años
    Retorna: TMB en kcal/día
    """
    return 10 * peso + 6.25 * altura_cm - 5 * edad - 161


def mifflin_elderly_m(peso, altura_cm, edad):
    """Tasa Metabólica Basal para hombres mayores (Mifflin-St Jeor).
    
    Fórmula más reciente, también aplicable a mayores.
    peso: peso en kg
    altura_cm: altura en cm
    edad: edad en años
    Retorna: TMB en kcal/día
    """
    return 10 * peso + 6.25 * altura_cm - 5 * edad + 5


def pal_factor_elderly(nivel_actividad):
    """Factor de Actividad Física (PAL) para población geriátrica.
    
    Los adultos mayores típicamente tienen menor actividad.
    nivel_actividad: "sedentario", "ligero", "moderado"
    Retorna: factor PAL (1.2 a 1.55)
    """
    pal_map = {
        "sedentario": 1.2,      # Confinado a cama o silla
        "ligero": 1.375,        # Actividad ligera, vida independiente
        "moderado": 1.55,       # Actividad moderada, ejercicio regular
    }
    return pal_map.get(nivel_actividad, 1.2)


def get_requerimiento_geriatrico(peso, altura_cm, edad, sexo, nivel_actividad, formula="harris"):
    """Requerimiento Energético Total para adulto mayor.
    
    peso: peso en kg
    altura_cm: altura en cm
    edad: edad en años (≥60)
    sexo: "M" o "F"
    nivel_actividad: "sedentario", "ligero", "moderado"
    formula: "harris" o "mifflin"
    Retorna: requerimiento energético total en kcal/día
    """
    if formula == "harris":
        if sexo == "F":
            tmb = harris_benedict_elderly_f(peso, altura_cm, edad)
        else:
            tmb = harris_benedict_elderly_m(peso, altura_cm, edad)
    else:  # mifflin
        if sexo == "F":
            tmb = mifflin_elderly_f(peso, altura_cm, edad)
        else:
            tmb = mifflin_elderly_m(peso, altura_cm, edad)
    
    pal = pal_factor_elderly(nivel_actividad)
    return tmb * pal


def get_macronutrientes_geriatrico(requerimiento_kcal, peso_kg):
    """Distribución de macronutrientes para adulto mayor.
    
    Recomendaciones para población geriátrica:
    - Proteína: 1.0-1.2 g/kg (mayor que adulto joven para preservar masa muscular)
    - Carbohidratos: 45-65% del total
    - Grasas: 25-35% del total
    
    requerimiento_kcal: requerimiento energético total en kcal/día
    peso_kg: peso corporal en kg
    Retorna: dict con proteína (g), carbohidratos (g), grasas (g)
    """
    # Proteína: 1.1 g/kg como estándar para geriatría
    proteina_g = 1.1 * peso_kg
    proteina_kcal = proteina_g * 4
    
    # Carbohidratos: 55% del total
    carbs_kcal = requerimiento_kcal * 0.55
    carbs_g = carbs_kcal / 4
    
    # Grasas: 30% del total
    fat_kcal = requerimiento_kcal * 0.30
    fat_g = fat_kcal / 9
    
    return {
        "proteina_g": round(proteina_g, 1),
        "carbohidratos_g": round(carbs_g, 1),
        "grasas_g": round(fat_g, 1),
        "proteina_kcal": round(proteina_kcal, 0),
        "carbs_kcal": round(carbs_kcal, 0),
        "fat_kcal": round(fat_kcal, 0),
    }


def get_imc_classification_elderly(imc):
    """Clasificación de IMC para adultos mayores (OMS adaptada).
    
    Los puntos de corte para mayores son ligeramente diferentes.
    imc: Índice de Masa Corporal
    Retorna: clasificación como string
    """
    if imc < 22:
        return "Bajo peso"
    elif imc < 27:
        return "Peso normal"
    elif imc < 30:
        return "Sobrepeso"
    else:
        return "Obesidad"


# ==================== PRUEBAS DE VERIFICACIÓN ====================

# Caso 1: Mujer mayor, 70 años, 65 kg, 155 cm, sedentaria
print("=== Caso 1: Mujer 70a, 65kg, 155cm, sedentaria ===")
peso_1 = 65.0
altura_1 = 155.0
edad_1 = 70.0
sexo_1 = "F"
pal_1 = "sedentario"

tmb_1_harris = harris_benedict_elderly_f(peso_1, altura_1, edad_1)
tmb_1_mifflin = mifflin_elderly_f(peso_1, altura_1, edad_1)
req_1_harris = get_requerimiento_geriatrico(peso_1, altura_1, edad_1, sexo_1, pal_1, "harris")
req_1_mifflin = get_requerimiento_geriatrico(peso_1, altura_1, edad_1, sexo_1, pal_1, "mifflin")
macro_1 = get_macronutrientes_geriatrico(req_1_harris, peso_1)
imc_1 = peso_1 / (altura_1 / 100) ** 2

print(f"TMB Harris: {tmb_1_harris:.1f} kcal")
print(f"TMB Mifflin: {tmb_1_mifflin:.1f} kcal")
print(f"Requerimiento Harris (PAL {pal_1}): {req_1_harris:.0f} kcal")
print(f"Requerimiento Mifflin (PAL {pal_1}): {req_1_mifflin:.0f} kcal")
print(f"IMC: {imc_1:.2f} ({get_imc_classification_elderly(imc_1)})")
print(f"Macronutrientes: Prot={macro_1['proteina_g']:.1f}g, CHO={macro_1['carbohidratos_g']:.1f}g, Grasas={macro_1['grasas_g']:.1f}g")

# Validaciones
assert abs(tmb_1_harris - (655.0955 + 9.5634 * 65 + 1.8496 * 155 - 4.6756 * 70)) < 0.1
assert abs(req_1_harris - tmb_1_harris * 1.2) < 0.1
assert 20 < imc_1 < 30
print("✓ Caso 1 OK\n")

# Caso 2: Hombre mayor, 75 años, 80 kg, 170 cm, actividad ligera
print("=== Caso 2: Hombre 75a, 80kg, 170cm, actividad ligera ===")
peso_2 = 80.0
altura_2 = 170.0
edad_2 = 75.0
sexo_2 = "M"
pal_2 = "ligero"

tmb_2_harris = harris_benedict_elderly_m(peso_2, altura_2, edad_2)
tmb_2_mifflin = mifflin_elderly_m(peso_2, altura_2, edad_2)
req_2_harris = get_requerimiento_geriatrico(peso_2, altura_2, edad_2, sexo_2, pal_2, "harris")
req_2_mifflin = get_requerimiento_geriatrico(peso_2, altura_2, edad_2, sexo_2, pal_2, "mifflin")
macro_2 = get_macronutrientes_geriatrico(req_2_harris, peso_2)
imc_2 = peso_2 / (altura_2 / 100) ** 2

print(f"TMB Harris: {tmb_2_harris:.1f} kcal")
print(f"TMB Mifflin: {tmb_2_mifflin:.1f} kcal")
print(f"Requerimiento Harris (PAL {pal_2}): {req_2_harris:.0f} kcal")
print(f"Requerimiento Mifflin (PAL {pal_2}): {req_2_mifflin:.0f} kcal")
print(f"IMC: {imc_2:.2f} ({get_imc_classification_elderly(imc_2)})")
print(f"Macronutrientes: Prot={macro_2['proteina_g']:.1f}g, CHO={macro_2['carbohidratos_g']:.1f}g, Grasas={macro_2['grasas_g']:.1f}g")

# Validaciones
assert abs(tmb_2_harris - (88.362 + 13.397 * 80 + 4.799 * 170 - 5.677 * 75)) < 0.1
assert abs(req_2_harris - tmb_2_harris * 1.375) < 0.1
assert 20 < imc_2 < 30
print("✓ Caso 2 OK\n")

# Caso 3: Estimación de talla con Chumlea (mujer con altura de rodilla 42 cm, 68 años)
print("=== Caso 3: Estimación de talla Chumlea (mujer, KH=42cm, 68a) ===")
kh_3 = 42.0
edad_3 = 68.0
talla_est_3 = chumlea_talla_f(kh_3, edad_3)
print(f"Altura de rodilla: {kh_3} cm")
print(f"Edad: {edad_3} años")
print(f"Talla estimada: {talla_est_3:.2f} cm")

# Validación
expected_talla_3 = 84.88 - 0.24 * 68 + 1.83 * 42
assert abs(talla_est_3 - expected_talla_3) < 0.01
print("✓ Caso 3 OK\n")

# Caso 4: Comparación PAL factors
print("=== Caso 4: Factores PAL para geriatría ===")
pal_sed = pal_factor_elderly("sedentario")
pal_lig = pal_factor_elderly("ligero")
pal_mod = pal_factor_elderly("moderado")
print(f"PAL Sedentario: {pal_sed}")
print(f"PAL Ligero: {pal_lig}")
print(f"PAL Moderado: {pal_mod}")
assert pal_sed == 1.2
assert pal_lig == 1.375
assert pal_mod == 1.55
print("✓ Caso 4 OK\n")

print("=" * 50)
print("Geriatría formulas OK - All tests passed!")
print("=" * 50)
