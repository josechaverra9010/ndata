"""Verify Gestante adolescente (Ges Adoles) formulas vs EVANUT 4.1."""

from __future__ import annotations


def z_class(z: float) -> str:
    if z != z:  # NaN
        return ""
    if z < -2:
        return "Delgadez"
    if z < -1:
        return "Riesgo delgadez"
    if z <= 1:
        return "Adecuado"
    if z <= 2:
        return "Sobrepeso"
    return "Obesidad"


def expected_gain_kg(z: float) -> tuple[float, float]:
    """Kg sem 0-13 y 14-40 según puntaje Z (Ges Adoles)."""
    if z != z:
        return (0.0, 0.0)
    if z < -1:
        return (2.25, 12.15)  # Bajo / riesgo
    if z <= 1:
        return (1.3, 12.15)  # Normo
    if z <= 2:
        return (0.9, 8.0)  # Sobrepeso
    return (0.675, 6.0)  # Obesidad


def debio_ganar(semana: float, t1: float, t23: float) -> float:
    if semana < 14:
        return (t1 / 13) * semana
    return t1 + (t23 / 27) * (semana - 13)


def trimestre(semana: float) -> int:
    if semana <= 13:
        return 1
    if semana <= 26:
        return 2
    return 3


def extra_kcal(zclass: str, trim: int) -> int:
    key = "Normo"
    if zclass in ("Delgadez", "Riesgo delgadez"):
        key = "Bajo"
    elif zclass == "Sobrepeso":
        key = "Sobrepeso"
    elif zclass == "Obesidad":
        key = "Obesidad"
    table = {
        "Bajo": (500, 500, 500),
        "Normo": (85, 285, 475),
        "Sobrepeso": (0, 300, 300),
        "Obesidad": (0, 200, 200),
    }
    return table[key][trim - 1]


def daily_gain_g(edad: float) -> float:
    """Ganancia diaria de crecimiento (g) por edad — tabla Ges Adoles K51:L58."""
    if not (edad > 0):
        return 0.0
    if edad < 11:
        return 12.3  # 10-11
    if edad < 12:
        return 12.3  # 11-12
    if edad < 13:
        return 12.6  # 12-13
    if edad < 14:
        return 11.5  # 13-14
    if edad < 15:
        return 9.3  # 14-15
    if edad < 16:
        return 6.0  # 15-16
    if edad < 17:
        return 2.2  # 16-17
    return 0.0  # 17-18


def get_fao(peso_preg: float) -> float:
    """GET FAO mujer adolescente: 263.4 + 65.3W - 0.454W²."""
    return 263.4 + 65.3 * peso_preg - 0.454 * (peso_preg ** 2)


def base_req(peso_preg: float, ganancia_diaria_g: float, actividad: str) -> tuple[float, float, float]:
    """
    Requerimiento base Ges Adoles (U54):
      Moderado: GET + g×2
      Sedentario: (GET + g×2) × 0.85
      Activo: (GET + g×2) × 1.15
    """
    getv = get_fao(peso_preg)
    con_crec = getv + ganancia_diaria_g * 2
    if actividad == "Sedentario":
        factor = 0.85
    elif actividad == "Activo":
        factor = 1.15
    else:
        factor = 1.0  # Moderado
    return getv, con_crec * factor, factor


def rien_proteinas_kg(zclass: str) -> float:
    if zclass in ("Delgadez", "Riesgo delgadez"):
        return 1.7
    return 1.53


