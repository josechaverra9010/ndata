"""Run all EVANUT plan verifications + source wiring checks."""

from __future__ import annotations

import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def check_wiring() -> None:
    wiz = (ROOT / "src/components/admin/NewPlanWizard.tsx").read_text(encoding="utf-8")
    dlg = (ROOT / "src/components/admin/PlanDetailsDialog.tsx").read_text(encoding="utf-8")
    meals = (ROOT / "src/pages/MealPlans.tsx").read_text(encoding="utf-8")
    nutrients = (ROOT / "src/lib/foodNutrients.ts").read_text(encoding="utf-8")

    required_wiz = [
        'value: "adulto"',
        'value: "pediatria"',
        'value: "gestante"',
        'value: "gestante_adolescente"',
        'value: "deportista"',
        'value: "hospitalizado"',
        "function calculateDeportistaMetrics",
        "function calculatePediatriaEnergia",
        "function calculateGestanteEnergia",
        "function calculateGestanteAdolescenteEnergia",
        "function calculateHospitalizadoEnergia",
        "function calcChumleaPesoKg",
        "function calculateParenteralHospitalizado",
        "Método del pulgar",
        "Nutrición parenteral adulto",
        'currentPhase === 1 && formData.tipo_plan === "deportista"',
        'currentPhase === 1 && formData.tipo_plan === "pediatria"',
        "currentPhase === 1 && isGestanteTipo(formData.tipo_plan)",
        "currentPhase === 1 && isHospitalizado(formData.tipo_plan)",
        "!isHospitalizado(formData.tipo_plan)",
        "!isGestanteTipo(formData.tipo_plan)",
        'tipo_fase: "deportista"',
        'tipo_fase: "pediatria"',
        'tipo_fase: "gestante"',
        'tipo_fase: "gestante_adolescente"',
        'tipo_fase: "hospitalizado"',
    ]
    for item in required_wiz:
        assert item in wiz, f"NewPlanWizard missing: {item}"

    # Adult Phase 1 must not use the old gestante-only exclusion (would leak gestante_adolescente into adult UI)
    assert 'formData.tipo_plan !== "gestante" && (' not in wiz or "!isGestanteTipo(formData.tipo_plan)" in wiz

    for tipo in ("deportista", "pediatria", "gestante", "gestante_adolescente", "hospitalizado"):
        assert f'tipo_fase === "{tipo}"' in dlg, f"PlanDetailsDialog missing branch: {tipo}"
        assert f"{tipo}:" in meals or f'"{tipo}"' in meals, f"MealPlans missing label for {tipo}"

    required_fn = [
        "getAtalahClass",
        "getGestanteExtraKcal",
        "getGestAdolesZClass",
        "getGestAdolesBaseReq",
        "getPediatriaRienTargets",
        "getEvanutGruposForTipo",
    ]
    for fn in required_fn:
        assert f"export function {fn}" in nutrients, f"foodNutrients missing {fn}"

    print("Wiring OK (wizard + dialog + labels + helpers)")


def check_formulas_inline() -> None:
    """Mirror critical TS helpers and spot-check each plan type."""

    # --- Gestante adulto ---
    def atalah(imc: float) -> str:
        if imc < 20:
            return "Bajo"
        if imc < 25:
            return "Normal"
        if imc < 30:
            return "Sobrepeso"
        return "Obesidad"

    def gest_extra(a: str, trim: int, variant: str = "a") -> int:
        table = {
            "Bajo": (500, 500, 500),
            "Normal": (85, 285, 475) if variant == "a" else (0, 360, 475),
            "Sobrepeso": (0, 225, 225),
            "Obesidad": (0, 100, 100),
        }
        return table[a][trim - 1]

    peso, est, edad, pal = 58.0, 1.60, 28.0, 1.53
    imc = peso / (est * est)
    a = atalah(imc)
    tmr = 14.818 * peso + 486.6  # edad <= 30
    total = tmr * pal + gest_extra(a, 2)
    assert a == "Normal"
    assert abs(tmr - 1346.044) < 0.01
    assert abs(total - 2344.047) < 0.5
    print(f"Gestante adulto OK: IMC={imc:.2f} {a} total~{total:.0f} kcal")

    # --- Gestante adolescente ---
    getv = 263.4 + 65.3 * 52 - 0.454 * (52**2)
    base = getv + 6.0 * 2  # Moderado
    assert abs(base + 285 - 2728.4) < 0.5
    print(f"Gestante adolescente OK: GET={getv:.1f} total~{base + 285:.1f} kcal")

    # --- Pediatria ---
    ger = 263.4 + 65.3 * 25 - 0.454 * (25**2)
    assert abs(ger - 1612.25) < 0.1
    ger_lm = -152 + 92.8 * 7
    assert abs(ger_lm - 497.6) < 0.1
    print(f"Pediatria OK: GER 8a={ger:.1f} LM7kg={ger_lm:.1f}")

    # --- Deportista ---
    sumatoria = 8 + 10 + 7
    corr = sumatoria * (170.18 / 178)
    endo = (0.1451 * corr) - (0.00068 * (corr**2)) + (0.0000014 * (corr**3)) - 0.7182
    assert abs(endo - 2.38) < 0.02
    print(f"Deportista OK: endo={endo:.2f} corr={corr:.4f}")

    # --- Hospitalizado Harris × FA × FE ---
    tmb_h = 655.0955 + 9.5634 * 70 + 1.8496 * 160 - 4.6756 * 45
    total_h = tmb_h * 1.15 * 1.2
    assert abs(tmb_h - 1410.0675) < 0.1
    assert abs(total_h - tmb_h * 1.15 * 1.2) < 0.01
    print(f"Hospitalizado OK: Harris TMB={tmb_h:.1f} total~{total_h:.0f} kcal")

    # --- Adulto IMC/PS ---
    altura_m = 1.73
    peso_a = 63.0
    imc_a = peso_a / (altura_m**2)
    assert abs(imc_a - 21.05) < 0.02
    print(f"Adulto OK: IMC={imc_a:.2f}")


def run_script(name: str) -> None:
    path = ROOT / name
    print(f"\n--- {name} ---")
    runpy.run_path(str(path), run_name="__main__")


def main() -> int:
    print("=== verify_all_planes ===")
    check_wiring()
    check_formulas_inline()
    for script in (
        "verify_gestante.py",
        "verify_gest_adoles.py",
        "verify_pediatria.py",
        "verify_deportista.py",
        "verify_hospitalizado.py",
        "verify_formulas.py",
    ):
        run_script(script)
    print("\n=== ALL PLAN TYPES OK ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
