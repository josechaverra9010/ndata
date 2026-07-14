"""Verify Deportista formulas vs EVANUT 4.1 Excel sheet."""

peso = 75.0
triceps = 8.0
subesc = 10.0
supra = 7.0
est = 178.0
hum = 7.0
fem = 9.8
brazo = 34.0
pant = 37.0
pliegue_pant = 6.0
abd = 12.0
muslo = 10.0
pct_esp = 12.0

# Excel formulas
sumatoria = triceps + subesc + supra
corr = sumatoria * (170.18 / est)
brazo_corr = brazo - (triceps / 10)
pant_corr = pant - (pliegue_pant / 10)
hwr = est / (peso ** (1 / 3))
endo = (0.1451 * corr) - (0.00068 * (corr ** 2)) + (0.0000014 * (corr ** 3)) - 0.7182
meso = (
    (0.858 * hum)
    + (0.601 * fem)
    + (0.188 * brazo_corr)
    + (0.161 * pant_corr)
    - (0.131 * est)
    + 4.5
)
if hwr >= 40.75:
    ecto = (hwr * 0.732) - 28.58
elif 38.25 < hwr < 40.75:
    ecto = (hwr * 0.463) - 17.63
else:
    ecto = 0.1
x = ecto - endo
y = (2 * meso) - (ecto + endo)
sum_y = triceps + subesc + supra + pliegue_pant + abd + muslo
pct_h = 0.1051 * sum_y + 2.585
pct_m = 0.1548 * sum_y + 3.588
pg = peso * pct_h / 100
mlg = peso - pg
aks = (mlg * 100000) / (est ** 3)
po = mlg / (1 - pct_esp / 100)

# OLD buggy app formulas
old_corr = 170.18 / est
old_brazo = brazo - (3.1415926535 * (pliegue_pant / 10))
old_pant = pant - (3.1415926535 * (pliegue_pant / 10))
old_endo = (sumatoria * (170.18 / est) - 0.00001) * 0.7182 + 0.00001
old_meso = (
    0.858 * hum
    + 0.601 * fem
    + 0.188 * old_brazo
    + 0.161 * old_pant
    - est * 0.131
    + 4.5
)
old_pct_m = 0.1548 * sum_y + 3.58

print("=== Excel / NEW app ===")
print(f"Sumatoria: {sumatoria:.2f}")
print(f"Corrección prop: {corr:.4f}")
print(f"Brazo corr: {brazo_corr:.2f}")
print(f"Pant corr: {pant_corr:.2f}")
print(f"HWR: {hwr:.2f}")
print(f"Endo: {endo:.2f}")
print(f"Meso: {meso:.2f}")
print(f"Ecto: {ecto:.2f}")
print(f"X: {x:.2f} Y: {y:.2f}")
print(f"%Grasa H: {pct_h:.2f} M: {pct_m:.2f}")
print(f"PG: {pg:.2f} MLG: {mlg:.2f}")
print(f"AKS: {aks:.3f}")
print(f"Peso óptimo: {po:.2f}")
print()
print("=== OLD buggy diffs ===")
print(f"Corr old vs new: {old_corr:.4f} vs {corr:.4f}")
print(f"Brazo old vs new: {old_brazo:.2f} vs {brazo_corr:.2f}")
print(f"Pant old vs new: {old_pant:.2f} vs {pant_corr:.2f}")
print(f"Endo old vs new: {old_endo:.2f} vs {endo:.2f}")
print(f"Meso old vs new: {old_meso:.2f} vs {meso:.2f}")
print(f"% mujer old vs new: {old_pct_m:.3f} vs {pct_m:.3f}")

assert abs(sumatoria - 25) < 0.01
assert abs(corr - 23.9017) < 0.001
assert abs(endo - 2.38) < 0.02
assert abs(meso - 5.18) < 0.02
assert abs(ecto - 2.32) < 0.02
assert abs(pct_h - 8.16) < 0.02
assert abs(pct_m - 11.79) < 0.02
assert abs(aks - 1.221) < 0.002
assert abs(po - 78.28) < 0.05
assert abs(old_endo - endo) > 1  # old formula was clearly wrong
print("ALL OK")