def run_checks() -> None:
    # --- Clasificación Z ---
    assert z_class(-2.1) == "Delgadez"
    assert z_class(-1.5) == "Riesgo delgadez"
    assert z_class(-1.0) == "Adecuado"
    assert z_class(0.0) == "Adecuado"
    assert z_class(1.0) == "Adecuado"
    assert z_class(1.5) == "Sobrepeso"
    assert z_class(2.0) == "Sobrepeso"
    assert z_class(2.5) == "Obesidad"

    # --- Ganancia esperada ---
    assert expected_gain_kg(-1.5) == (2.25, 12.15)
    assert expected_gain_kg(0.0) == (1.3, 12.15)
    assert expected_gain_kg(1.5) == (0.9, 8.0)
    assert expected_gain_kg(2.5) == (0.675, 6.0)

    # --- Tabla ganancia diaria por edad ---
    assert daily_gain_g(10.5) == 12.3
    assert daily_gain_g(11.0) == 12.3
    assert daily_gain_g(12.5) == 12.6
    assert daily_gain_g(13.2) == 11.5
    assert daily_gain_g(14.0) == 9.3
    assert daily_gain_g(15.5) == 6.0
    assert daily_gain_g(16.0) == 2.2
    assert daily_gain_g(17.0) == 0.0
    assert daily_gain_g(18.0) == 0.0

    # --- Extras por trimestre ---
    assert extra_kcal("Delgadez", 1) == 500
    assert extra_kcal("Riesgo delgadez", 3) == 500
    assert extra_kcal("Adecuado", 1) == 85
    assert extra_kcal("Adecuado", 2) == 285
    assert extra_kcal("Adecuado", 3) == 475
    assert extra_kcal("Sobrepeso", 1) == 0
    assert extra_kcal("Sobrepeso", 2) == 300
    assert extra_kcal("Obesidad", 1) == 0
    assert extra_kcal("Obesidad", 2) == 200

    # --- Caso ejemplo: 15a, 52 kg preg, Z=-0.5, Moderado, semana 20 ---
    peso_preg, est, semana, peso_act = 52.0, 1.55, 20.0, 56.0
    edad, z, actividad = 15.0, -0.5, "Moderado"
    imc_preg = peso_preg / (est * est)
    zc = z_class(z)
    t1, t23 = expected_gain_kg(z)
    debio = debio_ganar(semana, t1, t23)
    gan_pres = peso_act - peso_preg
    trim = trimestre(semana)
    gdia = daily_gain_g(edad)
    getv, req_base, factor = base_req(peso_preg, gdia, actividad)
    ex = extra_kcal(zc, trim)
    total = req_base + ex
    prot = rien_proteinas_kg(zc)

    print("=== Gestante adolescente (Ges Adoles EVANUT) ===")
    print(f"IMC preg={imc_preg:.2f}  Z={z} -> {zc}")
    print(f"Ganancia esperada t1={t1} kg / t23={t23} kg  total={t1 + t23:.2f} kg")
    print(f"Semana {semana:.0f} (trim {trim})  Debio={debio:.2f} kg  Presentada={gan_pres:.2f} kg")
    print(f"Ganancia diaria crecimiento={gdia} g  Actividad={actividad} (x{factor})")
    print(f"GET={getv:.1f}  Base={req_base:.1f}  Extra={ex}  Total={total:.1f} kcal")
    print(f"RIEN proteina={prot} g/kg  grasa~27.5%  fibra=28 g")

    assert zc == "Adecuado"
    assert trim == 2
    assert gdia == 6.0
    assert abs(getv - (263.4 + 65.3 * 52 - 0.454 * 52 * 52)) < 0.01
    assert abs(req_base - (getv + 6.0 * 2)) < 0.01  # Moderado sin factor extra
    assert ex == 285
    assert abs(total - (req_base + 285)) < 0.01
    assert prot == 1.53

    # Sedentario / Activo
    _, sed, _ = base_req(peso_preg, gdia, "Sedentario")
    _, act, _ = base_req(peso_preg, gdia, "Activo")
    assert abs(sed - (getv + 12) * 0.85) < 0.01
    assert abs(act - (getv + 12) * 1.15) < 0.01

    # Bajo peso → 1.7 g/kg y +500 kcal
    assert rien_proteinas_kg("Delgadez") == 1.7
    assert extra_kcal("Delgadez", 2) == 500

    # Debió ganar semana 10 (1er trim) vs 20
    d10 = debio_ganar(10, 1.3, 12.15)
    assert abs(d10 - (1.3 / 13) * 10) < 0.001

    print("ALL OK")


if __name__ == "__main__":
    run_checks()
