"""Verify Pediatria GER formulas vs EVANUT 4.1 Excel sheet."""

def ger_lm(w):
    return -152 + 92.8 * w

def ger_formula(w):
    return -29 + 82.6 * w

def ger_mixto(w):
    return -95.4 + 88.3 * w

def ger_1_18(w, mujer=True):
    if mujer:
        return 263.4 + 65.3 * w - 0.454 * (w ** 2)
    return 310.2 + 63.3 * w - 0.263 * (w ** 2)

# Example: girl 8y, 25 kg, moderado, no growth
w = 25.0
ger = ger_1_18(w, mujer=True)
req = ger * 1.0
print(f"Niña 8a 25kg Moderado: GER={ger:.1f} Req={req:.0f}")

# Infant boy 6m, 7kg, leche materna, +10g/d *5, Activo, Triplicar
w2 = 7.0
ger2 = ger_lm(w2)
growth = 10 * 5
base = (ger2 + growth) * 1.15
catch = 10 * 3 * 5
print(f"Lactante LM 7kg Activo +10g Triplicar: GER={ger2:.1f} base={base:.0f} catch={catch} total={base+catch:.0f}")

# Braquial
perim = 160
tri = 10
pmb = perim - 3.14159 * tri
amb = (pmb ** 2) / (4 * 3.14159)
atb = (3.14159 / 4) * ((perim / 3.14159) ** 2)
agb = atb - amb
print(f"Braquial: PMB={pmb:.1f} AMB={amb:.1f} AGB={agb:.1f}")

assert abs(ger - 1612.25) < 0.1
assert abs(req - 1612.25) < 0.1
assert abs(ger2 - 497.6) < 0.1
assert abs(base - 630) < 1
assert catch == 150
assert abs((base + catch) - 780) < 1
assert abs(pmb - 128.6) < 0.1
assert ger_1_18(25, mujer=False) > ger  # boys higher GER at same weight in this band
print("ALL OK")
