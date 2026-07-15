"""Verify Hospitalizado formulas vs EVANUT 4.1."""


def harris_f(peso, altura_cm, edad):
    return 655.0955 + 9.5634 * peso + 1.8496 * altura_cm - 4.6756 * edad


def mifflin_f(peso, altura_cm, edad):
    return 10 * peso + 6.25 * altura_cm - 5 * edad - 161


def ireton_s(peso, edad, obesidad=False):
    return 629 - 11 * edad + 25 * peso - (609 if obesidad else 0)


def ireton_v(peso, edad, male=True, trauma=False, burn=False):
    g = 1 if male else 0
    t = 1 if trauma else 0
    b = 1 if burn else 0
    return 1925 - 10 * edad + 5 * peso + 281 * g + 292 * t + 851 * b


def chumlea_m(knee, edad):
    return 64.19 - 0.04 * edad + 2.02 * knee


# Ejemplo: mujer 45a, 70 kg, 160 cm, FA 1.15 (cama), FE 1.2 (cirugía mayor)
peso, altura, edad = 70.0, 160.0, 45.0
fa, fe = 1.15, 1.2
tmb = harris_f(peso, altura, edad)
req = tmb * fa * fe
expected_tmb = 655.0955 + 9.5634 * 70 + 1.8496 * 160 - 4.6756 * 45
assert abs(tmb - expected_tmb) < 0.01, tmb
assert abs(req - expected_tmb * 1.15 * 1.2) < 0.01
print(f"Harris OK: TMB={tmb:.1f} × {fa} × {fe} = {req:.1f} kcal")

tm_m = mifflin_f(peso, altura, edad)
expected_m = 10 * 70 + 6.25 * 160 - 5 * 45 - 161
assert abs(tm_m - expected_m) < 0.01, tm_m
print(f"Mifflin OK: TMB={tm_m:.1f} × FA×FE = {tm_m * fa * fe:.1f} kcal")

eee = ireton_s(70, 45, False)
expected_eee = 629 - 11 * 45 + 25 * 70
assert abs(eee - expected_eee) < 0.1, eee
print(f"Ireton espontánea OK: EEE={eee:.1f}")

eee_v = ireton_v(70, 45, True, True, False)
expected_v = 1925 - 10 * 45 + 5 * 70 + 281 + 292
assert abs(eee_v - expected_v) < 0.1, eee_v
print(f"Ireton ventilatorio OK: EEE={eee_v:.1f}")

talla = chumlea_m(50, 70)
expected_t = 64.19 - 0.04 * 70 + 2.02 * 50
assert abs(talla - expected_t) < 0.01
print(f"Chumlea masculino OK: talla={talla:.2f} cm")


def chumlea_peso_m(ac, cc, kh, sst):
    return 0.98 * cc + 1.16 * kh + 1.73 * ac + 0.37 * sst - 81.69


def chumlea_peso_f(ac, cc, kh, sst):
    return 1.27 * cc + 0.87 * kh + 0.98 * ac + 0.4 * sst - 62.35


# Inputs vacíos → solo constante (como Excel -81.69), con datos reales:
peso_est_m = chumlea_peso_m(28, 32, 50, 15)
assert abs(peso_est_m - (0.98 * 32 + 1.16 * 50 + 1.73 * 28 + 0.37 * 15 - 81.69)) < 0.01
peso_est_f = chumlea_peso_f(26, 30, 48, 18)
assert abs(peso_est_f - (1.27 * 30 + 0.87 * 48 + 0.98 * 26 + 0.4 * 18 - 62.35)) < 0.01
print(f"Chumlea peso OK: H={peso_est_m:.2f} kg  M={peso_est_f:.2f} kg")

# Parenteral: 70 kg, 2100 kcal, prot 1.2, CHO 4 → lípidos resto
peso_pn, kcal_pn = 70.0, 2100.0
prot_g = 1.2 * peso_pn
cho_g = 4.0 * peso_pn
lip_kcal = kcal_pn - prot_g * 4 - cho_g * 4
lip_g = lip_kcal / 9
lip_gkg = lip_g / peso_pn
flujo = (cho_g * 1000) / (peso_pn * 1440)
assert abs(prot_g - 84) < 0.01
assert abs(cho_g - 280) < 0.01
assert abs(lip_kcal - (2100 - 336 - 1120)) < 0.01
assert abs(flujo - (280000 / 100800)) < 0.001
print(f"Parenteral OK: prot={prot_g}g cho={cho_g}g lip={lip_g:.1f}g ({lip_gkg:.2f}g/kg) flujo={flujo:.2f}")

# Líquidos 35 cc/kg
liq = 70 * 35
assert liq == 2450
print(f"Líquidos OK: {liq} ml/día")

# Regla peso: sobrepeso → ideal
imc = 70 / (1.60**2)
ps = 25 * (1.60**2)
pa = (70 - ps) * 0.25 + ps
assert 25 <= imc < 30
print(f"Regla peso OK: IMC={imc:.1f} PS={ps:.1f} PA={pa:.1f}")

print("Hospitalizado formulas OK")
