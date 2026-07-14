"""Verify Gestante formulas vs EVANUT 4.1."""

def atalah(imc):
    if imc < 20: return "Bajo"
    if imc < 25: return "Normal"
    if imc < 30: return "Sobrepeso"
    return "Obesidad"

def gains(a):
    return {
        "Bajo": (2.5, 13.5),
        "Normal": (1.5, 10.8),
        "Sobrepeso": (0.9, 8.1),
        "Obesidad": (0, 5.4),
    }[a]

def debio(semana, t1, t23):
    if semana < 14:
        return (t1 / 13) * semana
    return t1 + (t23 / 27) * (semana - 13)

def tmr(w, edad):
    if edad <= 30:
        return 14.818 * w + 486.6
    return 8.126 * w + 845.6

def extra(a, trim, variant="a"):
    table = {
        "Bajo": (500, 500, 500),
        "Normal": (85, 285, 475) if variant == "a" else (0, 360, 475),
        "Sobrepeso": (0, 225, 225),
        "Obesidad": (0, 100, 100),
    }
    return table[a][trim - 1]

# Example: 28y, 58kg preg, 1.60m, week 20, current 63kg, PAL 1.53
peso_preg, est, semana, peso_act, edad, pal = 58, 1.60, 20, 63, 28, 1.53
imc = peso_preg / (est * est)
a = atalah(imc)
t1, t23 = gains(a)
d = debio(semana, t1, t23)
gan = peso_act - peso_preg
tm = tmr(peso_preg, edad)
base = tm * pal
ex = extra(a, 2)  # week 20 = 2nd trimester
total = base + ex
print(f"IMC preg={imc:.2f} Atalah={a}")
print(f"Debio={d:.2f} Presentada={gan:.2f}")
print(f"TMR={tm:.1f} base={base:.0f} extra={ex} total={total:.0f}")

assert a == "Normal"
assert abs(imc - 22.65625) < 0.01
assert abs(d - 4.3) < 0.05
assert gan == 5.0
assert abs(tm - 1346.044) < 0.01
assert ex == 285
assert abs(total - 2344.047) < 0.5
assert extra("Normal", 2, "b") == 360
assert extra("Sobrepeso", 2) == 225
assert extra("Obesidad", 3) == 100
assert atalah(19.9) == "Bajo" and atalah(30) == "Obesidad"
print("ALL OK")
